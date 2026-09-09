"""Wave D1.6b — 入库 AI 自动打标（文档级 + chunk 级）。"""
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

TAGGING_ENABLED = os.getenv("TAGGING_ENABLED", "1").strip().lower() in ("1", "true", "yes", "on")
MAX_TAG_LEN = 8
MAX_DOC_TAGS = 8
MAX_CHUNK_TAGS = 3


@dataclass
class TaggingResult:
    document_tags: list[str] = field(default_factory=list)
    chunks: list[SemanticChunk] = field(default_factory=list)


def _parse_tagging_json(raw: str) -> dict:
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    return json.loads(text)


def _normalize_tags(tags: list[str], *, limit: int, vocabulary: list[str] | None = None) -> list[str]:
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
    """为文档与 chunk 打标签；失败时返回空标签不阻塞入库。"""
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
