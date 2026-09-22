"""
文档相关 HTTP 接口 — RAG 知识库「写入侧」入口。

本模块在 RAG 流水线中的角色：
  - **入库（/index）**：上传文件 → 语义切分 → AI 打标 → 向量化 → 写入 Chroma
  - **删除（/delete）**：按 document_id 和/或 source 移除向量，触发 BM25 缓存失效
  - **列表（/list）**：聚合 Chroma metadata，供前端展示已索引文档库
  - **调试（/parse、/chunk）**：仅解析/切分，不写向量库

路由前缀：``/ai/documents``（Java 后端可转发至此处）。
"""

from fastapi import APIRouter, File, UploadFile, HTTPException, Form

from app.schemas.document import DocumentParseResponse, DocumentChunkResponse, DocumentChunkItem, DocumentIndexResponse, DocumentListResponse, DocumentDeleteRequest, DocumentDeleteResponse
from app.services.document_parser import parse_upload_file
from app.services.indexing_pipeline import run_index_pipeline
from app.services.text_splitter import split_text
from app.services.vector_store import list_documents, delete_document_vectors

# prefix会把所有路由前缀都加上/ai/documents
router = APIRouter(prefix = "/ai/documents", tags = ["documents"])

@router.post("/parse", response_model = DocumentParseResponse)
async def parse_document(file: UploadFile = File(...)):
    """
    解析上传文件 — 调试/预览用，不写向量库。

    参数:
        file: form-data 文件字段（txt/md）

    返回:
        DocumentParseResponse：filename、content、char_count

    副作用:
        无持久化；仅调用 document_parser 读内存
    """
    filename, content = parse_upload_file(file)

    return DocumentParseResponse(
        filename = filename,
        content = content,
        char_count = len(content),
    )

@router.post("/chunk", response_model = DocumentChunkResponse)
async def chunk_document(file: UploadFile = File(...)):
    """
    固定规则切分预览 — 调试用，不走语义切分/embedding/入库。

    流程：parse → split_text(400/50) → 返回 chunk 列表。

    参数:
        file: form-data 文件字段

    返回:
        DocumentChunkResponse：chunks 含 index、source、content

    副作用:
        无；生产入库请用 /index（semantic_chunk + 打标 + Chroma）
    """
    filename, content = parse_upload_file(file)

    # 切分文本
    pieces = split_text(content, chunk_size = 400, overlap = 50)

    # 把list[str] 转成 list[DocumentChunkItem]
     # enumerate(pieces) 同时拿到下标 i 和内容 text，类似 JS 的 pieces.map((text, i) => ...)
    chunks_items: list[DocumentChunkItem] = []
    for i, text in enumerate(pieces):
        item = DocumentChunkItem(index=i, source=filename, content=text)
        chunks_items.append(item)

    return DocumentChunkResponse(
        filename = filename,
        char_count = len(content),
        chunk_count = len(pieces),
        chunks = chunks_items,
    )

@router.post("/index", response_model = DocumentIndexResponse)
async def index_document(
    file: UploadFile = File(...),
    document_id: int | None = Form(None),
    user_id: int | None = Form(None),
):
    """
    文档入库 — RAG 索引流水线主入口。

    流程：parse → semantic_chunk → AI 打标 → embed → Chroma（同 source 先删后写）。

    参数:
        file: 上传的 txt/md 文件（form-data）
        document_id: 可选，Java 侧文档主键，写入 chunk metadata 便于按 ID 删除
        user_id: 可选，用户 ID，写入 metadata（当前 collection 未严格隔离）

    返回:
        DocumentIndexResponse：filename、chunk_count、indexed_count、embedding 统计、suggested_tags

    副作用:
        调用 ``run_index_pipeline``，修改 Chroma 向量库并失效 BM25 缓存

    异常:
        ValueError → HTTP 400（如切分结果为空）
    """
    filename, content = parse_upload_file(file)

    try:
        result = run_index_pipeline(
            filename=filename,
            content=content,
            document_id=document_id,
            user_id=user_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return DocumentIndexResponse(
        filename=result.filename,
        char_count=result.char_count,
        chunk_count=result.chunk_count,
        indexed_count=result.indexed_count,
        embedding_model=result.embedding_model,
        embedding_tokens=result.embedding_tokens,
        suggested_tags=result.suggested_tags,
    )

@router.post("/delete", response_model = DocumentDeleteResponse)
async def delete_document_post(body: DocumentDeleteRequest):
    """
    删除已索引文档 — 推荐方式（JSON body，支持 emoji 等特殊文件名）。

    参数:
        body.source: 可选，metadata.source（文件名）
        body.document_id: 可选，metadata.document_id
        二者至少提供一个

    返回:
        DocumentDeleteResponse：source、document_id、deleted_count

    副作用:
        从 Chroma 删除匹配 chunk，失效 BM25 内存索引缓存
    """
    source = body.source.strip() if body.source else None
    document_id = body.document_id
    if (not source) and (document_id is None or document_id <= 0):
        raise HTTPException(status_code = 400, detail = "source 与 document_id 至少提供一个")
    deleted = delete_document_vectors(source = source, document_id = document_id)
    return DocumentDeleteResponse(source = source, document_id = document_id, deleted_count = deleted)

@router.delete("", response_model = DocumentDeleteResponse)
async def delete_document(source: str):
    """
    按 source 删除文档 — 兼容旧版 query 参数调用。

    参数:
        source: metadata.source（文件名），不可为空

    返回:
        DocumentDeleteResponse：deleted_count 为实际删除条数

    副作用:
        从 Chroma 删除该 source 下全部 chunk，失效 BM25 缓存
    """
    if not source or not source.strip():
        raise HTTPException(status_code = 400, detail = "source 不能为空")
    source = source.strip()
    deleted = delete_by_source(source)
    return DocumentDeleteResponse(source = source, document_id = None, deleted_count = deleted)

@router.get("/list", response_model = DocumentListResponse)
async def list_indexed_documents():
    """
    列出已入库文档 — 读侧元数据聚合，不走向量检索。

    从 Chroma metadata 按 source 文件名统计 chunk 数量，供知识库左栏展示。

    返回:
        DocumentListResponse.documents：``[{filename, chunk_count}, ...]`` 按文件名排序

    副作用:
        只读 Chroma，无写入

    说明:
        Java 后端 ``GET /api/knowledge/documents`` 可转发至此；当前 collection 全局共享
    """
    docs = list_documents()
    return DocumentListResponse(documents = docs)
