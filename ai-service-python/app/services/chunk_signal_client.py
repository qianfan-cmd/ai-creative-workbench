"""
Chunk 级反馈信号客户端 — RAG 检索 rerank 调权。

从 Java 后端拉取 rag_chunk_signal（penalize/boost 等），
带 TTL 进程内缓存；供 reranker 对特定 chunk_id 升降权。
"""
from __future__ import annotations

import logging
import os
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# chunk_id → signal 字典（penalize/boost 权重等）
_CACHE: dict[str, dict[str, Any]] = {}
# 上次成功拉取的时间戳（time.time()）
_CACHE_AT: float = 0.0
# 缓存 TTL 秒，过期后下次 get_chunk_signals 重新 HTTP 拉取
_CACHE_TTL_SEC = float(os.getenv("CHUNK_SIGNAL_CACHE_TTL", "30"))
# Java 后端 base URL，/internal/rag/chunk-signals 挂载于此
JAVA_BACKEND_URL = os.getenv("JAVA_BACKEND_URL", "http://localhost:8080").rstrip("/")


def _fetch_signals() -> dict[str, dict[str, Any]]:
    """
    HTTP 拉取 chunk 信号 — 无缓存。

    返回:
        chunk_id → signal dict；失败或非 200 包装时返回 {}

    副作用:
        同步 httpx GET，timeout 5s；失败仅 debug 日志
    """
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
    """
    获取 chunk 反馈信号 — reranker 调用入口。

    返回:
        chunk_id → signal 映射；TTL 内返回缓存副本

    副作用:
        缓存 miss 时更新 _CACHE/_CACHE_AT 并请求 Java 后端
    """
    global _CACHE, _CACHE_AT
    now = time.time()
    if _CACHE and now - _CACHE_AT < _CACHE_TTL_SEC:
        return _CACHE
    _CACHE = _fetch_signals()
    _CACHE_AT = now
    return _CACHE
