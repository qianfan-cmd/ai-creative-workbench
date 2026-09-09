"""
RAG 问答 HTTP 接口（≈ Java Controller）。
职责：接收 JSON 问题 → 调 rag_service → 返回标准 JSON。
不做检索/调模型细节，那些都在 services/rag_service.py。
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
    RAG 流式问答 — 返回 text/event-stream。
    事件顺序：references → message(多次) → done
    """
    def event_generator():
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
    """点踩后 LLM 分诊 + 返回建议动作（Java 异步调用并落库/执行）。"""
    if not FEEDBACK_AUTO_FIX:
        return {"actions": [], "disabled": True}
    actions = run_feedback_fix(req.model_dump())
    return {"actions": actions}