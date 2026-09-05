# AI Creative Workbench

AI 创意素材与知识工作台：React 前端 + Spring Boot 业务后端 + FastAPI AI 服务。

## 快速启动

| 模式 | 说明 |
|------|------|
| **本地开发** | 分别启动 Python `:8000`、Java `:8080`、前端 `pnpm dev :5173` |
| **Docker 部署** | `docker compose up -d`，浏览器访问 http://localhost:8088 |

**Docker 完整步骤、环境变量、故障排查** → [`docs/deploy.md`](docs/deploy.md)

## 目录结构

```
ai-creative-workbench
├── frontend/              # React + Vite 前端
├── backend-java/          # Spring Boot 业务后端
├── ai-service-python/     # FastAPI AI 服务
├── docs/                  # 文档
│   ├── deploy.md          # Docker 部署（推荐先看）
│   ├── java-python-architecture.md
│   └── ...
├── docker-compose.yml
└── README.md
```