"""
RAG 问答 HTTP 接口（≈ Java Controller）。
职责：接收 JSON 问题 → 调 rag_service → 返回标准 JSON。
不做检索/调模型细节，那些都在 services/rag_service.py。
"""
import httpx
from fastapi import APIRouter, HTTPException

from app.schemas.rag import RAGQueryRequest, RAGQueryResponse, RagReference
from app.services.rag_service import rag_query

router = APIRouter(prefix = "/ai/rag", tags = ["rag"])

@router.post("/query", response_model = RAGQueryResponse)
def rag_query_api(req: RAGQueryRequest):
    try:
        result = rag_query(req.question, top_k = req.top_k)

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