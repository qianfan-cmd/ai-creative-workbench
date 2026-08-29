"""
Chroma 向量库封装 — 负责向量的「存」和「查」。
为什么单独一个文件？
  - embedding_service：文本 → 向量（调阿里云 API）
  - vector_store：向量 + 文本 → 写入/检索 Chroma（本地数据库）
  - 以后换 Milvus，主要改这个文件，其它层不动
数据存在哪？
  - 默认 ./data/chroma/ 目录（已在 .gitignore 忽略，不提交 Git）
"""
from __future__ import annotations # 允许写list[str] 等新版类型注解

import os
from typing import Any

import chromadb
from chromadb.config import Settings

# collection 名称：相当于表名
COLLECTION_NAME = "knowledge_chunks"

# 向量数据持久化目录
CHROMA_DATA_DIR = os.getenv("CHROMA_DATA_DIR", "./data/chroma")

def _get_client() -> chromadb.ClientAPI:
    """
    获取 Chroma 客户端（PersistentClient = 数据落盘，重启不丢）。
    Settings(anonymized_telemetry=False)：关闭匿名统计，本地开发常用。
    """
    os.makedirs(CHROMA_DATA_DIR, exist_ok=True)
    # 向量存到本地文件夹
    return chromadb.PersistentClient(
        path = CHROMA_DATA_DIR,
        settings = Settings(anonymized_telemetry=False),
    )

def _get_collection():
    """获取或创建 collection（表）。"""
    client = _get_client()
    # get_or_create_collection：没有就建，有就直接用
    return client.get_or_create_collection(name=COLLECTION_NAME)

def add_chunks(
    *,
    ids: list[str],
    documents: list[str],
    embeddings: list[list[float]],
    metadatas: list[dict[str, Any]],
) -> int:
    """
    批量写入 chunk 到 Chroma。
    参数:
        ids:       每条唯一 ID，例如 "Agent入门.md-0"
        documents: chunk 原文
        embeddings: 与 documents 一一对应的向量
        metadatas:  附加信息，如 {"source": "Agent入门.md", "index": 0}
    返回:
        本次写入条数
    """
    if not ids:
        return 0

    # 四个 list 长度必须一致
    n = len(ids)
    if not (len(documents) == n and len(embeddings) == n and len(metadatas) == n):
        raise ValueError("add_chunks 参数长度不一致")

    collection = _get_collection()
    collection.add(
        ids = ids,
        documents = documents,
        embeddings = embeddings,
        metadatas = metadatas,
    )
    return n

def search_similar(query_embedding: list[float], top_k: int = 3) -> list[dict[str, Any]]:
    """
    用「问题的向量」检索最相似的 chunk（TopK）。
    参数:
        query_embedding: embed_text(用户问题) 的结果
        top_k: 返回几条，默认 3
    返回:
        list[dict]，每项含 content、source、index、distance 等
    """
    collection = _get_collection()
    result = collection.query(
        query_embeddings = [query_embedding],
        n_results = top_k,
        include = ["documents", "metadatas", "distances"],
    )

    # Chroma 返回的结构是按字段分组的list of list，要 zip成一条条。三个列表按位置配对，组成一条条结果
    """
    {
  'documents': [[
      'This is a document about pineapple',
      'This is a document about oranges'
  ]],
  'ids': [['id1', 'id2']],
  'distances': [[1.0404009819030762, 1.243080496788025]],
  'uris': None,
  'data': None,
  'metadatas': [[None, None]],
  'embeddings': None,
   }
    """
    docs = (result.get("documents") or [[]])[0]
    metas = (result.get("metadatas") or [[]])[0]
    dists = (result.get("distances") or [[]])[0]

    items: list[dict[str, Any]] = []
    for doc, meta, dist in zip(docs, metas, dists):
        items.append({
            "content": doc,
            "source": meta.get("source"),
            "index": meta.get("index"),
            "distance": dist, # 越小越相似
        })
    return items

def list_documents() -> list[dict[str, Any]]:
    """
    列出已索引的文档（按 source 文件名聚合 chunk 数量）。
    数据来自 Chroma metadatas，刷新页面后仍可展示左栏文档库。
    注意：当前 collection 全局共享，未按 user_id 隔离（Week 11 可接受）。
    """
    collection = _get_collection()
    result = collection.get(include=["metadatas"])
    metas = result.get("metadatas") or []

    # 按 source 文件名计数
    counts: dict[str, int] = {}
    for meta in metas:
        if not meta:
            continue
        source = meta.get("source")
        if not source:
            continue
        counts[source] = counts.get(source, 0) + 1

    items = [
        {"filename": filename, "chunk_count": count}
        for filename, count in counts.items()
    ]
    items.sort(key=lambda x: x["filename"])
    return items