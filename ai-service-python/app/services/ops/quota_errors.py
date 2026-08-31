"""判断外部图像 API 是否属于「额度/限流」类错误 — 仅此模块决定是否 fallback。"""

from __future__ import annotations

# 业务码/文案关键词：命中则允许切换到备用 Provider
_QUOTA_KEYWORDS = (
    "quotaexceeded",
    "insufficientbalance",
    "ratelimit",
    "rate limit",
    "quota",
    "额度",
    "余额不足",
    "exceeded",
    "429",
)


def is_quota_error(status_code: int, body: str) -> bool:
    """HTTP 429 或响应体含额度语义时返回 True。"""
    if status_code == 429:
        return True
    lowered = (body or "").lower()
    return any(k in lowered for k in _QUOTA_KEYWORDS)
