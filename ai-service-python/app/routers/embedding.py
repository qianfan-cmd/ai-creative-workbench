import os
import httpx
from fastapi import APIRouter, HTTPException

from app.schemas.embedding import EmbeddingRequest, EmbeddingResponse
from app.services.embedding_service import embed_text, embed_texts

router = APIRouter(prefix = "/ai/embeddings", tags = ["embeddings"])

@router.post("/test", response_model = EmbeddingResponse)
def embedding_test(req: EmbeddingRequest):
    """
    把一段文字转成向量，返回维度 + 前 5 维预览。
    Apifox:
      POST http://localhost:8000/ai/embeddings/test
      Body → JSON:
      { "text": "什么是 RAG？" }
    """
    try:
        vector = embed_text(req.text)

        return EmbeddingResponse(
            model = os.getenv("EMBEDDING_MODEL", "deepseek-embedding"),
            dimension = len(vector),
            preview = vector[:5], # 前5个向量数字，用于测试
            text_preview = req.text.strip()[:50], # 输入文本前50个字符，用于测试
        )

    except ValueError as e:
        raise HTTPException(status_code = 500, detail = str(e))

    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Embedding API 错误: {e.response.status_code} {e.response.text}",
        )

    except Exception as e:
        raise HTTPException(status_code = 500, detail=f"Embedding 失败: {e}")