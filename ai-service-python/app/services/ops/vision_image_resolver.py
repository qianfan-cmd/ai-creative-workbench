"""企业级视觉识别图片解析：公网 URL / inline base64 / 本地拉取 base64 多链路。"""

from __future__ import annotations

import base64
import ipaddress
import logging
import os
import re
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_DATA_URI_RE = re.compile(r"^data:([^;]+);base64,(.+)$", re.DOTALL | re.IGNORECASE)


@dataclass(frozen=True)
class ResolvedVisionImage:
    payload_url: str
    strategy_used: str
    source: str


def _resolve_mode() -> str:
    return os.getenv("VISION_RESOLVE_MODE", "auto").strip().lower()


def _max_inline_bytes() -> int:
    raw = os.getenv("VISION_MAX_INLINE_BYTES", "8388608")
    try:
        return max(1, int(raw))
    except ValueError:
        return 8388608


def is_private_host(host: str) -> bool:
    if not host:
        return True
    h = host.strip().lower()
    if h in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
        return True
    if h.endswith(".local"):
        return True
    try:
        addr = ipaddress.ip_address(h.strip("[]"))
        return addr.is_private or addr.is_loopback or addr.is_link_local
    except ValueError:
        pass
    # hostname without IP — treat as private unless clearly public TLD pattern is risky; default private
    if "." not in h:
        return True
    return False


def _is_public_https_url(image_url: str) -> bool:
    parsed = urlparse(image_url.strip())
    if parsed.scheme not in ("http", "https"):
        return False
    if not parsed.netloc:
        return False
    host = parsed.hostname or ""
    if is_private_host(host):
        return False
    # Production primary path prefers HTTPS; HTTP public is allowed for legacy/CDN
    return True


def _normalize_base64(image_base64: str, mime: str) -> tuple[str, bytes]:
    raw = image_base64.strip()
    if not raw:
        raise ValueError("imageBase64 为空")
    content_type = mime
    if raw.lower().startswith("data:"):
        m = _DATA_URI_RE.match(raw)
        if not m:
            raise ValueError("imageBase64 data-uri 格式无效")
        content_type = m.group(1).strip() or mime
        raw = m.group(2).strip()
    try:
        data = base64.b64decode(raw, validate=True)
    except Exception as e:
        raise ValueError(f"imageBase64 解码失败: {e}") from e
    if not data:
        raise ValueError("imageBase64 解码后为空")
    max_bytes = _max_inline_bytes()
    if len(data) > max_bytes:
        raise ValueError(
            f"图片 inline 体积 {len(data)} 字节超过上限 {max_bytes}，请使用公网 URL 或 OSS"
        )
    payload = f"data:{content_type};base64,{base64.b64encode(data).decode('ascii')}"
    return payload, data


def _fetch_url_as_data_uri(image_url: str, mime: str) -> ResolvedVisionImage:
    url = image_url.strip()
    if not url:
        raise ValueError("imageUrl 为空")
    try:
        with httpx.Client(timeout=60.0, follow_redirects=True) as client:
            resp = client.get(
                url,
                headers={"Accept": "image/*,*/*", "User-Agent": "AICreativeWorkbench-Vision/1.0"},
            )
        if resp.status_code >= 400:
            raise ValueError(f"本地拉取图片失败 HTTP {resp.status_code}")
        data = resp.content
        if not data:
            raise ValueError("本地拉取图片为空")
        max_bytes = _max_inline_bytes()
        if len(data) > max_bytes:
            raise ValueError(
                f"图片体积 {len(data)} 字节超过 inline 上限 {max_bytes}，请配置公网 URL 或 OSS"
            )
        ct = resp.headers.get("content-type", mime).split(";")[0].strip() or mime
        payload = f"data:{ct};base64,{base64.b64encode(data).decode('ascii')}"
        logger.info("vision_resolve strategy=L3_local_fetch url=%s bytes=%d", _abbreviate_url(url), len(data))
        return ResolvedVisionImage(payload_url=payload, strategy_used="L3_local_fetch", source="url")
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"本地拉取图片失败: {e}") from e


def _abbreviate_url(url: str, max_len: int = 120) -> str:
    return url if len(url) <= max_len else url[:max_len] + "..."


class VisionImageResolver:
    @staticmethod
    def resolve(
        image_url: str | None = None,
        image_base64: str | None = None,
        mime: str = "image/png",
    ) -> ResolvedVisionImage:
        mode = _resolve_mode()
        url = (image_url or "").strip() or None
        b64 = (image_base64 or "").strip() or None

        if mode == "base64_only":
            if not b64:
                raise ValueError("VISION_RESOLVE_MODE=base64_only 需要 imageBase64")
            payload, _ = _normalize_base64(b64, mime)
            logger.info("vision_resolve strategy=L2_inline_base64 mode=base64_only")
            return ResolvedVisionImage(payload_url=payload, strategy_used="L2_inline_base64", source="base64")

        if mode == "url_only":
            if not url:
                raise ValueError("VISION_RESOLVE_MODE=url_only 需要 imageUrl")
            if is_private_host(urlparse(url).hostname or ""):
                raise ValueError(
                    f"VISION_RESOLVE_MODE=url_only 不允许内网/localhost URL: {_abbreviate_url(url)}"
                )
            logger.info("vision_resolve strategy=L1_public_url mode=url_only url=%s", _abbreviate_url(url))
            return ResolvedVisionImage(payload_url=url, strategy_used="L1_public_url", source="url")

        # auto: 生产优先公网 URL；不可达时用 inline base64；最后本地拉取
        if url and _is_public_https_url(url):
            logger.info("vision_resolve strategy=L1_public_url url=%s", _abbreviate_url(url))
            return ResolvedVisionImage(payload_url=url, strategy_used="L1_public_url", source="url")

        if b64:
            payload, _ = _normalize_base64(b64, mime)
            logger.info("vision_resolve strategy=L2_inline_base64")
            return ResolvedVisionImage(payload_url=payload, strategy_used="L2_inline_base64", source="base64")

        if url:
            return _fetch_url_as_data_uri(url, mime)

        raise ValueError("需要提供 imageUrl 或 imageBase64")

    @staticmethod
    def resolve_fallback_from_url(image_url: str, mime: str = "image/png") -> ResolvedVisionImage:
        """L1 模型 download 失败时，强制 L3 本地拉取。"""
        return _fetch_url_as_data_uri(image_url, mime)


def is_download_failure_error(message: str) -> bool:
    lower = (message or "").lower()
    return any(
        k in lower
        for k in (
            "failed to download",
            "multimodal content",
            "invalidparameter",
            "download multimodal",
        )
    )
