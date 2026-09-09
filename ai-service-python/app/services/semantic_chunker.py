"""Wave D1.6a — LLM 语义 chunk：结构化预切 → 块索引 ops → 过短合并/过长拆分。"""
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

MIN_CHUNK_CHARS = int(os.getenv("MIN_CHUNK_CHARS", "80"))
MAX_CHUNK_CHARS = int(os.getenv("MAX_CHUNK_CHARS", "600"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "50"))
SEMANTIC_CHUNK_ENABLED = os.getenv("SEMANTIC_CHUNK_ENABLED", "1").strip().lower() in (
    "1",
    "true",
    "yes",
    "on",
)
SEMANTIC_CHUNK_LLM_THRESHOLD = int(os.getenv("SEMANTIC_CHUNK_LLM_THRESHOLD", "200"))

BLOCK_PREVIEW_CHARS = int(os.getenv("SEMANTIC_BLOCK_PREVIEW_CHARS", "800"))
BATCH_BLOCK_SIZE = int(os.getenv("SEMANTIC_BATCH_BLOCK_SIZE", "20"))
BATCH_TEXT_CHAR_LIMIT = int(os.getenv("SEMANTIC_BATCH_TEXT_LIMIT", "8000"))
BATCH_BLOCK_COUNT_LIMIT = int(os.getenv("SEMANTIC_BATCH_BLOCK_COUNT", "40"))
SEMANTIC_CHUNK_MAX_TOKENS = int(os.getenv("SEMANTIC_CHUNK_MAX_TOKENS", "4096"))


@dataclass
class SemanticChunk:
    content: str
    section: str = "body"
    heading: str = ""
    chunk_summary: str = ""
    tags: list[str] = field(default_factory=list)


def _parse_json_array(raw: str) -> list[dict]:
    text = raw.strip()
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
    parts: list[str] = []
    for i, block in enumerate(structured):
        heading = block.heading or ""
        preview = block.content[:BLOCK_PREVIEW_CHARS]
        if len(block.content) > BLOCK_PREVIEW_CHARS:
            preview += "…"
        parts.append(
            f"[{i}] section={block.section}"
            + (f" heading={heading}" if heading else "")
            + f"\n{preview}"
        )
    return "\n\n".join(parts)


def _validate_chunk_ops(ops: list[dict], block_count: int) -> None:
    if block_count <= 0:
        raise ValueError("ops_invalid: no blocks")
    seen: set[int] = set()
    for item in ops:
        op = (item.get("op") or "").strip().lower()
        if op not in ("keep", "merge"):
            raise ValueError(f"ops_invalid: unknown op {op!r}")
        indices_raw = item.get("indices")
        if not isinstance(indices_raw, list) or not indices_raw:
            raise ValueError("ops_invalid: indices must be non-empty list")
        indices = [int(x) for x in indices_raw]
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
    return [
        SemanticChunk(content=c.content, section=c.section, heading=c.heading)
        for c in structured
    ]


def _log_chunk_failure(
    reason: str,
    *,
    filename: str,
    block_count: int,
    raw: str | None = None,
    exc: Exception | None = None,
) -> None:
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
    """单批 blocks 调 LLM ops；失败返回 None。"""
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
    """LLM 块索引 ops 合并预切块；超大文档分批。"""
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
    完整语义切分流水线。
    SEMANTIC_CHUNK_ENABLED=0 时等价于 structured split。
    """
    text = content.strip()
    if not text:
        return []

    structured = split_text_structured(text, chunk_size=chunk_size, overlap=overlap)
    if not structured:
        return []

    if SEMANTIC_CHUNK_ENABLED and len(text) >= SEMANTIC_CHUNK_LLM_THRESHOLD:
        chunks = _llm_refine_chunks(filename, structured)
    else:
        chunks = _structured_to_semantic(structured)

    chunks = _merge_short_chunks(chunks)
    chunks = _split_long_chunks(chunks)
    return chunks
