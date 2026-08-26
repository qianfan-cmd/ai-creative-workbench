"""
Embedding 服务 — 把文本转成向量（浮点数列表）。
类比：
  - llm_service.py  调 /chat/completions → 得到「回答文字」
  - 本文件          调 /embeddings       → 得到「向量数字」
RAG 里：每个 chunk 的 content 都要先 embed，才能存入向量库、做相似检索。
"""

import os
import httpx

def embed_text(text: str) -> list[float]:
    """
    对单段文本调用 Embedding API，返回向量。
    参数:
        text: 任意字符串（通常是一个 chunk 的内容）
    返回:
        list[float] — 例如长度 1536 的浮点数组
    异常:
        ValueError: 未配置 API Key 或 API 返回空
        httpx.HTTPStatusError: API 4xx/5xx
    """
    api_key = os.getenv("MODEL_API_KEY")
    base_url = os.getenv("MODEL_BASE_URL", "https://api.deepseek.com").rstrip("/")
    model = os.getenv("EMBEDDING_MODEL", "deepseek-embedding")

    if not api_key:
        raise ValueError("未配置 API Key")

    text = text.strip()
    if not text:
        raise ValueError("embed_text的文本不能为空")

    url = f"{base_url}/embeddings"
    payload = {
        "model": model,
        "input": text,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    with httpx.Client(timeout = 60.0) as client:
        resp = client.post(url, json = payload, headers = headers)
        resp.raise_for_status()
        data = resp.json()

    # 标准响应：{ "data": [ { "embedding": [0.1, -0.2, ...] } ] }
    items = data.get("data")
    if not items:
        raise ValueError("Embedding API 返回空")
    
    embedding = items[0].get("embedding")
    if not embedding:
        raise ValueError("Embedding API 未返回 embedding 向量")

    return embedding

def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    批量 Embedding（可选工具函数，本步先不强制用）。
    一次 HTTP 请求嵌入多段，比循环 embed_text 更省请求次数。
    {
  "data": [
    { "index": 0, "embedding": [0.1, -0.2, 0.3, ...] },
    { "index": 1, "embedding": [0.4, 0.5, -0.1, ...] },
    { "index": 2, "embedding": [-0.3, 0.8, 0.2, ...] }
  ]
}
    """
    if not texts:
        return []
    
    api_key = os.getenv("MODEL_API_KEY")
    base_url = os.getenv("MODEL_BASE_URL", "https://api.deepseek.com").rstrip("/")
    model = os.getenv("EMBEDDING_MODEL", "deepseek-embedding")

    if not api_key:
        raise ValueError("未配置 API Key")

    cleaned = []
    for t in texts:
        if t and t.strip():
            cleaned.append(t.strip())
    
    if not cleaned:
        return []

    url = f"{base_url}/embeddings"
    payload = {"model": model, "input": cleaned}
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    with httpx.Client(timeout = 120.0) as client:
        resp = client.post(url, json = payload, headers = headers)
        resp.raise_for_status()
        data = resp.json()

    items = data.get("data") or []
    items.sort(key = lambda item: item.get("index", 0))
    return [item.get("embedding") for item in items]
