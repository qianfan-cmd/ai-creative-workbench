"""Wave D1 — RRF 融合与阈值过滤单元测试（无 Chroma / API 依赖）。"""
import os

os.environ["QUERY_REWRITE_ENABLED"] = "0"
os.environ["RERANK_ENABLED"] = "0"
os.environ["TAG_INFERENCE_ENABLED"] = "0"

from app.services.retrieval.langchain_retriever import (
    _passes_threshold,
    reciprocal_rank_fusion,
)


def test_rrf_merges_two_lists():
    fused = reciprocal_rank_fusion(
        [["a", "b", "c"], ["b", "d"]],
        [1.0, 1.0],
        rrf_k=60,
    )
    ids = [item[0] for item in fused]
    assert ids[0] == "b"
    assert "a" in ids and "d" in ids


def test_rrf_respects_weights():
    fused = reciprocal_rank_fusion(
        [["x"], ["y"]],
        [0.0, 1.0],
        rrf_k=60,
    )
    assert fused[0][0] == "y"


def test_threshold_accepts_tag_match():
    assert _passes_threshold("chunk-1", {}, set(), {"chunk-1"}, 1.35)


def test_threshold_bm25_only_rejects_weak_dense():
    assert not _passes_threshold("chunk-1", {"chunk-1": 2.0}, {"chunk-1"}, set(), 1.35)


def test_threshold_bm25_only_accepts_good_dense():
    assert _passes_threshold("chunk-1", {"chunk-1": 1.0}, {"chunk-1"}, set(), 1.35)


def test_threshold_rejects_weak_dense_only():
    assert not _passes_threshold("chunk-2", {"chunk-2": 2.0}, set(), set(), 1.35)


def test_threshold_accepts_good_dense():
    assert _passes_threshold("chunk-3", {"chunk-3": 0.8}, set(), set(), 1.35)
