"""
FastAPI 应用入口（≈ Spring Boot 的 BackendJavaApplication + 部分 WebMvcConfig）

职责：
  1. 创建 FastAPI 应用实例 app
  2. 启动时 load_dotenv() 加载 .env 里的 API Key
  3. 把 routers/chat.py 里定义的路由挂载到 app 上
  4. 提供 GET /health 健康检查

启动命令（在 ai-service-python 根目录）：
  uvicorn app.main:app --reload --port 8000 --reload-exclude 'data/*' --reload-exclude '*.sqlite3'
  ↑ 必须 exclude data/chroma，否则文档入库/删库写盘会触发 reload，反复下载 reranker
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from dotenv import load_dotenv

from app.routers.chat import router as chat_router
from app.routers.document import router as document_router
from app.routers.embedding import router as embedding_router
from app.routers.rag import router as rag_router
from app.routers.ops import router as ops_router
from app.services.retrieval.reranker import is_rerank_enabled, is_rerank_ready, warmup_reranker

load_dotenv()

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    warmup_reranker()
    logger.info("AI service ready; reranker loading in background if enabled")
    yield


app = FastAPI(
    title="AI Creative Workbench - AI Service",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(chat_router)
app.include_router(document_router)
app.include_router(embedding_router)
app.include_router(rag_router)
app.include_router(ops_router)


@app.get("/health")
def health():
    """健康检查 — status=ok 表示 HTTP 可接受请求；rerank_ready 表示 rerank 模型是否已加载。"""
    return {
        "status": "ok",
        "service": "ai-service-python",
        "rerank_enabled": is_rerank_enabled(),
        "rerank_ready": is_rerank_ready(),
    }
