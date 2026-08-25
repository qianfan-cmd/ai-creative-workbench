# Java + Python 架构说明

## 服务分工
- frontend (5173)：UI、SSE 流式展示
- backend-java (8080)：JWT 鉴权、业务 API、编排 AI
- ai-service-python (8000)：调 DeepSeek、后续 RAG

## Chat 调用链
（画你现在的链路：ChatPage → Java stream → Python /ai/chat → DeepSeek）

## 配置
- Java: app.ai-service.base-url
- Python: .env MODEL_API_KEY / MODEL_BASE_URL / MODEL_NAME

## 启动顺序
1. Python 8000
2. Java 8080
3. Frontend 5173