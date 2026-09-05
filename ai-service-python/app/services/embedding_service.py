"""
Embedding 服务 — 把文本转成向量（浮点数数字）。
"""

from __future__ import annotations

import os
from dataclasses import dataclass

import httpx


@dataclass
class EmbedBatchResult:
    embeddings: list[list[float]]
    total_tokens: int
    model: str


def embed_text(text: str) -> list[float]:
    """对单段文本调用 Embedding API，返回向量。"""
    result = embed_texts([text])
    return result.embeddings[0]


BATCH_SIZE = 10


def embed_texts(texts: list[str]) -> EmbedBatchResult:
    """批量 Embedding，返回向量与 token 用量。"""
    if not texts:
        return EmbedBatchResult(embeddings=[], total_tokens=0, model=_embedding_model())

    api_key = os.getenv("EMBEDDING_API_KEY")
    base_url = _embedding_base_url()
    model = _embedding_model()

    if not api_key:
        raise ValueError("未配置 API Key")

    cleaned = [t.strip() for t in texts if t and t.strip()]
    if not cleaned:
        return EmbedBatchResult(embeddings=[], total_tokens=0, model=model)

    url = f"{base_url}/embeddings"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    all_embeddings: list[list[float]] = []
    total_tokens = 0

    with httpx.Client(timeout=120.0) as client:
        for start in range(0, len(cleaned), BATCH_SIZE):
            batch = cleaned[start : start + BATCH_SIZE]
            payload = {"model": model, "input": batch}

            resp = client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

            usage = data.get("usage") or {}
            total_tokens += int(usage.get("total_tokens") or 0)

            items = data.get("data") or []
            items.sort(key=lambda item: item.get("index", 0))
            all_embeddings.extend([item.get("embedding") for item in items])

    return EmbedBatchResult(
        embeddings=all_embeddings,
        total_tokens=total_tokens,
        model=model,
    )


def _embedding_base_url() -> str:
    return os.getenv(
        "EMBEDDING_BASE_URL",
        "https://ws-a23kprk4xntvhx3d.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
    ).rstrip("/")


def _embedding_model() -> str:
    return os.getenv("EMBEDDING_MODEL", "text-embedding-v3")
