"""
请求 / 响应的数据结构定义（≈ Java 的 DTO / VO）

为什么单独一个 schemas 目录？
  - FastAPI 收到 JSON 后，需要知道字段名、类型、是否必填
  - Pydantic 的 BaseModel 会自动：校验类型、报错 422、生成 /docs 文档

本文件不处理业务逻辑，只描述「接口长什么样」。
"""

# pydantic：FastAPI 内置依赖，用 class 定义数据结构并做校验
# Field：给字段加约束（最小长度、描述等），类似 Java @NotBlank @Size
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """
    POST /ai/chat 的请求体。

    前端 / Apifox 发送的 JSON 示例：
      { "message": "你好" }

    Field(...) 里 ... 表示「必填」；min_length=1 表示不能为空字符串。
    """

    message: str = Field(..., min_length=1, description="用户输入")


class ChatResponse(BaseModel):
    """
    POST /ai/chat 的响应体。

    返回 JSON 示例：
      { "reply": "我是...", "model": "deepseek-v4-flash" }
    """

    reply: str   # 模型生成的文本
    model: str   # 实际使用的模型名，便于调试
