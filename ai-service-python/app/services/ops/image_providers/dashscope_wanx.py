"""通义万相 wan2.7 图像 Provider — 文生图 / 图像编辑（抠图）。"""

from __future__ import annotations

import os
from typing import Any, List

import httpx

from app.services.ops.image_providers.base import ImageCandidate, ImageProvider
from app.services.ops.quota_errors import is_quota_error
from app.services.ops.image_providers.seedream import ProviderQuotaError


class DashScopeWanxAdapter(ImageProvider):
    @property
    def name(self) -> str:
        return "dashscope_wanx"

    def is_configured(self) -> bool:
        return bool(os.getenv("DASHSCOPE_API_KEY"))

    def _api_url(self) -> str:
        base = os.getenv("DASHSCOPE_API_BASE", "https://dashscope.aliyuncs.com/api/v1").rstrip("/")
        return f"{base}/services/aigc/multimodal-generation/generation"

    def _model(self) -> str:
        return os.getenv("DASHSCOPE_IMAGE_MODEL", "wan2.7-image-pro")

    def generate(
        self,
        *,
        source_url: str | None,
        prompt: str,
        count: int = 4,
        size: str | None = None,
    ) -> List[ImageCandidate]:
        api_key = os.getenv("DASHSCOPE_API_KEY")
        if not api_key:
            raise ValueError("DASHSCOPE_API_KEY 未配置")

        # wan2.7 messages 格式：text 在前，参考图在后
        content: List[dict[str, Any]] = [{"text": prompt}]
        if source_url:
            content.append({"image": source_url})

        payload = {
            "model": self._model(),
            "input": {"messages": [{"role": "user", "content": content}]},
            "parameters": {
                "n": max(1, min(count, 6)),
                "size": size or "2K",
                "watermark": False,
            },
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        with httpx.Client(timeout=180.0) as client:
            resp = client.post(self._api_url(), json=payload, headers=headers)
        body_text = resp.text
        if resp.status_code >= 400:
            if is_quota_error(resp.status_code, body_text):
                raise ProviderQuotaError(body_text[:500], resp.status_code)
            raise ValueError(f"万相调用失败 ({resp.status_code}): {body_text[:500]}")

        return self._parse_candidates(resp.json(), count)

    def _parse_candidates(self, data: dict, count: int) -> List[ImageCandidate]:
        """从万相响应中提取图片 URL 列表。"""
        output = data.get("output") or {}
        choices = output.get("choices") or []
        urls: List[str] = []

        for choice in choices:
            message = choice.get("message") or {}
            for part in message.get("content") or []:
                if isinstance(part, dict) and part.get("image"):
                    urls.append(part["image"])

        # 部分响应格式在 results 里
        if not urls:
            for item in output.get("results") or []:
                if item.get("url"):
                    urls.append(item["url"])

        if not urls:
            raise ValueError("万相未返回图片 URL")

        return [
            ImageCandidate(url=url, index=i)
            for i, url in enumerate(urls[: max(1, min(count, 6))])
        ]
