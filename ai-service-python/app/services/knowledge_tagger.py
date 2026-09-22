"""
知识库 AI 打标 — RAG 索引阶段元数据 enrichment。

为文档与 chunk 生成标签，写入 Chroma metadata.tags，供检索侧
tag_directed_search 与 query 标签推断复用词表。

失败时不阻塞入库，返回空标签。
"""
from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass, field

from app.services.llm_service import chat_with_llm
from app.services.rag_prompts import document_tag_prompt
from app.services.semantic_chunker import SemanticChunk

logger = logging.getLogger(__name__)

# 是否启用 AI 打标；关闭时直接返回原 chunks
TAGGING_ENABLED = os.getenv("TAGGING_ENABLED", "1").strip().lower() in ("1", "true", "yes", "on")
# 单标签最大字符数
MAX_TAG_LEN = 8
# 文档级标签上限
MAX_DOC_TAGS = 8
# 每个 chunk 标签上限
MAX_CHUNK_TAGS = 3


@dataclass
class TaggingResult:
    """打标结果 — document_tags 供 API 返回；chunks 为写入 metadata 的带 tag 副本。"""

    document_tags: list[str] = field(default_factory=list)
    chunks: list[SemanticChunk] = field(default_factory=list)


def _parse_tagging_json(raw: str) -> dict:
    """解析 LLM 打标 JSON — 支持 markdown fence。"""
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    return json.loads(text)


def _normalize_tags(tags: list[str], *, limit: int, vocabulary: list[str] | None = None) -> list[str]:
    """
    规范化标签列表 — 去重、截长、优先复用已有词表。

    参数:
        tags: 原始标签
        limit: 返回上限
        vocabulary: 可选已有词表，命中项排在前面

    返回:
        规范化后的标签列表
    """
    vocab = {v.strip() for v in (vocabulary or []) if v and v.strip()}
    seen: set[str] = set()
    out: list[str] = []
    for tag in tags:
        t = (tag or "").strip()[:MAX_TAG_LEN]
        if not t or t in seen:
            continue
        seen.add(t)
        out.append(t)
        if len(out) >= limit:
            break
    # 优先复用已有词表
    if vocab:
        preferred = [t for t in out if t in vocab]
        rest = [t for t in out if t not in vocab]
        out = (preferred + rest)[:limit]
    return out


def tag_document_and_chunks(
    filename: str,
    chunks: list[SemanticChunk],
    *,
    existing_vocabulary: list[str] | None = None,
) -> TaggingResult:
    """
    为文档与 chunk 打标签 — indexing_pipeline 在 embed 前调用。

    参数:
        filename: 文档名
        chunks: semantic_chunker 产出
        existing_vocabulary: 可选，list_all_tags 结果，引导 LLM 复用

    返回:
        TaggingResult：document_tags + 带 tags 字段的 chunks

    副作用:
        调用 chat_with_llm；失败时 logger.warning，返回空标签不阻塞入库
    """
    if not TAGGING_ENABLED or not chunks:
        return TaggingResult(document_tags=[], chunks=chunks)

    vocab_hint = ""
    if existing_vocabulary:
        sample = existing_vocabulary[:50]
        vocab_hint = f"\n已有标签词表（优先复用）：{', '.join(sample)}"

    preview = "\n\n".join(
        f"[{i}] {c.content[:300]}" for i, c in enumerate(chunks[:12])
    )
    prompt = document_tag_prompt(filename, preview, vocab_hint)

    try:
        raw = chat_with_llm(prompt)
        parsed = _parse_tagging_json(raw)
        doc_tags = _normalize_tags(
            parsed.get("document_tags") or [],
            limit=MAX_DOC_TAGS,
            vocabulary=existing_vocabulary,
        )
        chunk_tag_map: dict[int, list[str]] = {}
        for item in parsed.get("chunk_tags") or []:
            idx = item.get("index")
            if idx is None:
                continue
            chunk_tag_map[int(idx)] = _normalize_tags(
                item.get("tags") or [],
                limit=MAX_CHUNK_TAGS,
                vocabulary=existing_vocabulary,
            )

        tagged: list[SemanticChunk] = []
        for i, chunk in enumerate(chunks):
            chunk_tags = list(chunk.tags)
            extra = chunk_tag_map.get(i, [])
            merged = _normalize_tags(chunk_tags + extra + doc_tags[:1], limit=MAX_CHUNK_TAGS)
            tagged.append(
                SemanticChunk(
                    content=chunk.content,
                    section=chunk.section,
                    heading=chunk.heading,
                    chunk_summary=chunk.chunk_summary,
                    tags=merged,
                )
            )
        return TaggingResult(document_tags=doc_tags, chunks=tagged)
    except Exception as exc:
        logger.warning("AI tagging failed for %s: %s", filename, exc)
        return TaggingResult(document_tags=[], chunks=chunks)
