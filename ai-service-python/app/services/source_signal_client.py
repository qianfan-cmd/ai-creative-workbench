"""
Source 级反馈信号客户端 — RAG 检索 rerank 文档级调权。

从 Java 后端拉取 rag_source_signal（按 filename penalize/boost），
带 TTL 进程内缓存；与 chunk_signal_client 互补。
"""
from __future__ import annotations

import logging
import os
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# source 文件名 → signal 字典（文档级 penalize/boost）
_CACHE: dict[str, dict[str, Any]] = {}
# 上次成功拉取的时间戳
_CACHE_AT: float = 0.0
# 缓存 TTL 秒
_CACHE_TTL_SEC = float(os.getenv("SOURCE_SIGNAL_CACHE_TTL", "30"))
# Java 后端 base URL
JAVA_BACKEND_URL = os.getenv("JAVA_BACKEND_URL", "http://localhost:8080").rstrip("/")


def _fetch_signals() -> dict[str, dict[str, Any]]:
    """
    HTTP 拉取 source 信号 — 无缓存。

    返回:
        filename → signal dict；失败时 {}

    副作用:
        同步 httpx GET；失败仅 debug 日志
    """
    url = f"{JAVA_BACKEND_URL}/api/internal/rag/source-signals"
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
        logger.debug("source signal fetch failed: %s", exc)
    return {}


def get_source_signals() -> dict[str, dict[str, Any]]:
    """
    获取 source 反馈信号 — reranker 文档级调权入口。

    返回:
        filename → signal 映射；TTL 内返回缓存

    副作用:
        缓存 miss 时 HTTP 拉取并更新 _CACHE/_CACHE_AT
    """
    global _CACHE, _CACHE_AT
    now = time.time()
    if _CACHE and now - _CACHE_AT < _CACHE_TTL_SEC:
        return _CACHE
    _CACHE = _fetch_signals()
    _CACHE_AT = now
    return _CACHE
