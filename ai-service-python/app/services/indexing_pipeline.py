"""文档入库流水线 — 语义 chunk + AI 打标 + embed + Chroma。"""
from __future__ import annotations

from dataclasses import dataclass

from app.services.embed_text_builder import build_embed_text
from app.services.embedding_service import embed_texts
from app.services.knowledge_tagger import TaggingResult, tag_document_and_chunks
from app.services.semantic_chunker import SemanticChunk, semantic_chunk_document
from app.services.vector_store import add_chunks, delete_by_source, list_all_tags


@dataclass
class IndexPipelineResult:
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
