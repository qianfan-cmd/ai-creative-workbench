"""
LangChain 混合检索 — RAG 检索阶段核心编排。

多路召回：Dense（Chroma）+ BM25 + Tag 定向 → 多 Query RRF 融合 →
距离阈值过滤 → Rerank → context_selector 证据选取（含邻块扩展）。

``hybrid_search`` 为 rag_service._retrieve_context 的唯一检索入口。
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
    """
    Reciprocal Rank Fusion — 融合多路有序 chunk_id 列表为统一得分。

    参数:
        ranked_lists: 各路检索结果的 chunk_id 排名列表
        weights: 与 ranked_lists 等长的通道权重
        rrf_k: RRF 平滑常数

    返回:
        (chunk_id, score) 按 score 降序

    副作用:
        无
    """
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
    """LangChain Retriever 适配器 — 封装 embed + search_similar 稠密通路。"""

    top_k: int = RETRIEVE_CANDIDATES

    def _get_relevant_documents(self, query: str) -> list[Document]:
        """
        稠密检索 — LangChain BaseRetriever 接口实现。

        参数:
            query: 检索问句（单条）

        返回:
            Document 列表，metadata 含 chunk_id、distance、tags 等

        副作用:
            调用 embedding API 与 Chroma query
        """
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
    """
    合并多路 hit 为 chunk_id → 完整字段映射，标注 retrieval_source。

    参数:
        dense_hits, bm25_hits, tag_hits: 各路原始 hit 列表

    返回:
        dict[chunk_id, hit_dict]，后者含 retrieval_source: dense|bm25|tag|hybrid*
    """
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
    """计算 chunk metadata.tags 与推断标签的交集大小 — 用于 RRF 加分。"""
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
    """
    候选 chunk 是否通过距离/通道硬过滤。

    tag 命中直接放行；bm25-only 须 dense 距离存在且放宽阈值；纯 dense 用 DISTANCE_THRESHOLD。
    """
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
    """按 rerank_score 下限过滤；min_score <= -999 时跳过过滤（调试）。"""
    if min_score <= -999:
        return hits
    return [h for h in hits if h.get("rerank_score", 0.0) >= min_score]


def _hybrid_search_single_query(
    question: str,
    *,
    retrieve_candidates: int,
) -> tuple[list[tuple[str, float]], dict[str, dict[str, Any]], set[str], dict[str, float | None]]:
    """
    单条 query 的 Dense+BM25 混合检索 — 不含 tag 与多 query 合并。

    返回:
        (fused_rrf, chunk_map, bm25_id_set, dense_distances)

    副作用:
        embedding API、Chroma、BM25 内存索引
    """
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
    """
    混合检索主入口 — rag_service 检索阶段的唯一对外函数。

    流程:
        infer_query_tags → rewrite_query → tag 召回 + 多 query Dense/BM25 RRF →
        阈值过滤 → dedupe → rerank → select_context（+ 可选邻块扩展）

    参数:
        question: 用户问题
        top_k: 最终返回 chunk 数
        retrieve_candidates: 每路召回候选上限
        trace: 可选，填充各阶段计数与中间结果

    返回:
        hit dict 列表，含 content、source、rrf_score、rerank_score 等

    副作用:
        多次 LLM（改写/标签）、embedding、BM25、reranker；只读向量库
    """
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
