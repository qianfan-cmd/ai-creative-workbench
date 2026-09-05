"""图像 Provider 路由 — 字节 Seedream 优先，仅额度错误时切万相。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from app.services.ops.image_providers.base import ImageCandidate
from app.services.ops.image_providers.dashscope_wanx import DashScopeWanxAdapter
from app.services.ops.image_providers.seedream import ProviderQuotaError, SeedreamAdapter


@dataclass
class ImageGenerateResult:
    provider: str
    model: str
    candidates: List[ImageCandidate]


# 画幅 → Provider size 参数
ASPECT_SIZE_MAP = {
    "16:9": ("2560x1440", "2K"),
    "4:3": ("2384x1728", "2K"),
    "1:1": ("2048x2048", "2K"),
}


def resolve_sizes(aspect_ratio: str | None) -> tuple[str, str]:
    """返回 (seedream_size, wan_size)。"""
    key = aspect_ratio or "16:9"
    pair = ASPECT_SIZE_MAP.get(key, ASPECT_SIZE_MAP["16:9"])
    return pair


def generate_images(
    *,
    job_type: str,
    prompt: str,
    source_url: str | None,
    count: int = 4,
    aspect_ratio: str | None = None,
) -> ImageGenerateResult:
    """统一生图/抠图入口：先 Seedream，额度不足再 Wan。"""
    seedream_size, wan_size = resolve_sizes(aspect_ratio)
    primary = SeedreamAdapter()
    fallback = DashScopeWanxAdapter()

    if not primary.is_configured() and not fallback.is_configured():
        raise ValueError("未配置任何图像 Provider（SEEDREAM 或 DASHSCOPE）")

    # 主 Provider：字节
    if primary.is_configured():
        try:
            candidates = primary.generate(
                source_url=source_url,
                prompt=prompt,
                count=count,
                size=seedream_size,
            )
            return ImageGenerateResult(
                provider=primary.name,
                model=primary._model(),
                candidates=candidates,
            )
        except ProviderQuotaError:
            # 仅额度类错误才 fallback
            if not fallback.is_configured():
                raise ValueError("Seedream 额度不足且未配置 DASHSCOPE 兜底")
        except ValueError:
            raise

    # 兜底：万相
    candidates = fallback.generate(
        source_url=source_url,
        prompt=prompt,
        count=count,
        size=wan_size,
    )
    return ImageGenerateResult(
        provider=fallback.name,
        model=fallback._model(),
        candidates=candidates,
    )
