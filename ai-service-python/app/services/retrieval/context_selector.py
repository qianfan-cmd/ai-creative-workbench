"""证据选取 — 同文档多 chunk 保留 + 主体锚定（Wave D1.5e / D1.8）。"""
from __future__ import annotations

from typing import Any

from app.services.retrieval.config import (
    ANCHOR_SECONDARY_SCORE_RATIO,
    MAX_CHUNKS_PER_SOURCE,
    MAX_CHUNKS_PER_SOURCE_LIST,
    MAX_CHUNKS_PER_SOURCE_PROCEDURE,
)
from app.services.retrieval.source_anchor import pick_anchor_sources


def _is_adjacent_duplicate(candidate: dict[str, Any], selected: list[dict[str, Any]]) -> bool:
    src = candidate.get("source")
    idx = candidate.get("index")
    if src is None or idx is None:
        return False
    for item in selected:
        if item.get("source") != src:
            continue
        other = item.get("index")
        if other is None:
            continue
        if abs(int(idx) - int(other)) <= 1:
            return True
    return False


def dedupe_adjacent_candidates(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen_content: set[str] = set()
    out: list[dict[str, Any]] = []
    for hit in candidates:
        content = (hit.get("content") or "").strip()
        if not content or content in seen_content:
            continue
        seen_content.add(content)
        out.append(hit)
    return out


def expand_adjacent_chunks(
    selected: list[dict[str, Any]],
    pool: list[dict[str, Any]],
    *,
    max_total: int,
) -> list[dict[str, Any]]:
    pool_by_src_idx: dict[tuple[str, int], dict[str, Any]] = {}
    for hit in pool:
        src = hit.get("source")
        idx = hit.get("index")
        if src is None or idx is None:
            continue
        pool_by_src_idx[(str(src), int(idx))] = hit

    out = list(selected)
    seen_ids = {h.get("id") for h in out if h.get("id")}

    for hit in list(selected):
        src = str(hit.get("source") or "")
        idx = hit.get("index")
        if idx is None:
            continue
        for delta in (-1, 1):
            if len(out) >= max_total:
                return out
            neighbor = pool_by_src_idx.get((src, int(idx) + delta))
            if not neighbor:
                continue
            nid = neighbor.get("id")
            if not nid or nid in seen_ids:
                continue
            out.append(neighbor)
            seen_ids.add(nid)
    return out


def _select_from_sources(
    candidates: list[dict[str, Any]],
    *,
    allowed_sources: set[str] | None,
    top_k: int,
    max_per_source: int,
    skip_adjacent: bool,
) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    per_source: dict[str, int] = {}

    for hit in candidates:
        src = str(hit.get("source") or "")
        if allowed_sources is not None and src not in allowed_sources:
            continue
        if per_source.get(src, 0) >= max_per_source:
            continue
        if skip_adjacent and _is_adjacent_duplicate(hit, selected):
            continue
        selected.append(hit)
        per_source[src] = per_source.get(src, 0) + 1
        if len(selected) >= top_k:
            break
    return selected


def select_context(
    candidates: list[dict[str, Any]],
    *,
    top_k: int,
    list_intent: bool = False,
    requires_exhaustive: bool = False,
    procedure_intent: bool = False,
    query: str | None = None,
    anchor_mode: bool = True,
) -> list[dict[str, Any]]:
    exhaustive = requires_exhaustive or list_intent
    if procedure_intent:
        max_per_source = MAX_CHUNKS_PER_SOURCE_PROCEDURE
        skip_adjacent = False
    elif exhaustive:
        max_per_source = MAX_CHUNKS_PER_SOURCE_LIST
        skip_adjacent = False
    else:
        max_per_source = MAX_CHUNKS_PER_SOURCE
        skip_adjacent = True

    use_anchor = anchor_mode and query and not exhaustive

    if use_anchor:
        anchors = pick_anchor_sources(candidates, query, top_n=2)
        if anchors:
            primary = _select_from_sources(
                candidates,
                allowed_sources={anchors[0]},
                top_k=top_k,
                max_per_source=max_per_source,
                skip_adjacent=skip_adjacent,
            )
            if len(primary) >= top_k:
                return primary

            selected = list(primary)
            seen_ids = {h.get("id") for h in selected if h.get("id")}
            primary_best = max(
                (float(h.get("rerank_score", 0.0)) for h in primary),
                default=0.0,
            )

            for hit in candidates:
                if len(selected) >= top_k:
                    break
                src = str(hit.get("source") or "")
                if src in anchors:
                    continue
                score = float(hit.get("rerank_score", 0.0))
                if primary_best > 0 and score < primary_best * ANCHOR_SECONDARY_SCORE_RATIO:
                    continue
                hid = hit.get("id")
                if hid and hid in seen_ids:
                    continue
                per_src = sum(1 for h in selected if str(h.get("source") or "") == src)
                if per_src >= max_per_source:
                    continue
                if skip_adjacent and _is_adjacent_duplicate(hit, selected):
                    continue
                selected.append(hit)
                if hid:
                    seen_ids.add(hid)
            return selected

    return _select_from_sources(
        candidates,
        allowed_sources=None,
        top_k=top_k,
        max_per_source=max_per_source,
        skip_adjacent=skip_adjacent,
    )
