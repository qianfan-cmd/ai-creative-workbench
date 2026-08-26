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

**Git Bash：**

```bash
cd ai-service-python
source .venv/Scripts/activate
uvicorn app.main:app --reload --port 8000
```

**PowerShell：**

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

## 接口

- `GET /health` — 健康检查
- `POST /ai/chat` — 非流式对话（body: `{ "message": "..." }`）
- `GET /docs` — Swagger 文档

## 学习说明

本项目 Python 代码含**详细中文注释**，面向 Python 初学者。完整教学约定见：

**[docs/python-learning-guide.md](../docs/python-learning-guide.md)**
