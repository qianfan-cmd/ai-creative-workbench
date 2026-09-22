"""
文档入库流水线 — RAG 索引阶段核心编排。

串联步骤：语义切分 → AI 打标 → 删旧向量 → 构建 embed 文本 → 向量化 → 写入 Chroma。

被 ``routers/document.py`` 的 ``/index`` 调用；写入的数据供检索侧 hybrid_search 使用。
"""
from __future__ import annotations

from dataclasses import dataclass

from app.services.embed_text_builder import build_embed_text
from app.services.embedding_service import embed_texts
from app.services.knowledge_tagger import TaggingResult, tag_document_and_chunks
from app.services.semantic_chunker import SemanticChunk, semantic_chunk_document
from app.services.vector_store import add_chunks, delete_by_source, list_all_tags


@dataclass
class IndexPipelineResult:
    """入库流水线执行结果 — 返回给 /index 接口的统计与标签摘要。"""

    filename: str
    char_count: int
    chunk_count: int
    indexed_count: int
    embedding_model: str | None
    embedding_tokens: int | None
    suggested_tags: list[str]


def run_index_pipeline(
    *,
    filename: str,
    content: str,
    document_id: int | None = None,
    user_id: int | None = None,
) -> IndexPipelineResult:
    """
    执行完整文档入库流水线。

    参数:
        filename: 文档文件名，作为 Chroma metadata.source 与 chunk id 前缀
        content: 文档全文（已解析的纯文本）
        document_id: 可选，业务侧文档 ID，写入 metadata 便于按 ID 删除
        user_id: 可选，用户 ID，写入 metadata

    返回:
        IndexPipelineResult：切分/索引条数、embedding 模型与 token 消耗、文档级 suggested_tags

    副作用:
        - 调用 LLM（语义切分、打标）与 embedding API
        - ``delete_by_source(filename)`` 清除同文件旧 chunk
        - ``add_chunks`` 写入 Chroma，失效 BM25 缓存

    异常:
        ValueError：切分结果为空
    """
    # 切分文档为语义块
    chunks: list[SemanticChunk] = semantic_chunk_document(content, filename=filename)
    if not chunks:
        raise ValueError("切分结果为空")

    vocabulary = list_all_tags()
    tagging: TaggingResult = tag_document_and_chunks(
        filename, chunks, existing_vocabulary=vocabulary
    )
    chunks = tagging.chunks

    delete_by_source(filename)

    pieces = [c.content for c in chunks]
    embed_inputs = [
        build_embed_text(
            filename=filename,
            content=c.content,
            heading=c.heading or "",
            chunk_summary=c.chunk_summary or "",
        )
        for c in chunks
    ]
    embed_result = embed_texts(embed_inputs)

    ids: list[str] = []
    metadatas: list[dict] = []
    for i, chunk in enumerate(chunks):
        ids.append(f"{filename}-{i}")
        tag_str = ",".join(chunk.tags) if chunk.tags else ""
        meta = {
            "source": filename,
            "index": i,
            "section": chunk.section,
            "heading": (chunk.heading or "")[:120],
            "chunk_summary": (chunk.chunk_summary or "")[:200],
            "tags": tag_str,
        }
        if document_id is not None:
            meta["document_id"] = document_id
        if user_id is not None:
            meta["user_id"] = user_id
        metadatas.append(meta)

    indexed = add_chunks(
        ids=ids,
        documents=pieces,
        embeddings=embed_result.embeddings,
        metadatas=metadatas,
    )

    return IndexPipelineResult(
        filename=filename,
        char_count=len(content),
        chunk_count=len(chunks),
        indexed_count=indexed,
        embedding_model=embed_result.model,
        embedding_tokens=embed_result.total_tokens,
        suggested_tags=tagging.document_tags,
    )
