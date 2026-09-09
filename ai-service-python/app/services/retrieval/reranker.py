"""本地 BGE Cross-Encoder Rerank + chunk/source 反馈信号（Wave D1.5d / D3.5 / D1.8）。"""
from __future__ import annotations

import logging
import threading
from typing import Any

from app.services.chunk_signal_client import get_chunk_signals
from app.services.retrieval.config import (
    BOOST_WEIGHT,
    PENALTY_WEIGHT,
    RERANK_ENABLED,
    RERANK_MAX_CHARS,
    RERANK_MODEL,
    SOURCE_BOOST_WEIGHT,
    SOURCE_PENALTY_WEIGHT,
    TAG_MATCH_BOOST,
)
from app.services.retrieval.source_anchor import filename_overlap_boost, rerank_text_for_hit
from app.services.source_signal_client import get_source_signals

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_cross_encoder = None
_warmup_started = False
_warmup_ready = False
_warmup_failed = False


def _snapshot_cached(model_id: str) -> bool:
    try:
        from huggingface_hub import try_to_load_from_cache

        return try_to_load_from_cache(model_id, "config.json") is not None
    except Exception:
        return False


def _get_cross_encoder():
    global _cross_encoder
    with _lock:
        if _cross_encoder is None:
            from sentence_transformers import CrossEncoder

            local_only = _snapshot_cached(RERANK_MODEL)
            if local_only:
                logger.info("Loading reranker from local cache: %s", RERANK_MODEL)
                _cross_encoder = CrossEncoder(
                    RERANK_MODEL,
                    max_length=512,
                    local_files_only=True,
                )
            else:
                logger.info("Downloading reranker model: %s ...", RERANK_MODEL)
                _cross_encoder = CrossEncoder(RERANK_MODEL, max_length=512)
        return _cross_encoder


def is_rerank_ready() -> bool:
    if not RERANK_ENABLED:
        return True
    return _warmup_ready and _cross_encoder is not None


def is_rerank_enabled() -> bool:
    return RERANK_ENABLED


def _warmup_sync() -> None:
    global _warmup_ready, _warmup_failed
    if not RERANK_ENABLED:
        logger.info("Reranker skipped (RERANK_ENABLED=0)")
        _warmup_ready = True
        return
    logger.info("Reranker warmup started (background): %s", RERANK_MODEL)
    try:
        _get_cross_encoder()
    except ImportError:
        logger.warning("sentence-transformers not installed; rerank disabled at runtime")
        _warmup_failed = True
        return
    except Exception as exc:
        logger.warning("Reranker warmup failed: %s", exc)
        _warmup_failed = True
        return
    _warmup_ready = True
    logger.info("Reranker ready: %s", RERANK_MODEL)


def warmup_reranker() -> None:
    global _warmup_started
    with _lock:
        if _warmup_started:
            return
        _warmup_started = True
    thread = threading.Thread(target=_warmup_sync, name="reranker-warmup", daemon=True)
    thread.start()


def _tag_overlap_boost(chunk_tags_raw: Any, inferred_tags: list[str]) -> float:
    if not inferred_tags:
        return 0.0
    tag_set = {t.strip() for t in inferred_tags if t and t.strip()}
    raw = str(chunk_tags_raw or "")
    chunk_tags = {p.strip() for p in raw.split(",") if p.strip()}
    return TAG_MATCH_BOOST * len(tag_set & chunk_tags)


def rerank_hits(
    query: str,
    hits: list[dict[str, Any]],
    *,
    inferred_tags: list[str] | None = None,
) -> list[dict[str, Any]]:
    if not hits:
        return hits

    chunk_signals = get_chunk_signals()
    source_signals = get_source_signals()
    base_scores: list[float] = []

    if RERANK_ENABLED:
        try:
            model = _get_cross_encoder()
            pairs = [
                (query, rerank_text_for_hit(h)[:RERANK_MAX_CHARS])
                for h in hits
            ]
            base_scores = [float(s) for s in model.predict(pairs)]
        except ImportError:
            base_scores = [float(h.get("rrf_score", 0.0)) for h in hits]
        except Exception as exc:
            logger.warning("rerank failed, fallback rrf: %s", exc)
            base_scores = [float(h.get("rrf_score", 0.0)) for h in hits]
    else:
        base_scores = [float(h.get("rrf_score", 0.0)) for h in hits]

    ranked: list[dict[str, Any]] = []
    for hit, score in zip(hits, base_scores):
        item = dict(hit)
        chunk_id = str(item.get("id") or "")
        source = str(item.get("source") or "")
        final = score
        final += _tag_overlap_boost(item.get("tags"), inferred_tags or [])
        final += filename_overlap_boost(query, source)

        sig = chunk_signals.get(chunk_id) or {}
        penalty = int(sig.get("penalty") or 0)
        boost = int(sig.get("boost") or 0)
        final -= penalty * PENALTY_WEIGHT
        final += boost * BOOST_WEIGHT

        src_sig = source_signals.get(source) or {}
        src_penalty = int(src_sig.get("penalty") or 0)
        src_boost = int(src_sig.get("boost") or 0)
        final -= src_penalty * SOURCE_PENALTY_WEIGHT
        final += src_boost * SOURCE_BOOST_WEIGHT

        item["rerank_score"] = final
        ranked.append(item)

    ranked.sort(key=lambda x: x.get("rerank_score", 0.0), reverse=True)
    return ranked
