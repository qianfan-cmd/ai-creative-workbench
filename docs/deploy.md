# Docker 部署指南

> 更新日期：2026-09-06  
> 适用环境：Windows + Docker Desktop（WSL2 引擎）

本文说明如何使用 Docker 一键启动 **AI Creative Workbench** 全套服务，并记录部署过程中常见问题与解决方法。

---

## 1. 架构概览

```
浏览器 → http://localhost:8088 (Nginx 前端)
              ├─ /api/*      → backend:8080  (Spring Boot)
              └─ /uploads/*  → backend:8080

backend → mysql:3306          (MySQL 8)
backend → ai:8000             (FastAPI)
```

| 容器 | 镜像名 | 宿主机端口 | 说明 |
|------|--------|------------|------|
| `workbench-frontend` | `workbench-frontend:latest` | **8088** → 80 | React 静态资源 + Nginx 反向代理 |
| `workbench-backend` | `workbench-backend:latest` | **8080** → 8080 | Java 业务 API |
| `workbench-ai` | `workbench-ai:latest` | **8000** → 8000 | Python AI 服务 |
| `workbench-mysql` | `mysql:8.0` | **3307** → 3306 | 数据库（避免与本机 3306 冲突） |

容器之间通过 **docker-compose 服务名** 互连（如 `mysql`、`backend`、`ai`），不要用 `localhost`。

---

## 2. 前置条件

1. 安装并启动 [Docker Desktop](https://www.docker.com/products/docker-desktop/)（左下角显示 **Engine running**）
2. 无需 Docker 账号登录（本地 build/run 不要求 Sign in）
3. 准备好 `ai-service-python/.env`（可从 `.env.example` 复制并填入 API Key）
4. 本机已有一套可导出的 `workbench` 数据库（或按 `docs/sql/` 手动建表）

---

## 3. 构建镜像

在项目根目录分别构建三个业务镜像（首次较慢，后续有缓存会快很多）。

### 3.1 Java 后端

```bash
cd backend-java
docker build -t workbench-backend .
```

- 多阶段构建：Maven 编译 → JRE 运行
- 产物 jar：`backend-java-0.0.1-SNAPSHOT.jar`

### 3.2 Python AI 服务

```bash
cd ai-service-python
docker build -t workbench-ai .
```

- 依赖见 `requirements.txt`（含 `python-multipart`，文件上传接口需要）

### 3.3 前端

```bash
cd frontend
docker build -t workbench-frontend .
```

- 多阶段构建：Node 22 + pnpm build → Nginx 托管 `dist/`
- **必须**存在 `frontend/.dockerignore`（排除 `node_modules`），否则 Windows 上 pnpm 符号链接会导致 build 失败

验证：

```bash
docker images | grep workbench
```

应看到 `workbench-backend`、`workbench-ai`、`workbench-frontend` 三个镜像。

---

## 4. 数据库准备

Docker 里的 MySQL 是**独立空库**（或持久化 volume），不会自动同步本机 MySQL 数据，需要**导出 → 导入**。

### 4.1 从本机导出（务必用 Git Bash）

```bash
cd /e/ai-creative-workbench   # 路径按你的盘符调整
mysqldump -u root -p --single-transaction --set-gtid-purged=OFF workbench > workbench_backup.sql
```

导出后检查编码（**必须是 UTF-8，不能是 UTF-16**）：

```bash
file workbench_backup.sql
head -n 3 workbench_backup.sql
```

正常应看到 `-- MySQL dump` 等 ASCII 文本，而不是 `UTF-16` 或乱码 `��-`。

> **不要用 PowerShell 的 `>` 重定向导出**  
> PowerShell 默认会生成 **UTF-16 LE** 文件，MySQL 导入时报 `ASCII '\0'` 或乱码错误。若必须用 PowerShell，请用 `cmd /c "mysqldump ... > file.sql"`，或在编辑器中 **另存为 UTF-8**。

### 4.2 启动 MySQL 并导入

```bash
cd /e/ai-creative-workbench
docker compose up -d mysql
# 等待 healthy
docker compose ps
```

推荐导入方式（Git Bash 或 docker cp，**不要用 `Get-Content | docker exec`**）：

```bash
# 方式 A：docker cp + source（PowerShell / Git Bash 均可）
docker cp workbench_backup.sql workbench-mysql:/tmp/backup.sql
docker exec workbench-mysql mysql -uroot -pworkbench workbench -e "source /tmp/backup.sql"

# 方式 B：Git Bash 重定向
docker exec -i workbench-mysql mysql -uroot -pworkbench workbench < workbench_backup.sql
```

验证：

```bash
docker exec workbench-mysql mysql -uroot -pworkbench -e "SHOW TABLES FROM workbench;"
docker exec workbench-mysql mysql -uroot -pworkbench workbench -e "SELECT COUNT(*) FROM user;"
```

> 注意：`mysql ... -e "SELECT ... FROM user"` 容易报 `No database selected`，应在 `mysql` 与 `-e` 之间加上库名 `workbench`。

---

## 5. 启动全套服务

```bash
cd /e/ai-creative-workbench
docker compose up -d
docker compose ps
```

期望 **4 个容器均为 Up**：

- `workbench-mysql` (healthy)
- `workbench-backend`
- `workbench-ai`
- `workbench-frontend`

### 访问地址

| 用途 | URL |
|------|-----|
| **主入口（推荐）** | http://localhost:8088 |
| Java API 直连 | http://localhost:8080 |
| AI 健康检查 | http://localhost:8000/health |
| Docker MySQL | `localhost:3307`，用户 `root`，密码 `workbench` |

---

## 6. 环境变量说明

### 6.1 Python：`ai-service-python/.env`

由 compose 的 `env_file` 注入容器，至少配置：

```env
MODEL_API_KEY=...
MODEL_BASE_URL=https://api.deepseek.com
MODEL_NAME=deepseek-v4-flash
DASHSCOPE_API_KEY=...    # 万相 / Embedding 等
SEEDREAM_API_KEY=...     # 可选
```

### 6.2 Java：compose 内 `environment`

| 变量 | 作用 |
|------|------|
| `SPRING_DATASOURCE_URL` | 指向 compose 网络内的 `mysql:3306` |
| `SPRING_DATASOURCE_USERNAME` / `PASSWORD` | Docker MySQL 凭据 |
| `APP_AI_SERVICE_BASE_URL` | `http://ai:8000` |
| `APP_UPLOAD_DIR` | 容器内 `/app/uploads`（volume 持久化） |
| `APP_FRONTEND_BASE_URL` | 邮件重置链接等用，Docker 下为 `http://localhost:8088` |

本地 SMTP（找回密码）仍在 `application-local.yml`，Docker 镜像默认不包含该文件；容器内找回密码邮件需另行配置 `spring.mail.*` 环境变量或挂载配置。

---

## 7. 常用运维命令

```bash
docker compose up -d              # 后台启动
docker compose down               # 停止并删除容器（volume 保留）
docker compose down -v            # 连 volume 一起删（清空 Docker 数据库）
docker compose restart backend    # 重启单个服务
docker compose logs -f backend    # 跟踪日志
docker compose logs ai --tail 50  # 查看最近日志
```

代码变更后需**重新 build 镜像**再 up：

```bash
cd backend-java && docker build -t workbench-backend .
cd ai-service-python && docker build -t workbench-ai .
cd frontend && docker build -t workbench-frontend .
cd .. && docker compose up -d
```

---

## 8. 本地开发 vs Docker 模式

| 模式 | 前端 | 后端 | AI | 数据库 |
|------|------|------|-----|--------|
| **本地开发** | `:5173` Vite | `:8080` IDE | `:8000` uvicorn | 本机 `:3306` |
| **Docker 部署** | `:8088` Nginx | `:8080` 容器 | `:8000` 容器 | Docker `:3307` |

**不要同时占用同一端口。** 若本机 Spring Boot 已在跑，`docker compose up` 会报：

```text
bind: Only one usage of each socket address ... 8080
```

解决：停止 IDE 里的 backend / 本机 Python，再 `docker compose up -d`；或把 compose 里 backend 的 `8080:8080` 改成 `8081:8080`（前端经 Nginx 访问不受影响）。

---

## 9. 常见问题与解决方案

### 9.1 Docker 客户端连不上引擎

```text
open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified
```

**原因**：Docker Desktop 未启动或未就绪。  
**解决**：打开 Docker Desktop，等左下角 **Engine running**，新开终端再执行命令。无需登录 Docker 账号。

---

### 9.2 拉取 Docker Hub 镜像超时 / 403

```text
failed to resolve ... registry-1.docker.io ... connectex
403 Forbidden ... mirror.aliyuncs.com
```

**原因**：国内访问 Docker Hub 不稳定；阿里云加速器对部分镜像返回 403。  
**解决**：在 Dockerfile 的 `FROM` 使用 DaoCloud 前缀，例如：

```dockerfile
FROM docker.m.daocloud.io/library/maven:3.9-eclipse-temurin-17 AS build
FROM docker.m.daocloud.io/library/node:22-alpine AS build
```

Docker Engine 的 `registry-mirrors` 若配置错误会导致 JSON 解析失败；`registry-mirrors` 应与 `builder`、`experimental` **同级**，不要多包一层 `{}`：

```json
{
  "builder": { "gc": { "defaultKeepStorage": "20GB", "enabled": true } },
  "experimental": false,
  "registry-mirrors": ["https://你的ID.mirror.aliyuncs.com"]
}
```

---

### 9.3 前端 build：`unknown file mode` / 上下文 200MB+

**原因**：未排除 `node_modules`，Windows 上 pnpm 符号链接无法打入构建上下文。  
**解决**：确保 `frontend/.dockerignore` 包含：

```text
node_modules
dist
.git
```

---

### 9.4 前端 build：pnpm 要求 Node 22

```text
This version of pnpm requires at least Node.js v22.13
```

**原因**：`pnpm@latest`（v11）需要 Node 22+，镜像仍是 Node 20。  
**解决**：Dockerfile 使用 `node:22-alpine`，本机开发也建议 Node 22 + `corepack prepare pnpm@latest`。

---

### 9.5 前端 build：TypeScript 报错

`pnpm build` 执行 `tsc -b && vite build`，比 `pnpm dev` 更严格。未使用变量、错误 import 等会导致镜像构建失败。  
**解决**：本地先 `pnpm build` 通过，再 `docker build`。

---

### 9.6 数据库导入：`\0` / 乱码 / PowerShell 管道失败

| 现象 | 原因 | 解决 |
|------|------|------|
| `ASCII '\0' appeared` | SQL 文件为 UTF-16 | Git Bash 重新 `mysqldump`，或编辑器另存 UTF-8 |
| `Unknown MySQL server host '????'` | PowerShell `Get-Content \| docker exec` 破坏编码 | 用 `docker cp` + `source`，或 Git Bash `<` 重定向 |
| `No database selected` | 验证命令未指定库名 | `mysql ... workbench -e "SELECT ..."` |

---

### 9.7 `docker compose ps` 只有 mysql

**原因**：只导入了数据，未执行全量 `docker compose up -d`；或 backend/ai 启动失败已退出。  
**解决**：

```bash
docker compose up -d
docker compose ps -a
docker compose logs backend --tail 50
docker compose logs ai --tail 50
```

---

### 9.8 AI 容器 Exited (1)：`python-multipart`

```text
Form data requires "python-multipart" to be installed
```

**原因**：FastAPI 文件上传依赖未写入 `requirements.txt`，本机 venv 可能有、镜像里没有。  
**解决**：在 `ai-service-python/requirements.txt` 添加 `python-multipart`，重新：

```bash
docker build -t workbench-ai .
docker compose up -d ai
```

---

## 10. 验收清单

- [ ] `docker images` 有三个 `workbench-*` 镜像
- [ ] `docker compose ps` 四个服务均为 **Up**
- [ ] http://localhost:8088 可打开登录页并登录
- [ ] http://localhost:8000/health 返回 `{"status":"ok",...}`
- [ ] Chat / 知识库 / 素材等核心功能可用

---

## 11. 相关文件

| 文件 | 说明 |
|------|------|
| `docker-compose.yml` | 四服务编排与端口 |
| `backend-java/Dockerfile` | Java 多阶段构建 |
| `ai-service-python/Dockerfile` | Python AI 镜像 |
| `frontend/Dockerfile` | 前端 build + Nginx |
| `frontend/nginx.conf` | SPA 路由与 `/api` 反向代理 |
| `ai-service-python/.env.example` | AI 环境变量模板 |

CI/CD（GitHub Actions）见后续文档或 `.github/workflows/`（待补充）。
