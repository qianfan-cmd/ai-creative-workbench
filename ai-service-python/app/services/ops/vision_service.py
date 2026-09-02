"""DashScope 多模态视觉 — 元素名称识别（对齐美术机台 region prompt）。"""

from __future__ import annotations

import json
import logging
import os
import re

import httpx

from app.services.ops.vision_image_resolver import (
    VisionImageResolver,
    is_download_failure_error,
)

logger = logging.getLogger(__name__)

_JSON_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def _vision_model() -> str:
    return os.getenv("DASHSCOPE_VISION_MODEL", "qwen-vl-max")


def is_vision_configured() -> bool:
    return bool(os.getenv("DASHSCOPE_API_KEY"))


_MAX_ELEMENT_NAME_LEN = 10


def _extract_name_from_mapping(obj: dict) -> str | None:
    for key in ("名称", "name", "elementName", "element_name"):
        val = obj.get(key)
        if val is not None:
            text = str(val).strip()
            if text:
                return text[:_MAX_ELEMENT_NAME_LEN]
    return None


def _normalize_element_name(item: object) -> str | None:
    if isinstance(item, dict):
        return _extract_name_from_mapping(item)

    if isinstance(item, str):
        text = item.strip()
        if not text:
            return None
        if text.startswith("{"):
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                return text[:_MAX_ELEMENT_NAME_LEN]
            if isinstance(parsed, dict):
                return _extract_name_from_mapping(parsed) or text[:_MAX_ELEMENT_NAME_LEN]
        return text[:_MAX_ELEMENT_NAME_LEN]

    text = str(item).strip()
    return text[:_MAX_ELEMENT_NAME_LEN] if text else None


def _coerce_group_items(val: object) -> list[object]:
    if isinstance(val, list):
        return val
    if isinstance(val, dict):
        for key in ("items", "elements", "元素", "list"):
            nested = val.get(key)
            if isinstance(nested, list):
                return nested
        return list(val.values())
    return []


def _parse_groups_json(text: str) -> dict[str, list[str]]:
    cleaned = _JSON_FENCE.sub("", text.strip()).strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"元素识别返回非 JSON: {e}") from e

    if not isinstance(data, dict):
        raise ValueError("元素识别 JSON 必须是对象")

    groups: dict[str, list[str]] = {}
    for key, val in data.items():
        if not isinstance(key, str) or not key.strip():
            continue
        names: list[str] = []
        for item in _coerce_group_items(val):
            normalized = _normalize_element_name(item)
            if normalized:
                names.append(normalized)
        if names:
            groups[key.strip()] = names

    if not groups:
        raise ValueError("未识别到任何元素，请换图或调整框选区域后重试")
    return groups


def _call_vision_model(payload_url: str, region_prompt: str) -> dict[str, list[str]]:
    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        raise ValueError("DASHSCOPE_API_KEY 未配置，无法做元素识别")

    base = os.getenv(
        "DASHSCOPE_COMPAT_BASE",
        "https://dashscope.aliyuncs.com/compatible-mode/v1",
    ).rstrip("/")
    model = _vision_model()
    url = f"{base}/chat/completions"

    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": payload_url}},
                    {"type": "text", "text": region_prompt},
                ],
            }
        ],
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    with httpx.Client(timeout=120.0) as client:
        resp = client.post(url, json=payload, headers=headers)
    if resp.status_code >= 400:
        raise ValueError(f"视觉模型调用失败 ({resp.status_code}): {resp.text[:500]}")

    data = resp.json()
    content = data["choices"][0]["message"]["content"]
    if not content:
        raise ValueError("视觉模型返回内容为空")
    return _parse_groups_json(content)


def detect_elements(
    region_prompt: str,
    image_url: str | None = None,
    image_base64: str | None = None,
) -> tuple[dict[str, list[str]], str]:
    """
    调用 DashScope 多模态 chat，返回 (分组元素名, resolve_strategy)。
    """
    resolved = VisionImageResolver.resolve(image_url=image_url, image_base64=image_base64)
    strategy = resolved.strategy_used

    try:
        groups = _call_vision_model(resolved.payload_url, region_prompt)
        logger.info("vision_detect success strategy=%s", strategy)
        return groups, strategy
    except ValueError as e:
        err_msg = str(e)
        if (
            resolved.strategy_used == "L1_public_url"
            and image_url
            and is_download_failure_error(err_msg)
        ):
            logger.warning(
                "vision_detect L1 failed (%s), retry with L3 url=%s",
                err_msg[:120],
                image_url[:80],
            )
            fallback = VisionImageResolver.resolve_fallback_from_url(image_url)
            groups = _call_vision_model(fallback.payload_url, region_prompt)
            logger.info("vision_detect success strategy=%s (fallback from L1)", fallback.strategy_used)
            return groups, fallback.strategy_used
        raise
