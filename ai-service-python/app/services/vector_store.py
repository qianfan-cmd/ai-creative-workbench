"""
Chroma 向量库封装 — RAG 流水线「持久化层」。

职责：
  - **写入侧**：``add_chunks`` 批量入库；``delete_*`` 按 source/document_id 删除
  - **读侧**：``search_similar`` 稠密向量 TopK；``list_all_chunks/tags`` 供 BM25 与标签召回
  - **元数据**：``list_documents`` 聚合已索引文档列表

与 embedding_service 分工：后者文本→向量，本模块向量+原文→Chroma。
入库/删除后会调用 ``invalidate_bm25_cache``，保证稀疏检索与向量库一致。

数据目录：``CHROMA_DATA_DIR``（默认 ``./data/chroma/``，已 gitignore）。
"""
from __future__ import annotations # 允许写list[str] 等新版类型注解

import os
from typing import Any

import chromadb
from chromadb.config import Settings


def _invalidate_bm25_cache() -> None:
    """
    使 BM25 内存索引失效 — 向量库变更后的联动钩子。

    副作用:
        调用 ``bm25_index.invalidate_bm25_cache``，下次 BM25 检索时 lazy rebuild
    """
    from app.services.retrieval.bm25_index import invalidate_bm25_cache

    invalidate_bm25_cache()

# collection 名称：Chroma 中的逻辑「表名」，所有 knowledge chunk 存于此 collection
COLLECTION_NAME = "knowledge_chunks"

# 向量数据持久化目录；进程内通过 _get_client 懒创建 PersistentClient
CHROMA_DATA_DIR = os.getenv("CHROMA_DATA_DIR", "./data/chroma")

def _get_client() -> chromadb.ClientAPI:
    """
    获取 Chroma 持久化客户端（单例式懒创建，每次调用新建 client 实例）。

    返回:
        chromadb.PersistentClient，数据落盘至 CHROMA_DATA_DIR

    副作用:
        若目录不存在则 ``os.makedirs`` 创建
    """
    os.makedirs(CHROMA_DATA_DIR, exist_ok=True)
    # 向量存到本地文件夹
    return chromadb.PersistentClient(
        path = CHROMA_DATA_DIR,
        settings = Settings(anonymized_telemetry=False),
    )

def _get_collection():
    """
    获取或创建 knowledge_chunks collection。

    返回:
        Chroma Collection 对象

    副作用:
        首次调用时在磁盘创建 collection 元数据
    """
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
    批量写入 chunk 到 Chroma — 索引流水线最后一步。

    参数:
        ids: 每条唯一 ID，如 ``filename-0``
        documents: chunk 原文（检索时返回给 LLM）
        embeddings: 与 documents 等长的向量列表
        metadatas: source、index、section、heading、tags、document_id 等

    返回:
        成功写入条数；ids 为空时返回 0

    副作用:
        写入 Chroma 持久化存储；调用 ``_invalidate_bm25_cache``

    异常:
        ValueError：四个 list 长度不一致
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
    稠密向量相似度检索 — hybrid_search 中 Dense 通路的数据源。

    参数:
        query_embedding: 用户问题经 embedding 后的向量
        top_k: 返回条数上限

    返回:
        list[dict]：id、content、source、index、section、heading、tags、distance（越小越相似）

    副作用:
        只读 Chroma，无写入
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
    """
    返回 Chroma 中全部 chunk — BM25 索引 rebuild 的全量语料源。

    返回:
        与 search_similar 结构对齐的 dict 列表（无 distance）

    副作用:
        只读；大数据量时全表扫描，由 bm25_index 缓存 amortize
    """
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
    """
    从 Chroma metadata 聚合全局标签词表 — 供入库打标与 query 标签推断复用。

    返回:
        去重排序后的标签字符串列表

    副作用:
        只读全表 metadatas
    """
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
    """
    标签定向召回 — tag_retriever 底层实现。

    在内存中对 ``list_all_chunks`` 结果按 tag 交集数排序（Chroma 无原生多 tag OR）。

    参数:
        tags: 待匹配标签列表
        top_k: 返回上限

    返回:
        含 tags 重叠的 chunk dict 列表，按重叠数降序

    副作用:
        触发 list_all_chunks 全量读取
    """
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
    列出已索引文档 — /list 接口与前端文档库的数据源。

    按 metadata.source 聚合 chunk 数量。

    返回:
        ``[{filename, chunk_count}, ...]`` 按 filename 排序

    副作用:
        只读 Chroma metadatas

    说明:
        当前 collection 全局共享，未按 user_id 隔离
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
    按 metadata.source 删除文档全部 chunk — 入库前清旧、/delete 兼容路由均用此函数。

    参数:
        source: 文件名（metadata.source）

    返回:
        实际删除条数；source 为空返回 0

    副作用:
        Chroma delete；失效 BM25 缓存
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


def delete_document_vectors(*, source: str | None = None, document_id: int | None = None) -> int:
    """
    按 document_id 和/或 source 删除向量 — POST /delete 主逻辑。

    参数:
        source: 可选，metadata.source
        document_id: 可选，metadata.document_id；<=0 视为无效

    返回:
        去重后实际删除的 chunk 总数

    副作用:
        Chroma delete；失效 BM25 缓存

    说明:
        两者都传时取 id 并集，避免 Java 侧仅有 ID 或仅有文件名时删不干净
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