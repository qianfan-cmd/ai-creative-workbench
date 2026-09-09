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


def _invalidate_bm25_cache() -> None:
    from app.services.retrieval.bm25_index import invalidate_bm25_cache

    invalidate_bm25_cache()

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
    _invalidate_bm25_cache()
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
    ids = (result.get("ids") or [[]])[0]
    docs = (result.get("documents") or [[]])[0]
    metas = (result.get("metadatas") or [[]])[0]
    dists = (result.get("distances") or [[]])[0]

    items: list[dict[str, Any]] = []
    for chunk_id, doc, meta, dist in zip(ids, docs, metas, dists):
        items.append({
            "id": chunk_id,
            "content": doc,
            "source": meta.get("source"),
            "index": meta.get("index"),
            "section": meta.get("section"),
            "heading": meta.get("heading"),
            "tags": meta.get("tags"),
            "chunk_summary": meta.get("chunk_summary"),
            "distance": dist, # 越小越相似
        })
    return items


def list_all_chunks() -> list[dict[str, Any]]:
    """返回 Chroma 中全部 chunk，供 BM25 索引重建。"""
    collection = _get_collection()
    result = collection.get(include=["documents", "metadatas"])
    ids = result.get("ids") or []
    docs = result.get("documents") or []
    metas = result.get("metadatas") or []

    items: list[dict[str, Any]] = []
    for chunk_id, doc, meta in zip(ids, docs, metas):
        if not doc:
            continue
        items.append({
            "id": chunk_id,
            "content": doc,
            "source": (meta or {}).get("source"),
            "index": (meta or {}).get("index"),
            "section": (meta or {}).get("section"),
            "heading": (meta or {}).get("heading"),
            "tags": (meta or {}).get("tags"),
            "chunk_summary": (meta or {}).get("chunk_summary"),
        })
    return items


def list_all_tags() -> list[str]:
    """从 Chroma metadata 聚合全部标签词表。"""
    collection = _get_collection()
    result = collection.get(include=["metadatas"])
    metas = result.get("metadatas") or []
    tag_set: set[str] = set()
    for meta in metas:
        if not meta:
            continue
        raw = meta.get("tags") or ""
        for part in str(raw).split(","):
            t = part.strip()
            if t:
                tag_set.add(t)
    return sorted(tag_set)


def search_by_tags(tags: list[str], top_k: int = 20) -> list[dict[str, Any]]:
    """标签定向召回 — 在内存中过滤含任一 tag 的 chunk（Chroma 无原生多 tag OR）。"""
    if not tags:
        return []
    tag_set = {t.strip() for t in tags if t and t.strip()}
    if not tag_set:
        return []

    all_chunks = list_all_chunks()
    scored: list[tuple[int, dict[str, Any]]] = []
    for hit in all_chunks:
        raw = hit.get("tags") or ""
        chunk_tags = {p.strip() for p in str(raw).split(",") if p.strip()}
        overlap = len(tag_set & chunk_tags)
        if overlap > 0:
            scored.append((overlap, hit))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [hit for _, hit in scored[:top_k]]

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

def delete_by_source(source: str) -> int:
    """
    按 metadata.source 删除该文档的全部 chunk。
    返回删除条数。
    """
    if not source or not source.strip():
        return 0
    collection = _get_collection()
    result = collection.get(where={"source": source.strip()}, include=[])
    ids = result.get("ids") or []
    if not ids:
        return 0
    collection.delete(ids=ids)
    _invalidate_bm25_cache()
    return len(ids)


def delete_by_document_id(document_id: int) -> int:
    """按 metadata.document_id 删除该文档的全部 chunk。"""
    if document_id is None or document_id <= 0:
        return 0
    collection = _get_collection()
    result = collection.get(where={"document_id": document_id}, include=[])
    ids = result.get("ids") or []
    if not ids:
        return 0
    collection.delete(ids=ids)
    _invalidate_bm25_cache()
    return len(ids)


def delete_document_vectors(*, source: str | None = None, document_id: int | None = None) -> int:
    """
    按 document_id 与/或 source 删除向量，两者都传则都尝试（去重后的 id 并集）。
    """
    if (not source or not source.strip()) and (document_id is None or document_id <= 0):
        return 0

    collection = _get_collection()
    id_set: set[str] = set()

    if document_id is not None and document_id > 0:
        by_id = collection.get(where={"document_id": document_id}, include=[])
        id_set.update(by_id.get("ids") or [])

    if source and source.strip():
        by_source = collection.get(where={"source": source.strip()}, include=[])
        id_set.update(by_source.get("ids") or [])

    if not id_set:
        return 0
    collection.delete(ids=list(id_set))
    _invalidate_bm25_cache()
    return len(id_set)