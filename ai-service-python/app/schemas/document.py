"""
文档解析接口的响应结构。
Pydantic BaseModel：FastAPI 用它校验数据、自动生成 /docs 文档。
"""
from pydantic import BaseModel, Field

"""
类型注解写法：字段名: 类型 = 默认值
Field来自Pydantic,用来描述字段属性:必填、默认值、说明等
Field(..., description="字段说明")：...表示必填，没有默认值，说明字段用途
"""
class DocumentParseResponse(BaseModel):
    filename: str = Field(..., description="原始文件名，例如 notes.md") # 必填，没有默认值，说明字段用途
    content: str = Field(..., description="从文件中读取出的纯文本") # 必填，没有默认值，说明字段用途
    char_count: int = Field(..., description="文本字符数，便于调试") # 必填，没有默认值，说明字段用途

class DocumentChunkItem(BaseModel):
    """
    单个 chunk 的结构。
    RAG 检索时，每一「段」都会单独做 Embedding，所以要带 index 和 source。
    """
    index: int = Field(..., description = "第几段，从0开始")
    source: str = Field(..., description = "来源文件名，例如 Agent入门.md")
    content: str = Field(..., description = "段落内容")

class DocumentChunkResponse(BaseModel):
    filename: str = Field(..., description = "原始文件名，例如 notes.md")
    char_count: int = Field(..., description = "全文总字符数")
    chunk_count: int = Field(..., description = "切分后的 chunk 总数")
    chunks: list[DocumentChunkItem] = Field(..., description = "切分后的 chunk 列表")

class DocumentIndexResponse(BaseModel):
    filename: str = Field(..., description = "原始文件名，例如 notes.md")
    char_count: int = Field(..., description = "全文总字符数")
    chunk_count: int = Field(..., description = "切分后的 chunk 总数")
    indexed_count: int = Field(..., description = "写入 Chroma 的条数")

class DocumentListItem(BaseModel):
    """左栏文档库单项：文件名 + 已索引 chunk 数"""
    filename: str = Field(..., description = "文档文件名")
    chunk_count: int = Field(..., description = "该文档在向量库中的 chunk 数量")

class DocumentListResponse(BaseModel):
    documents: list[DocumentListItem] = Field(default_factory=list, description = "已索引文档列表")

class DocumentDeleteRequest(BaseModel):
    source: str | None = Field(None, description = "Chroma metadata.source 文件名")
    document_id: int | None = Field(None, description = "Chroma metadata.document_id")

class DocumentDeleteResponse(BaseModel):
    source: str | None = Field(None, description = "被删除的 source 文件名")
    document_id: int | None = Field(None, description = "被删除的 document_id")
    deleted_count: int = Field(..., description = "删除的 chunk 数量")