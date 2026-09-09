"""主体锚定 — 按文档聚合得分，优先主文档 chunk（Wave D1.8）。"""
from __future__ import annotations

import re
from typing import Any

from app.services.retrieval.config import (
    ANCHOR_FILENAME_BONUS,
    ANCHOR_SECONDARY_SCORE_RATIO,
    FILENAME_MATCH_BOOST,
)


def tokenize_for_match(text: str) -> set[str]:
    if not text:
        return set()
    tokens: set[str] = set()
    for part in re.findall(r"[A-Za-z0-9_\-]{2,}|[\u4e00-\u9fff]{2,}", text):
        tokens.add(part.lower())
    return tokens


def filename_overlap_boost(query: str, source: str | None) -> float:
    if not source:
        return 0.0
    q_tokens = tokenize_for_match(query)
    if not q_tokens:
        return 0.0
    src_tokens = tokenize_for_match(source)
    overlap = len(q_tokens & src_tokens)
    if overlap == 0:
        return 0.0
    return FILENAME_MATCH_BOOST * overlap


def rerank_text_for_hit(hit: dict[str, Any]) -> str:
    from app.services.embed_text_builder import build_embed_text

    return build_embed_text(
        filename=str(hit.get("source") or ""),
        heading=str(hit.get("heading") or ""),
        chunk_summary=str(hit.get("chunk_summary") or ""),
        content=str(hit.get("content") or ""),
    )


def score_source(query: str, source: str, chunks: list[dict[str, Any]]) -> float:
    if not chunks:
        return 0.0
    best_rerank = max(float(c.get("rerank_score", 0.0)) for c in chunks)
    fname_boost = filename_overlap_boost(query, source)
    if fname_boost > 0:
        return best_rerank + ANCHOR_FILENAME_BONUS + fname_boost
    return best_rerank


def pick_anchor_sources(
    candidates: list[dict[str, Any]],
    query: str,
    *,
    top_n: int = 2,
) -> list[str]:
    by_source: dict[str, list[dict[str, Any]]] = {}
    for hit in candidates:
        src = str(hit.get("source") or "")
        if not src:
            continue
        by_source.setdefault(src, []).append(hit)

    if not by_source:
        return []

    ranked = sorted(
        ((src, score_source(query, src, chunks)) for src, chunks in by_source.items()),
        key=lambda item: item[1],
        reverse=True,
    )
    if not ranked:
        return []

    anchors = [ranked[0][0]]
    if top_n > 1 and len(ranked) > 1:
        primary_score = ranked[0][1]
        for src, score in ranked[1:top_n]:
            if primary_score > 0 and score >= primary_score * ANCHOR_SECONDARY_SCORE_RATIO:
                anchors.append(src)
    return anchors
