"""Seedream（火山方舟）图像 Provider — 文生图 / 图生图 / 抠图共用同一 endpoint。"""

from __future__ import annotations

import os
from typing import List

import httpx

from app.services.ops.image_providers.base import ImageCandidate, ImageProvider
from app.services.ops.quota_errors import is_quota_error


class ProviderQuotaError(Exception):
    """额度或限流错误 — router 可切换备用 Provider。"""

    def __init__(self, message: str, status_code: int = 429):
        super().__init__(message)
        self.status_code = status_code


class SeedreamAdapter(ImageProvider):
    @property
    def name(self) -> str:
        return "seedream"

    def is_configured(self) -> bool:
        return bool(os.getenv("SEEDREAM_API_KEY"))

    def _base_url(self) -> str:
        return os.getenv("SEEDREAM_API_BASE", "https://ark.cn-beijing.volces.com/api/v3").rstrip("/")

    def _model(self) -> str:
        return os.getenv("SEEDREAM_IMAGE_MODEL", "doubao-seedream-5-0-pro-260628")

    def generate(
        self,
        *,
        source_url: str | None,
        prompt: str,
        count: int = 4,
        size: str | None = None,
    ) -> List[ImageCandidate]:
        api_key = os.getenv("SEEDREAM_API_KEY")
        if not api_key:
            raise ValueError("SEEDREAM_API_KEY 未配置")

        # 组装请求体：有参考图走图生图
        payload: dict = {
            "model": self._model(),
            "prompt": prompt,
            "response_format": "url",
            "watermark": False,
            "size": size or "2048x2048",
        }
        if source_url:
            payload["image"] = source_url

        url = f"{self._base_url()}/images/generations"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

        candidates: List[ImageCandidate] = []
        # Seedream 单次通常返回 1 张，循环 count 次凑齐候选
        for i in range(max(1, min(count, 4))):
            with httpx.Client(timeout=120.0) as client:
                resp = client.post(url, json=payload, headers=headers)
            body_text = resp.text
            if resp.status_code >= 400:
                if is_quota_error(resp.status_code, body_text):
                    raise ProviderQuotaError(body_text[:500], resp.status_code)
                raise ValueError(f"Seedream 调用失败 ({resp.status_code}): {body_text[:500]}")

            data = resp.json().get("data") or []
            if not data:
                raise ValueError("Seedream 未返回图片 data")
            item = data[0]
            image_url = item.get("url")
            if not image_url:
                raise ValueError("Seedream 响应缺少 url")
            candidates.append(ImageCandidate(url=image_url, index=i))

        return candidates
