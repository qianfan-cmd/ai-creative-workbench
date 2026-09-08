# Java + Python 架构说明（简版）

> **完整版请读 [`architecture.md`](architecture.md)**（Wave C 正式文档，含 mermaid 链路与 CD）。

## 服务分工

- **frontend (8088)**：UI、SSE 流式展示、Nginx 反代
- **backend-java (8080)**：JWT 鉴权、业务 API、编排 AI、SSE 转发
- **ai-service-python (8000)**：DeepSeek、RAG、文档解析

## Chat 调用链

ChatPage → Java `/api/chat/.../stream` → Python `/ai/chat/stream` → DeepSeek → SSE 回传

## 配置

- Java: `app.ai-service.base-url`
- Python: `.env` → `MODEL_API_KEY` / `MODEL_BASE_URL` / `MODEL_NAME`

## 启动顺序

1. Python 8000  
2. Java 8080  
3. Frontend 5173（或 Docker 8088）
