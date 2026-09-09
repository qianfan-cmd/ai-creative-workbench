"""
LangChain 混合检索 — Dense + BM25 + Tag + 多 Query RRF + Rerank + 证据选取。

Wave D1.7：标签定向召回 + 通用硬过滤（无关键词规则）。
"""
from __future__ import annotations

from typing import Any

from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever

from app.services.embedding_service import embed_text
from app.services.retrieval.bm25_index import bm25_search
from app.services.retrieval.config import (
    BM25_WEIGHT,
    DENSE_WEIGHT,
    DISTANCE_THRESHOLD,
    FINAL_TOP_K,
    RETRIEVE_CANDIDATES,
    RERANK_MIN_SCORE,
    RRF_K,
    TAG_MATCH_BOOST,
    TAG_WEIGHT,
)
from app.services.retrieval.context_selector import (
    dedupe_adjacent_candidates,
    expand_adjacent_chunks,
    select_context,
)
from app.services.retrieval.query_intent import is_procedure_intent
from app.services.retrieval.source_anchor import pick_anchor_sources
from app.services.retrieval.query_rewriter import collect_search_queries, rewrite_query
from app.services.retrieval.rag_trace import RagTrace
from app.services.retrieval.reranker import rerank_hits
from app.services.retrieval.tag_retriever import infer_query_tags, tag_directed_search
from app.services.vector_store import search_similar


def reciprocal_rank_fusion(
    ranked_lists: list[list[str]],
    weights: list[float],
    *,
    rrf_k: int = RRF_K,
) -> list[tuple[str, float]]:
    scores: dict[str, float] = {}
    for ranked, weight in zip(ranked_lists, weights):
        if weight <= 0:
            continue
        for rank, chunk_id in enumerate(ranked, start=1):
            if not chunk_id:
                continue
            scores[chunk_id] = scores.get(chunk_id, 0.0) + weight / (rrf_k + rank)
    return sorted(scores.items(), key=lambda item: item[1], reverse=True)


class ChromaDenseRetriever(BaseRetriever):
    top_k: int = RETRIEVE_CANDIDATES

    def _get_relevant_documents(self, query: str) -> list[Document]:
        vector = embed_text(query)
        hits = search_similar(vector, top_k=self.top_k)
        docs: list[Document] = []
        for hit in hits:
            meta = {
                "chunk_id": hit.get("id"),
                "source": hit.get("source"),
                "index": hit.get("index"),
                "distance": hit.get("distance"),
                "section": hit.get("section"),
                "heading": hit.get("heading"),
                "tags": hit.get("tags"),
            }
            docs.append(Document(page_content=hit["content"], metadata=meta))
        return docs


def _chunk_lookup(
    dense_hits: list[dict[str, Any]],
    bm25_hits: list[dict[str, Any]],
    tag_hits: list[dict[str, Any]] | None = None,
) -> dict[str, dict[str, Any]]:
    by_id: dict[str, dict[str, Any]] = {}
    for hit in dense_hits:
        chunk_id = hit.get("id")
        if not chunk_id:
            continue
        by_id[chunk_id] = {**hit, "retrieval_source": "dense"}
    for hit in bm25_hits:
        chunk_id = hit.get("id")
        if not chunk_id:
            continue
        if chunk_id in by_id:
            by_id[chunk_id]["retrieval_source"] = "hybrid"
        else:
            by_id[chunk_id] = {**hit, "retrieval_source": "bm25"}
    for hit in tag_hits or []:
        chunk_id = hit.get("id")
        if not chunk_id:
            continue
        if chunk_id in by_id:
            src = by_id[chunk_id].get("retrieval_source")
            by_id[chunk_id]["retrieval_source"] = "hybrid+tag" if src else "tag"
        else:
            by_id[chunk_id] = {**hit, "retrieval_source": "tag"}
    return by_id


def _tag_overlap_count(chunk_tags_raw: Any, inferred_tags: set[str]) -> int:
    if not inferred_tags:
        return 0
    raw = str(chunk_tags_raw or "")
    chunk_tags = {p.strip() for p in raw.split(",") if p.strip()}
    return len(inferred_tags & chunk_tags)


def _passes_threshold(
    chunk_id: str,
    dense_distances: dict[str, float | None],
    bm25_ids: set[str],
    tag_ids: set[str],
    threshold: float,
) -> bool:
    dist = dense_distances.get(chunk_id)
    if chunk_id in tag_ids:
        return True
    if chunk_id in bm25_ids:
        # BM25-only：须仍有 dense 距离且未超阈值，或后续 rerank 兜底
        if dist is None:
            return False
        return dist <= threshold * 1.1
    if dist is None:
        return False
    return dist <= threshold


def _filter_by_rerank_score(hits: list[dict[str, Any]], min_score: float) -> list[dict[str, Any]]:
    if min_score <= -999:
        return hits
    return [h for h in hits if h.get("rerank_score", 0.0) >= min_score]


def _hybrid_search_single_query(
    question: str,
    *,
    retrieve_candidates: int,
) -> tuple[list[tuple[str, float]], dict[str, dict[str, Any]], set[str], dict[str, float | None]]:
    q = question.strip()
    if not q:
        return [], {}, set(), {}

    dense_retriever = ChromaDenseRetriever(top_k=retrieve_candidates)
    dense_docs = dense_retriever.invoke(q)
    dense_hits = [
        {
            "id": (doc.metadata or {}).get("chunk_id"),
            "content": doc.page_content,
            "source": (doc.metadata or {}).get("source"),
            "index": (doc.metadata or {}).get("index"),
            "distance": (doc.metadata or {}).get("distance"),
            "section": (doc.metadata or {}).get("section"),
            "heading": (doc.metadata or {}).get("heading"),
            "tags": (doc.metadata or {}).get("tags"),
        }
        for doc in dense_docs
    ]
    bm25_hits = bm25_search(q, top_k=retrieve_candidates)
    if not dense_hits and not bm25_hits:
        return [], {}, set(), {}

    dense_ranked = [h["id"] for h in dense_hits if h.get("id")]
    bm25_ranked = [h["id"] for h in bm25_hits if h.get("id")]
    bm25_ids = set(bm25_ranked)
    fused = reciprocal_rank_fusion([dense_ranked, bm25_ranked], [DENSE_WEIGHT, BM25_WEIGHT])
    chunk_map = _chunk_lookup(dense_hits, bm25_hits)
    dense_distances = {h["id"]: h.get("distance") for h in dense_hits if h.get("id")}
    return fused, chunk_map, bm25_ids, dense_distances


def hybrid_search(
    question: str,
    *,
    top_k: int | None = None,
    retrieve_candidates: int | None = None,
    trace: RagTrace | None = None,
) -> list[dict[str, Any]]:
    q = question.strip()
    if not q:
        return []

    candidates_n = retrieve_candidates or RETRIEVE_CANDIDATES
    final_k = max(1, top_k or FINAL_TOP_K)

    tag_inference = infer_query_tags(q)
    inferred_tags = set(tag_inference.tags)
    requires_exhaustive = tag_inference.requires_exhaustive
    procedure_intent = is_procedure_intent(q)

    rewrite = rewrite_query(q)
    search_queries = collect_search_queries(q, rewrite)
    if trace:
        trace.set("original_query", q)
        trace.set("rewritten_queries", search_queries)
        trace.set("inferred_tags", list(inferred_tags))
        trace.set("requires_exhaustive", requires_exhaustive)
        trace.set("procedure_intent", procedure_intent)

    tag_hits = tag_directed_search(list(inferred_tags), top_k=candidates_n) if inferred_tags else []
    tag_ranked = [h["id"] for h in tag_hits if h.get("id")]
    tag_ids = set(tag_ranked)

    merged_scores: dict[str, float] = {}
    chunk_map: dict[str, dict[str, Any]] = {}
    bm25_ids: set[str] = set()
    dense_distances: dict[str, float | None] = {}

    if tag_ranked:
        tag_fused = reciprocal_rank_fusion([tag_ranked], [TAG_WEIGHT])
        for chunk_id, score in tag_fused:
            merged_scores[chunk_id] = merged_scores.get(chunk_id, 0.0) + score
        chunk_map.update(_chunk_lookup([], [], tag_hits))

    for sq in search_queries:
        fused, cmap, b_ids, d_dist = _hybrid_search_single_query(sq, retrieve_candidates=candidates_n)
        for chunk_id, score in fused:
            merged_scores[chunk_id] = merged_scores.get(chunk_id, 0.0) + score
        chunk_map.update(cmap)
        bm25_ids.update(b_ids)
        for cid, dist in d_dist.items():
            if cid not in dense_distances or dist is not None:
                dense_distances[cid] = dist

    if not merged_scores:
        if trace:
            trace.set("candidate_count", 0)
            trace.set("tag_recall_count", len(tag_hits))
        return []

    fused_all = sorted(merged_scores.items(), key=lambda x: x[1], reverse=True)
    if trace:
        trace.set("candidate_count", len(fused_all))
        trace.set("tag_recall_count", len(tag_hits))

    pre_threshold: list[dict[str, Any]] = []
    for chunk_id, rrf_score in fused_all:
        if chunk_id not in chunk_map:
            continue
        if not _passes_threshold(chunk_id, dense_distances, bm25_ids, tag_ids, DISTANCE_THRESHOLD):
            continue
        item = dict(chunk_map[chunk_id])
        item["rrf_score"] = rrf_score
        if inferred_tags:
            overlap = _tag_overlap_count(item.get("tags"), inferred_tags)
            if overlap:
                item["tag_overlap"] = overlap
                item["rrf_score"] = rrf_score + TAG_MATCH_BOOST * overlap
        pre_threshold.append(item)

    pre_threshold.sort(key=lambda x: x.get("rrf_score", 0.0), reverse=True)

    if trace:
        trace.set("after_threshold_count", len(pre_threshold))

    deduped = dedupe_adjacent_candidates(pre_threshold)
    reranked = rerank_hits(q, deduped, inferred_tags=list(inferred_tags))
    reranked = _filter_by_rerank_score(reranked, RERANK_MIN_SCORE)

    if trace:
        trace.set("after_rerank_filter_count", len(reranked))
        if reranked:
            trace.set(
                "rerank_top_scores",
                [
                    {"id": h.get("id"), "score": h.get("rerank_score")}
                    for h in reranked[: min(6, len(reranked))]
                ],
            )

    anchor_sources = pick_anchor_sources(reranked, q) if reranked else []
    if trace:
        trace.set("anchor_sources", anchor_sources)

    results = select_context(
        reranked,
        top_k=final_k,
        requires_exhaustive=requires_exhaustive,
        procedure_intent=procedure_intent,
        query=q,
        anchor_mode=not requires_exhaustive,
    )
    if procedure_intent or requires_exhaustive:
        results = expand_adjacent_chunks(results, reranked, max_total=final_k)
    if trace:
        trace.set("final_count", len(results))
        trace.set(
            "distinct_sources_in_final",
            sorted({str(h.get("source") or "") for h in results if h.get("source")}),
        )
    return results
