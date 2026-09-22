"""
BM25 稀疏检索内存索引 — hybrid_search 的 BM25 通路。

从 Chroma list_all_chunks 构建 rank_bm25 索引，进程内缓存。
vector_store 写入/删除后 invalidate，下次 bm25_search 时 lazy rebuild。
"""
from __future__ import annotations

import re
import threading
from typing import Any

from rank_bm25 import BM25Okapi

from app.services.vector_store import list_all_chunks

# 重建索引时的线程锁，避免并发 double rebuild
_lock = threading.Lock()
# False 表示缓存已失效，下次检索须 _rebuild_index
_cache_valid = False
# 语料 chunk_id 顺序，与 BM25Okapi 内部矩阵行对齐
_cached_corpus_ids: list[str] = []
# chunk_id → 完整 chunk dict，检索时还原 content/metadata
_cached_chunk_map: dict[str, dict[str, Any]] = {}
# rank_bm25 索引实例；语料为空时为 None
_cached_bm25: BM25Okapi | None = None


def invalidate_bm25_cache() -> None:
    """
    使 BM25 缓存失效 — vector_store 入库/删除后调用。

    副作用:
        置 _cache_valid=False；不立即 rebuild，由 bm25_search lazy 触发
    """
    global _cache_valid
    with _lock:
        _cache_valid = False


def _tokenize(text: str) -> list[str]:
    """
    中英文混合粗分词 — BM25 索引与 query 共用。

    规则：连续字母数字段 + 单个 CJK 字符；英文转小写。

    返回:
        token 列表
    """
    if not text:
        return []
    tokens: list[str] = []
    for part in re.findall(r"[A-Za-z0-9_\-]+|[\u4e00-\u9fff]", text):
        tokens.append(part.lower())
    return tokens


def _rebuild_index() -> None:
    """
    从 Chroma 全量 chunk 重建 BM25 索引 — 须在 _lock 内调用。

    文档文本 = source + heading + chunk_summary + content 拼接。

    副作用:
        更新 _cached_* 全局变量并置 _cache_valid=True
    """
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
        """拼接单 chunk 的 BM25 索引字段为一条文档字符串。"""
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
    """
    保证 BM25 索引可用 — 缓存失效时在锁内 rebuild。

    副作用:
        可能触发 list_all_chunks 与 BM25Okapi 构建
    """
    with _lock:
        if not _cache_valid:
            _rebuild_index()


def bm25_search(query: str, top_k: int) -> list[dict[str, Any]]:
    """
    BM25 稀疏检索 — hybrid_search 单 query 的 BM25 通路。

    参数:
        query: 检索问句
        top_k: 返回上限

    返回:
        与 search_similar 结构对齐的 hit 列表；含 bm25_score，distance 为 None

    副作用:
        可能 lazy rebuild 索引；只读缓存语料
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
