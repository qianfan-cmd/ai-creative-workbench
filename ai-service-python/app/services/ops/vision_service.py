"""DashScope 多模态视觉 — 元素名称识别（对齐美术机台 region prompt）。"""

from __future__ import annotations

import json
import os
import re

import httpx

_JSON_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def _vision_model() -> str:
    return os.getenv("DASHSCOPE_VISION_MODEL", "qwen-vl-max")


def is_vision_configured() -> bool:
    return bool(os.getenv("DASHSCOPE_API_KEY"))


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
        if not isinstance(val, list):
            continue
        names = [str(x).strip() for x in val if str(x).strip()]
        if names:
            groups[key.strip()] = names

    if not groups:
        raise ValueError("未识别到任何元素，请换图或调整框选区域后重试")
    return groups


def detect_elements(image_url: str, region_prompt: str) -> dict[str, list[str]]:
    """
    调用 DashScope 兼容 OpenAI 的多模态 chat，返回分组元素名。
    """
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
                    {"type": "image_url", "image_url": {"url": image_url}},
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
