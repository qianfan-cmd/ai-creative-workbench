"""
RAG 问答 HTTP 接口 — RAG 流水线「检索 + 生成」读侧入口。

本模块在 RAG 流水线中的角色：
  - **/query**：同步问答，返回完整 answer + references
  - **/query-stream**：SSE 流式问答，先推 references 再逐 token 推 answer
  - **/feedback-fix**：点踩后 LLM 分诊，返回建议修复动作（Java 异步落库）

检索、改写、混合召回、Prompt 组装均在 ``services/rag_service.py`` 及 ``retrieval/`` 子模块。
"""
import httpx
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.services.rag_service import rag_query_stream
from app.schemas.rag import RAGQueryRequest, RAGQueryResponse, RagFeedbackFixRequest, RagReference
from app.services.rag_service import rag_query
from app.services.feedback_auto_fix import run_feedback_fix
from app.services.retrieval.config import FEEDBACK_AUTO_FIX

router = APIRouter(prefix = "/ai/rag", tags = ["rag"])

@router.post("/query", response_model = RAGQueryResponse)
def rag_query_api(req: RAGQueryRequest):
    """
    RAG 同步问答 — 一次返回完整回答与引用列表。

    参数:
        req.question: 用户问题
        req.top_k: 检索返回的 chunk 上限（默认由服务层决定）
        req.history: 多轮对话历史，供 Prompt 理解指代

    返回:
        RAGQueryResponse：answer（Markdown）、references（含 source/index/距离等）

    副作用:
        调用 embedding、混合检索、LLM 生成；可能写入 trace（若开启）

    异常:
        ValueError → 400；上游 LLM HTTP 错误 → 502；其它 → 500
    """
    try:
        result = rag_query(req.question, top_k = req.top_k, history=[h.model_dump() for h in req.history])

        return RAGQueryResponse(
            answer = result["answer"],
            references = [
                RagReference(**ref) for ref in result["references"]
            ],
        )
    except ValueError as e:
        raise HTTPException(status_code = 400, detail = str(e))
    
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"上游 AI 服务错误: {e.response.status_code} {e.response.text}",
        )

    except Exception as e:
        raise HTTPException(status_code = 500, detail = f"RAG 回答失败：{e}")

@router.post("/query-stream")
def rag_query_stream_api(req: RAGQueryRequest):
    """
    RAG 流式问答 — 返回 ``text/event-stream``（SSE）。

    参数:
        同 ``rag_query_api``

    SSE 事件顺序（正常路径）:
        1. ``status`` — 检索开始（data: "retrieving"）
        2. ``trace`` — 可选，调试 trace 字典（RAG_TRACE 开启时）
        3. ``references`` — 检索到的 chunk 引用列表（先于正文推送，便于前端展示来源）
        4. ``message`` — LLM 回答片段，可多次推送
        5. ``done`` — 结束标记 ``[DONE]``

    异常路径:
        ``error`` 事件替代 message/done（ValueError 或上游 502）

    副作用:
        同同步问答；无响应体缓存
    """
    def event_generator():
        """
        SSE 事件生成器 — 将 ``rag_query_stream`` 的 dict 项转为标准 SSE 帧。

        产出:
            ``event: <type>\\ndata: <json>\\n\\n`` 字符串序列

        副作用:
            无；仅消费 rag_service 生成器
        """
        try:
            for item in rag_query_stream(
                req.question,
                top_k=req.top_k,
                history=[h.model_dump() for h in req.history],
            ):
                if item["type"] == "status":
                    payload = json.dumps(item["data"], ensure_ascii=False)
                    yield f"event: status\ndata: {payload}\n\n"
                elif item["type"] == "trace":
                    payload = json.dumps(item["data"], ensure_ascii=False)
                    yield f"event: trace\ndata: {payload}\n\n"
                elif item["type"] == "references":
                    payload = json.dumps(item["data"], ensure_ascii=False)
                    yield f"event: references\ndata: {payload}\n\n"
                else:
                    # message 逐个推字符串；JSON 编码可安全携带换行，避免 SSE 行协议打断
                    chunk = item["data"]
                    payload = json.dumps(chunk, ensure_ascii=False)
                    yield f"event: message\ndata: {payload}\n\n" 

            yield "event: done\ndata: [DONE]\n\n" # \n\n 结束事件 sse规范

        except ValueError as e:
            yield f"event: error\ndata: {str(e)}\n\n"
        except httpx.HTTPStatusError as e:
            yield f"event: error\ndata: 上游 AI 服务错误: {e.response.status_code}\n\n"

    if not req.question.strip():
        raise HTTPException(status_code = 400, detail = "问题不能为空")

    return StreamingResponse(
        event_generator(),
        media_type = "text/event-stream",
    )


@router.post("/feedback-fix")
def rag_feedback_fix_api(req: RagFeedbackFixRequest):
    """
    RAG 反馈自动修复 — 点踩后 LLM 分诊，输出可执行建议动作。

    参数:
        req：含 question、answer、references、点踩原因等（见 RagFeedbackFixRequest）

    返回:
        ``{"actions": [...], "disabled": bool}``；FEEDBACK_AUTO_FIX 关闭时 actions 为空

    副作用:
        调用 LLM 分诊；不直接修改向量库（由 Java 侧异步执行 penalize/boost/reindex 等）

    在 RAG 闭环中的角色:
        将用户反馈映射到召回/排序/生成环节，驱动 chunk_signal / source_signal 更新
    """
    if not FEEDBACK_AUTO_FIX:
        return {"actions": [], "disabled": True}
    actions = run_feedback_fix(req.model_dump())
    return {"actions": actions}