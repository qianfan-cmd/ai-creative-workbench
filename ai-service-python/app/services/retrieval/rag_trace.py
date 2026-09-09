"""RAG 分阶段诊断 trace — env RAG_TRACE=1 时随 SSE 输出。"""
from __future__ import annotations

import os
from typing import Any


def is_trace_enabled() -> bool:
    raw = os.getenv("RAG_TRACE", "").strip().lower()
    return raw in ("1", "true", "yes", "on")


class RagTrace:
    def __init__(self) -> None:
        self._data: dict[str, Any] = {}

    def set(self, key: str, value: Any) -> None:
        self._data[key] = value

    def to_dict(self) -> dict[str, Any]:
        return dict(self._data)
