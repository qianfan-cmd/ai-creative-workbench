# ai-service-python

FastAPI AI 服务，负责调用大模型（DeepSeek）等能力。Java 后端（8080）会通过 HTTP 调用本服务（8000）。

## 目录说明

| 路径 | 作用（Java 对照） |
|------|-------------------|
| `app/main.py` | 应用入口（≈ Application + 路由注册） |
| `app/routers/` | HTTP 接口（≈ Controller） |
| `app/services/` | 业务逻辑（≈ Service） |
| `app/schemas/` | 请求/响应结构（≈ DTO/VO） |

## 启动

文档入库/删除会写入 `./data/chroma`，开发时 **必须** exclude 该目录，否则 `--reload` 会反复重启并重新下载 reranker。

**Git Bash：**

```bash
cd ai-service-python
source .venv/Scripts/activate
uvicorn app.main:app --reload --port 8000 --reload-exclude 'data/*' --reload-exclude '*.sqlite3'
```

**PowerShell：**

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000 --reload-exclude 'data/*' --reload-exclude '*.sqlite3'
```

Reranker 模型缓存默认在 `~/.cache/huggingface`（Windows: `C:\Users\<用户名>\.cache\huggingface`）。首次下载后重启应走本地缓存；若 hf-mirror 超时，可临时在 `.env` 设 `RERANK_ENABLED=0`。

## 接口

- `GET /health` — 健康检查
- `POST /ai/chat` — 非流式对话（body: `{ "message": "..." }`）
- `GET /docs` — Swagger 文档

## 学习说明

本项目 Python 代码含**详细中文注释**，面向 Python 初学者。完整教学约定见：

**[docs/python-learning-guide.md](../docs/python-learning-guide.md)**
