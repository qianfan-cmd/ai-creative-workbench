"""
Embedding 相关请求/响应结构。
"""

from pydantic import BaseModel, Field

class EmbeddingRequest(BaseModel):
    text: str = Field(..., description = "要转成向量的文本")

class EmbeddingResponse(BaseModel):
    """测试结果，不返回完整向量"""
    model: str = Field(..., description = "使用的Embedding模型")
    dimension: int = Field(..., description = "向量维度")
    preview: list[float] = Field(..., description = "前5个向量数字，用于测试")
    text_preview: str = Field(..., description = "输入文本前五十个字符")