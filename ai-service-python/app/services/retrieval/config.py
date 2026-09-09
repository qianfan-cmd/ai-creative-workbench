"""混合检索可调参数 — 通过环境变量覆盖。"""
from __future__ import annotations

import os


def _int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    return int(raw)


def _float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    return float(raw)


def _bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


RETRIEVE_CANDIDATES = _int("RETRIEVE_CANDIDATES", 30)
FINAL_TOP_K = _int("FINAL_TOP_K", 6)
DEFAULT_TOP_K = _int("DEFAULT_TOP_K", 6)
DISTANCE_THRESHOLD = _float("DISTANCE_THRESHOLD", 1.35)
RRF_K = _int("RRF_K", 60)
BM25_WEIGHT = _float("BM25_WEIGHT", 1.0)
DENSE_WEIGHT = _float("DENSE_WEIGHT", 1.0)

QUERY_REWRITE_ENABLED = _bool("QUERY_REWRITE_ENABLED", True)
RERANK_ENABLED = _bool("RERANK_ENABLED", True)
# 默认 base（~1.1GB）；生产/评测可 env 覆盖为 BAAI/bge-reranker-v2-m3
RERANK_MODEL = os.getenv("RERANK_MODEL", "BAAI/bge-reranker-base")
RERANK_MAX_CHARS = _int("RERANK_MAX_CHARS", 384)

MAX_CHUNKS_PER_SOURCE = _int("MAX_CHUNKS_PER_SOURCE", 2)
MAX_CHUNKS_PER_SOURCE_LIST = _int("MAX_CHUNKS_PER_SOURCE_LIST", 4)
MAX_CHUNKS_PER_SOURCE_PROCEDURE = _int("MAX_CHUNKS_PER_SOURCE_PROCEDURE", 4)

TAG_INFERENCE_ENABLED = _bool("TAG_INFERENCE_ENABLED", True)
TAG_WEIGHT = _float("TAG_WEIGHT", 1.2)
RERANK_MIN_SCORE = _float("RERANK_MIN_SCORE", -1.0)
TAG_MATCH_BOOST = _float("TAG_MATCH_BOOST", 0.15)
PENALTY_WEIGHT = _float("PENALTY_WEIGHT", 0.3)
BOOST_WEIGHT = _float("BOOST_WEIGHT", 0.2)
SOURCE_PENALTY_WEIGHT = _float("SOURCE_PENALTY_WEIGHT", 0.5)
SOURCE_BOOST_WEIGHT = _float("SOURCE_BOOST_WEIGHT", 0.5)
FILENAME_MATCH_BOOST = _float("FILENAME_MATCH_BOOST", 0.15)
ANCHOR_FILENAME_BONUS = _float("ANCHOR_FILENAME_BONUS", 1.0)
ANCHOR_SECONDARY_SCORE_RATIO = _float("ANCHOR_SECONDARY_SCORE_RATIO", 0.85)
FEEDBACK_AUTO_FIX = _bool("FEEDBACK_AUTO_FIX", True)
