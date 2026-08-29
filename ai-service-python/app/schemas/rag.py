"""
RAG 问答接口的请求/响应结构。
RAG = Retrieval-Augmented Generation（检索增强生成）：
  先从知识库检索相关片段，再让大模型基于这些片段回答。

设计思考：
- 请求体：question: str 用户问题（必填）、top_k: int 返回几条，默认 3
- 响应体：回答、原文、来源、具体段落
回答也可以基于互联网
"""
from pydantic import BaseModel, Field

class RagHistoryItem(BaseModel):
    """多轮 RAG 上下文 — 不含 references 全文，仅 Q/A 摘要。"""
    question: str = Field(..., min_length=1)
    answer: str = Field(..., min_length=1)

class RAGQueryRequest(BaseModel):
    question: str = Field(..., min_length = 1, description = "用户问题")
    top_k: int = Field(default = 3, ge = 1, le = 10, description = "返回几条，默认 3")
    history: list[RagHistoryItem] = Field(default_factory=list, description="同会话 prior turns")

class RagReference(BaseModel):
    content: str = Field(..., description = "片段内容")
    source: str | None = Field(default = None, description = "来源文件名")
    index: int | None = Field(default = None, description = "片段在文件中的索引")

class RAGQueryResponse(BaseModel):
    answer: str = Field(..., description = "回答文字")
    references: list[RagReference] = Field(
        default_factory = list,
        description = "相关片段引用列表",
    )