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