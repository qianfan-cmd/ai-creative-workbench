"""
语义切分服务 — RAG 索引阶段「分块」核心。

流程：规则结构化预切 →（可选）LLM keep/merge ops → 过短块合并 → 过长块拆分。

产出 SemanticChunk 列表，供 knowledge_tagger 打标与 indexing_pipeline 向量化入库。
"""

from __future__ import annotations



import json

import logging

import os

import re

from dataclasses import dataclass, field



from app.services.llm_service import chat_with_llm

from app.services.rag_prompts import semantic_chunk_prompt

from app.services.text_splitter import StructuredChunk, split_text, split_text_structured



logger = logging.getLogger(__name__)



# 过短 chunk 合并阈值（字符数）
MIN_CHUNK_CHARS = int(os.getenv("MIN_CHUNK_CHARS", "80"))

# 过长 chunk 二次拆分上限（字符数）
MAX_CHUNK_CHARS = int(os.getenv("MAX_CHUNK_CHARS", "600"))

# 过长拆分的 overlap，与 text_splitter 一致
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "50"))

# 是否启用 LLM 语义 refine；0 时仅规则 structured split
SEMANTIC_CHUNK_ENABLED = os.getenv("SEMANTIC_CHUNK_ENABLED", "1").strip().lower() in (

    "1",

    "true",

    "yes",

    "on",

)

# 文档总字符数低于此值时跳过 LLM，直接规则切分
SEMANTIC_CHUNK_LLM_THRESHOLD = int(os.getenv("SEMANTIC_CHUNK_LLM_THRESHOLD", "200"))



# 每个预切块送入 LLM Prompt 的最大预览字符
BLOCK_PREVIEW_CHARS = int(os.getenv("SEMANTIC_BLOCK_PREVIEW_CHARS", "800"))

# 超大文档分批调用 LLM 时每批 block 数
BATCH_BLOCK_SIZE = int(os.getenv("SEMANTIC_BATCH_BLOCK_SIZE", "20"))

# 触发分批的 Prompt 总字符上限
BATCH_TEXT_CHAR_LIMIT = int(os.getenv("SEMANTIC_BATCH_TEXT_LIMIT", "8000"))

# 触发分批的 block 数量上限
BATCH_BLOCK_COUNT_LIMIT = int(os.getenv("SEMANTIC_BATCH_BLOCK_COUNT", "40"))

# LLM 语义切分响应 max_tokens
SEMANTIC_CHUNK_MAX_TOKENS = int(os.getenv("SEMANTIC_CHUNK_MAX_TOKENS", "4096"))





@dataclass

class SemanticChunk:
    """语义切分产出单元 — 携带正文与 section/heading/summary/tags 元数据。
    section/heading/chunk_summary 参与 embed 和 BM25
    """

    content: str

    section: str = "body"  # 章节类型：experience/project/education 等

    heading: str = ""

    chunk_summary: str = "" # LLM 生成的一句话摘要，参与 embed 和 BM25

    tags: list[str] = field(default_factory=list)





def _parse_json_array(raw: str) -> list[dict]:
    """
    解析 LLM 返回的 JSON 数组 — 支持 markdown fence 包裹。

    参数:
        raw: LLM 原始响应

    返回:
        list[dict] ops 列表

    异常:
        ValueError / json.JSONDecodeError：空响应或非数组
    """
    # 去掉外层的换行符和空格
    text = raw.strip()

    # 匹配 markdown fence 包裹的 JSON 数组，去掉外层的```json
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)

    if fence:

        text = fence.group(1).strip()

    if not text:

        raise ValueError("json_parse: empty response after strip")

    parsed = json.loads(text)

    if not isinstance(parsed, list):

        raise ValueError("json_parse: expected JSON array")

    return parsed





def _format_numbered_blocks(structured: list[StructuredChunk]) -> str:
    """
    将结构化预切块格式化为带编号的 Prompt 文本。

    参数:
        structured: split_text_structured 产出

    返回:
        ``[0] section=... heading=...\\n预览...`` 拼接的多块文本
    """

    parts: list[str] = []

    for i, block in enumerate(structured):

        heading = block.heading or ""

        # 预览内容，最多 BLOCK_PREVIEW_CHARS 个字符
        preview = block.content[:BLOCK_PREVIEW_CHARS]

        if len(block.content) > BLOCK_PREVIEW_CHARS:

            preview += "…"

        # 拼接预览内容，最多 BLOCK_PREVIEW_CHARS 个字符
        parts.append(

            f"[{i}] section={block.section}"

            + (f" heading={heading}" if heading else "")

            + f"\n{preview}"

        )

    return "\n\n".join(parts)





def _validate_chunk_ops(ops: list[dict], block_count: int) -> None:
    """
    校验 LLM 输出的 keep/merge ops — indices 须覆盖 0..block_count-1 且无重复。

    参数:
        ops: LLM 解析后的操作列表
        block_count: 预切块总数

    异常:
        ValueError：op 非法、indices 不连续、遗漏或重复

        [
          {"op": "keep", "indices": [0], "section_hint": "technical", "summary": "..."},
          {"op": "merge", "indices": [1, 2], "section_hint": "general", "summary": "..."}
        ]
    """

    if block_count <= 0:

        raise ValueError("ops_invalid: no blocks")

    seen: set[int] = set()

    for item in ops:

        op = (item.get("op") or "").strip().lower()

        if op not in ("keep", "merge"):

            raise ValueError(f"ops_invalid: unknown op {op!r}")

        indices_raw = item.get("indices") # 索引列表，表示要保留或合并的块的索引

        if not isinstance(indices_raw, list) or not indices_raw:

            raise ValueError("ops_invalid: indices must be non-empty list")

        indices = [int(x) for x in indices_raw] # 将索引列表中的字符串转换为整数

        if op == "keep" and len(indices) != 1:

            raise ValueError("ops_invalid: keep requires exactly one index")

        if op == "merge" and len(indices) < 2:

            raise ValueError("ops_invalid: merge requires at least two indices")

        prev = indices[0] - 1

        for idx in indices:

            if idx < 0 or idx >= block_count:

                raise ValueError(f"ops_invalid: index {idx} out of range 0..{block_count - 1}")

            if idx in seen:

                raise ValueError(f"ops_invalid: duplicate index {idx}")

            if idx != prev + 1:

                raise ValueError(f"ops_invalid: indices must be contiguous, got {indices}")

            seen.add(idx)

            prev = idx

    if seen != set(range(block_count)):

        missing = set(range(block_count)) - seen

        raise ValueError(f"ops_invalid: missing indices {sorted(missing)}")





def _apply_chunk_ops(

    structured: list[StructuredChunk],

    ops: list[dict],

) -> list[SemanticChunk]:
    """
    按 LLM ops 合并预切块为 SemanticChunk 列表。

    参数:
        structured: 规则预切块
        ops: keep/merge 操作及 section_hint、summary

    返回:
        SemanticChunk 列表（空 content 的 op 跳过）
    """

    _validate_chunk_ops(ops, len(structured))

    out: list[SemanticChunk] = []

    for item in ops:

        indices = [int(x) for x in item["indices"]]

        blocks = [structured[i] for i in indices]

        content = "\n\n".join(b.content.strip() for b in blocks if b.content.strip())

        if not content:

            continue

        section = (item.get("section_hint") or blocks[0].section or "body").strip()[:32]

        summary = (item.get("summary") or "")[:200]

        heading = blocks[0].heading or ""

        out.append(

            SemanticChunk(

                content=content,

                section=section,

                heading=heading,

                chunk_summary=summary,

            )

        )

    return out





def _structured_to_semantic(structured: list[StructuredChunk]) -> list[SemanticChunk]:
    """规则预切块直接映射为 SemanticChunk — LLM 关闭或失败时的 fallback。"""

    return [

        SemanticChunk(content=c.content, section=c.section, heading=c.heading)

        for c in structured

    ]
    # result = []
    # for c in structured:
    #     result.append(
    #         SemanticChunk(content=c.content, section=c.section, heading=c.heading)
    #     )
    # return result




def _log_chunk_failure(

    reason: str,

    *,

    filename: str,

    block_count: int,

    raw: str | None = None,

    exc: Exception | None = None,

) -> None:
    """
    记录语义切分失败日志 — 不抛异常，由调用方 fallback。

    副作用:
        logger.warning 一条结构化日志
    """

    preview = ""

    if raw is not None:

        preview = raw[:200].replace("\n", "\\n")

    logger.warning(

        "LLM semantic chunk failed (%s), fallback structured: filename=%s blocks=%d raw_len=%s preview=%r exc=%s",

        reason,

        filename,

        block_count,

        len(raw) if raw is not None else None,

        preview,

        exc,

    )





def _llm_refine_batch(

    filename: str,

    structured: list[StructuredChunk],

) -> list[SemanticChunk] | None:
    """
    单批预切块调用 LLM 语义 refine。

    参数:
        filename: 文档名（日志与 Prompt）
        structured: 本批 StructuredChunk 列表

    返回:
        成功时 SemanticChunk 列表；JSON/ops/API 失败时 None

    副作用:
        调用 chat_with_llm；失败时写 warning 日志
    """

    if not structured:

        return []



    blocks_text = _format_numbered_blocks(structured)

    prompt = semantic_chunk_prompt(filename, blocks_text, block_count=len(structured))

    raw = ""

    try:

        raw = chat_with_llm(prompt, max_tokens=SEMANTIC_CHUNK_MAX_TOKENS)

        ops = _parse_json_array(raw)

        chunks = _apply_chunk_ops(structured, ops)

        if not chunks:

            raise ValueError("ops_invalid: produced zero chunks")

        return chunks

    except json.JSONDecodeError as exc:

        _log_chunk_failure("json_parse", filename=filename, block_count=len(structured), raw=raw, exc=exc)

    except ValueError as exc:

        msg = str(exc)

        reason = "json_parse" if msg.startswith("json_parse:") else "ops_invalid"

        _log_chunk_failure(reason, filename=filename, block_count=len(structured), raw=raw, exc=exc)

    except Exception as exc:

        _log_chunk_failure("api_error", filename=filename, block_count=len(structured), raw=raw, exc=exc)

    return None





def _llm_refine_chunks(filename: str, structured: list[StructuredChunk]) -> list[SemanticChunk]:
    """
    LLM 语义切分主逻辑 — 小文档单批，大文档按 BATCH_BLOCK_SIZE 分批。

    参数:
        filename: 文档名
        structured: 全部规则预切块

    返回:
        SemanticChunk 列表；任一批失败则该批 fallback 为 _structured_to_semantic

    副作用:
        可能多次调用 chat_with_llm
    """

    if not structured:

        return []



    total_blocks = len(structured)

    numbered_preview = _format_numbered_blocks(structured)

    use_batches = (

        total_blocks > BATCH_BLOCK_COUNT_LIMIT

        or len(numbered_preview) > BATCH_TEXT_CHAR_LIMIT

    )



    if not use_batches:

        result = _llm_refine_batch(filename, structured)

        if result is not None:

            logger.info(

                "semantic chunk ops ok: filename=%s %d blocks → %d chunks",

                filename,

                total_blocks,

                len(result),

            )

            return result

        return _structured_to_semantic(structured)



    merged: list[SemanticChunk] = []

    batch_ok = 0

    for start in range(0, total_blocks, BATCH_BLOCK_SIZE):

        batch = structured[start : start + BATCH_BLOCK_SIZE]

        batch_result = _llm_refine_batch(f"{filename}#batch{start}", batch)

        if batch_result is None:

            merged.extend(_structured_to_semantic(batch))

        else:

            batch_ok += 1

            merged.extend(batch_result)



    logger.info(

        "semantic chunk ops ok (batched): filename=%s %d blocks → %d chunks (%d/%d batches ok)",

        filename,

        total_blocks,

        len(merged),

        batch_ok,

        (total_blocks + BATCH_BLOCK_SIZE - 1) // BATCH_BLOCK_SIZE,

    )

    return merged





def _merge_short_chunks(chunks: list[SemanticChunk]) -> list[SemanticChunk]:
    """
    合并同一 section 内过短（< MIN_CHUNK_CHARS）的相邻 chunk。

    参数:
        chunks: LLM 或规则切分结果

    返回:
        合并后的新列表（不修改入参对象语义，新建 SemanticChunk）
    """

    if not chunks:

        return []

    merged: list[SemanticChunk] = []

    buf: SemanticChunk | None = None

    for chunk in chunks:

        if buf is None:

            buf = SemanticChunk(

                content=chunk.content,

                section=chunk.section,

                heading=chunk.heading,

                chunk_summary=chunk.chunk_summary,

                tags=list(chunk.tags),

            )

            continue

        if len(buf.content) < MIN_CHUNK_CHARS and chunk.section == buf.section:

            buf.content = buf.content.rstrip() + "\n\n" + chunk.content.lstrip()

            if chunk.chunk_summary and not buf.chunk_summary:

                buf.chunk_summary = chunk.chunk_summary

            continue

        merged.append(buf)

        buf = SemanticChunk(

            content=chunk.content,

            section=chunk.section,

            heading=chunk.heading,

            chunk_summary=chunk.chunk_summary,

            tags=list(chunk.tags),

        )

    if buf:

        merged.append(buf)

    return merged





def _split_long_chunks(chunks: list[SemanticChunk]) -> list[SemanticChunk]:
    """
    对超过 MAX_CHUNK_CHARS 的 chunk 用 split_text 二次切分。

    参数:
        chunks: 可能含超长块的列表

    返回:
        长度受控的 SemanticChunk 列表，保留原 section/heading/summary/tags
    """

    out: list[SemanticChunk] = []

    for chunk in chunks:

        if len(chunk.content) <= MAX_CHUNK_CHARS:

            out.append(chunk)

            continue

        for piece in split_text(chunk.content, chunk_size=MAX_CHUNK_CHARS, overlap=CHUNK_OVERLAP):

            out.append(

                SemanticChunk(

                    content=piece,

                    section=chunk.section,

                    heading=chunk.heading,

                    chunk_summary=chunk.chunk_summary,

                    tags=list(chunk.tags),

                )

            )

    return out





def semantic_chunk_document(

    content: str,

    *,

    filename: str = "document",

    chunk_size: int = 400,

    overlap: int = 50,

) -> list[SemanticChunk]:
    """
    完整语义切分流水线 — indexing_pipeline 入口。

    参数:
        content: 文档全文
        filename: 文档名，传给 LLM Prompt
        chunk_size, overlap: 规则预切参数

    返回:
        SemanticChunk 列表；空内容返回 []

    副作用:
        SEMANTIC_CHUNK_ENABLED 且够长时调用 LLM；否则仅本地 split

    说明:
        SEMANTIC_CHUNK_ENABLED=0 时等价于 structured split + 长短归一化
    """

    text = content.strip()

    if not text:

        return []


    # 规则预切
    structured = split_text_structured(text, chunk_size=chunk_size, overlap=overlap)

    if not structured:

        return []



    if SEMANTIC_CHUNK_ENABLED and len(text) >= SEMANTIC_CHUNK_LLM_THRESHOLD:
        # LLM 语义切分
        chunks = _llm_refine_chunks(filename, structured)

    else:
        # 规则预切 fallback
        chunks = _structured_to_semantic(structured)



    chunks = _merge_short_chunks(chunks)

    chunks = _split_long_chunks(chunks)

    return chunks

