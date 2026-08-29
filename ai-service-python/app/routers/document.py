"""
文档相关 HTTP 接口
本文件只负责：
  - 接收上传的文件
  - 调用 document_parser 解析
  - 包装成 DocumentParseResponse 返回 JSON
完整路径：POST /ai/documents/parse
（router prefix="/ai/documents" + 路由 "/parse"）
"""

from fastapi import APIRouter, File, UploadFile, HTTPException

from app.schemas.document import DocumentParseResponse, DocumentChunkResponse, DocumentChunkItem, DocumentIndexResponse, DocumentListResponse
from app.services.document_parser import parse_upload_file
from app.services.text_splitter import split_text
from app.services.vector_store import add_chunks, list_documents
from app.services.embedding_service import embed_texts

# prefix会把所有路由前缀都加上/ai/documents
router = APIRouter(prefix = "/ai/documents", tags = ["documents"])

@router.post("/parse", response_model = DocumentParseResponse)
async def parse_document(file: UploadFile = File(...)):
    """
    上传 txt/md 文件，返回解析后的纯文本。
    参数:
        file: 表单里的文件字段，Apifox 里选 form-data，key 名必须是 file
        File(...): ... 表示必填；类似 Java @RequestParam(required=true)
    返回:
        DocumentParseResponse → JSON { filename, content, char_count }
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
    上传 txt/md 文件，解析后切分成多个 chunk 返回。
    流程（和 Java Controller → Service 链一样，只是多一步切分）：
      1. parse_upload_file  → 读出全文
      2. split_text         → 切成多段
      3. 包装成 DocumentChunkResponse 返回
    Apifox 配置与 /parse 相同：
      Body → form-data → 参数名 file → 选文件
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
async def index_document(file: UploadFile = File(...)):
    """
    文档入库：parse → chunk → embed → Chroma
    """
    filename, content = parse_upload_file(file)
    pieces = split_text(content, chunk_size = 400, overlap = 50)

    if not pieces:
        raise HTTPException(status_code = 400, detail = "切分结果为空")

    # 批量 Embedding
    embeddings = embed_texts(pieces)

    ids: list[str] = []
    metadatas: list[dict] = []
    for i, text in enumerate(pieces):
        ids.append(f"{filename}-{i}")
        metadatas.append({
            "source": filename,
            "index": i,
        })
    
    indexed = add_chunks(
        ids = ids,
        documents = pieces,
        embeddings = embeddings,
        metadatas = metadatas,
    )

    return DocumentIndexResponse(
        filename = filename,
        char_count = len(content),
        chunk_count = len(pieces),
        indexed_count = indexed,
    )

@router.get("/list", response_model = DocumentListResponse)
async def list_indexed_documents():
    """
    返回已入库文档列表（filename + chunk_count）。
    Java 后端 GET /api/knowledge/documents 会转发到这里。
    """
    docs = list_documents()
    return DocumentListResponse(documents = docs)
