"""
FastAPI 应用入口（≈ Spring Boot 的 BackendJavaApplication + 部分 WebMvcConfig）

职责：
  1. 创建 FastAPI 应用实例 app
  2. 启动时 load_dotenv() 加载 .env 里的 API Key
  3. 把 routers/chat.py 里定义的路由挂载到 app 上
  4. 提供 GET /health 健康检查

启动命令（在 ai-service-python 根目录）：
  uvicorn app.main:app --reload --port 8000
  ↑       ↑    ↑
  工具    模块  变量名（本文件里的 app = FastAPI(...)）
"""

# fastapi：Web 框架，用来定义 HTTP 接口（类似 Spring Web）
from fastapi import FastAPI

# python-dotenv：读取 .env 文件，把 KEY=VALUE 写入进程环境变量
# 这样 os.getenv("MODEL_API_KEY") 才能读到值（类似 application-local.yml）
from dotenv import load_dotenv

# 从 routers/chat.py 导入名为 router 的路由对象，起别名 chat_router 避免命名冲突
from app.routers.chat import router as chat_router
from app.routers.document import router as document_router
from app.routers.embedding import router as embedding_router
from app.routers.rag import router as rag_router
from app.routers.ops import router as ops_router

# 必须在读 os.getenv 之前调用；通常放在 main.py 最前面
load_dotenv()

# 创建 FastAPI 应用；title/version 会显示在 http://localhost:8000/docs 文档页
app = FastAPI(
    title="AI Creative Workbench - AI Service",
    version="0.1.0",
)

# 挂载 chat 路由：chat_router 里 prefix="/ai"，所以会有 POST /ai/chat
app.include_router(chat_router)
app.include_router(document_router)
app.include_router(embedding_router)
app.include_router(rag_router)
app.include_router(ops_router)

@app.get("/health")
def health():
    """
    健康检查接口 — 用来确认 Python 服务是否存活。
    返回 dict 时 FastAPI 自动转成 JSON（类似 Spring @RestController 返回 Map）。
    """
    return {"status": "ok", "service": "ai-service-python"}
