"""
BM25 内存索引 — 与 Chroma 同步（rank_bm25）。
入库/删除后 invalidate，下次检索时 lazy rebuild。
"""
from __future__ import annotations

import re
import threading
from typing import Any

from rank_bm25 import BM25Okapi

from app.services.vector_store import list_all_chunks

_lock = threading.Lock()
_cache_valid = False
_cached_corpus_ids: list[str] = []
_cached_chunk_map: dict[str, dict[str, Any]] = {}
_cached_bm25: BM25Okapi | None = None


def invalidate_bm25_cache() -> None:
    """Chroma 写入/删除后调用，使 BM25 下次检索时重建。"""
    global _cache_valid
    with _lock:
        _cache_valid = False


def _tokenize(text: str) -> list[str]:
    """中英文混合粗分词 — 字母数字连续段 + 单 CJK 字。"""
    if not text:
        return []
    tokens: list[str] = []
    for part in re.findall(r"[A-Za-z0-9_\-]+|[\u4e00-\u9fff]", text):
        tokens.append(part.lower())
    return tokens


def _rebuild_index() -> None:
    global _cached_bm25, _cached_corpus_ids, _cached_chunk_map, _cache_valid
    chunks = list_all_chunks()
    if not chunks:
        _cached_bm25 = None
        _cached_corpus_ids = []
        _cached_chunk_map = {}
        _cache_valid = True
        return

    _cached_chunk_map = {item["id"]: item for item in chunks}
    _cached_corpus_ids = list(_cached_chunk_map.keys())

    def _bm25_doc_text(item: dict[str, Any]) -> str:
        parts = [
            str(item.get("source") or ""),
            str(item.get("heading") or ""),
            str(item.get("chunk_summary") or ""),
            str(item.get("content") or ""),
        ]
        return " ".join(p for p in parts if p.strip())

    tokenized = [_tokenize(_bm25_doc_text(_cached_chunk_map[cid])) for cid in _cached_corpus_ids]
    _cached_bm25 = BM25Okapi(tokenized)
    _cache_valid = True


def _ensure_index() -> None:
    with _lock:
        if not _cache_valid:
            _rebuild_index()


def bm25_search(query: str, top_k: int) -> list[dict[str, Any]]:
    """
    BM25 检索，返回与 vector_store.search_similar 对齐的结构（无 distance）。
    """
    _ensure_index()
    if _cached_bm25 is None or not _cached_corpus_ids:
        return []

    scores = _cached_bm25.get_scores(_tokenize(query))
    ranked = sorted(
        zip(_cached_corpus_ids, scores),
        key=lambda pair: pair[1],
        reverse=True,
    )[:top_k]

    hits: list[dict[str, Any]] = []
    for chunk_id, score in ranked:
        if score <= 0:
            continue
        item = _cached_chunk_map.get(chunk_id)
        if not item:
            continue
        hits.append(
            {
                "id": chunk_id,
                "content": item["content"],
                "source": item.get("source"),
                "index": item.get("index"),
                "section": item.get("section"),
                "heading": item.get("heading"),
                "tags": item.get("tags"),
                "chunk_summary": item.get("chunk_summary"),
                "distance": None,
                "bm25_score": score,
                "retrieval_source": "bm25",
            }
        )
    return hits
