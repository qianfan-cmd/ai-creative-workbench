"""
Chat 相关的 HTTP 接口（≈ Java 的 ChatController）

职责：
  - 接收 POST /ai/chat 请求
  - 用 Pydantic 校验 JSON  body
  - 调用 services/llm_service.chat_with_llm
  - 把结果包装成 ChatResponse 返回，或把异常转成合适的 HTTP 状态码

为什么用 APIRouter 而不是全写在 main.py？
  - 和 Spring 一样「按模块拆 Controller」，main.py 只负责组装。
"""

import json
import os

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas.chat import ChatRequest, ChatResponse, ChatStreamRequest
from app.services.llm_service import chat_with_llm, stream_chat_with_messages

# APIRouter：一组路由的容器
# prefix="/ai" → 本 router 下所有路径前都会加 /ai
# tags=["ai"] → 在 /docs 文档里分组显示
router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    """
    AI 对话接口（非流式，一次返回完整回复）。

    @router.post("/chat")：
      - 注册 POST 方法，完整路径 = prefix + "/chat" = POST /ai/chat
    response_model=ChatResponse：
      - 告诉 FastAPI 响应 JSON 的形状，并自动生成 OpenAPI 文档

    参数 req: ChatRequest：
      - FastAPI 自动把请求 body JSON 转成 ChatRequest 对象并校验
    """
    try:
        # 调 service 层拿模型回复
        reply = chat_with_llm(req.message)

        # 构造响应对象；FastAPI 会自动转成 JSON 返回给客户端
        return ChatResponse(
            reply=reply,
            model=os.getenv("MODEL_NAME", "unknown"),
        )

    except ValueError as e:
        # 配置错误、模型返回空等「本服务逻辑问题」→ 500
        raise HTTPException(status_code=500, detail=str(e))

    except httpx.HTTPStatusError as e:
        # DeepSeek 返回 401/400 等 → 502 Bad Gateway（表示「上游 AI 服务出错」）
        raise HTTPException(
            status_code=502,
            detail=f"模型 API 错误: {e.response.status_code} {e.response.text}",
        )

    except Exception as e:
        # 兜底：其它未预料错误
        raise HTTPException(status_code=500, detail=f"调用失败: {e}")


@router.post("/chat/stream")
def chat_stream(req: ChatStreamRequest):
    """
    Chat 流式接口 — 返回 text/event-stream。
    事件顺序：message(多次) → done；出错时 error → done。
    chunk 用 JSON 编码，保留 Markdown 换行（与 RAG 一致）。
    """

    def event_generator():
        try:
            # Pydantic 模型转 dict，供 DeepSeek API 使用
            messages = [item.model_dump() for item in req.messages]
            for chunk in stream_chat_with_messages(messages):
                payload = json.dumps(chunk, ensure_ascii=False)
                yield f"event: message\ndata: {payload}\n\n"
            yield "event: done\ndata: [DONE]\n\n"
        except ValueError as e:
            yield f"event: error\ndata: {str(e)}\n\n"
            yield "event: done\ndata: [DONE]\n\n"
        except httpx.HTTPStatusError as e:
            yield f"event: error\ndata: 上游 AI 服务错误: {e.response.status_code}\n\n"
            yield "event: done\ndata: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )
