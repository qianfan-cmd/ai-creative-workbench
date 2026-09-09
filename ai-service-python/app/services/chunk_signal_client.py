"""从 Java 拉取 rag_chunk_signal，供 rerank 降权/升权。"""
from __future__ import annotations

import logging
import os
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_CACHE: dict[str, dict[str, Any]] = {}
_CACHE_AT: float = 0.0
_CACHE_TTL_SEC = float(os.getenv("CHUNK_SIGNAL_CACHE_TTL", "30"))
JAVA_BACKEND_URL = os.getenv("JAVA_BACKEND_URL", "http://localhost:8080").rstrip("/")


def _fetch_signals() -> dict[str, dict[str, Any]]:
    url = f"{JAVA_BACKEND_URL}/api/internal/rag/chunk-signals"
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(url)
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, dict) and data.get("code") == 200:
                payload = data.get("data") or {}
                return payload if isinstance(payload, dict) else {}
            if isinstance(data, dict):
                return data
    except Exception as exc:
        logger.debug("chunk signal fetch failed: %s", exc)
    return {}


def get_chunk_signals() -> dict[str, dict[str, Any]]:
    global _CACHE, _CACHE_AT
    now = time.time()
    if _CACHE and now - _CACHE_AT < _CACHE_TTL_SEC:
        return _CACHE
    _CACHE = _fetch_signals()
    _CACHE_AT = now
    return _CACHE


def invalidate_chunk_signal_cache() -> None:
    global _CACHE_AT
    _CACHE_AT = 0.0
