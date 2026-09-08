# GitHub Actions CD + GHCR 部署 ECS

> 2026-09 · AI Creative Workbench · 面试向开发复盘  
> Roadmap：Wave A · **3d**（CD1～CD4）

## 1. 背景与目标

**用户痛点**

- 公网 Demo 更新靠本机 `docker build` → `docker save` → `scp`（大 tar 易断）→ ECS `docker load`，步骤多、不可复现。
- CI 已有（三 job 编译），缺 **CD**（一键部署到 ECS）。

**目标**

1. GitHub Actions **workflow_dispatch** 构建三镜像并推 **GHCR**。
2. SSH 到 ECS：`git pull` + `compose pull/up`（仅 backend / frontend / ai）。
3. 支持 **按 commit SHA 回滚**（skip_build + 指定 tag）。
4. 文档化 Secrets 与验收清单。

---

## 2. 方案选型

| 决策点 | 选型 | 理由 |
|--------|------|------|
| 镜像仓库 | **GHCR** | 与 GitHub 同域、`GITHUB_TOKEN` 可 push；免自建 Registry |
| Backend 构建 | Runner 上 `mvn package` + **`Dockerfile.runtime`** | 多阶段 Maven Dockerfile 在 Windows 本地曾不稳定；CI 分步更可控 |
| Frontend / AI | 现有 Dockerfile 直接 build-push | 与本地一致 |
| Compose 生产覆盖 | `docker-compose.prod.yml` 写 GHCR `image:` + env | 基座 `docker-compose.yml` 仍服务本机 `workbench-*:latest` |
| 版本 pin | ECS 上 `.env.workbench` → `WORKBENCH_IMAGE_TAG` | compose 变量替换；CD 每次写入当前 SHA |
| 触发方式 | 仅 **workflow_dispatch** | 首版避免误 push 直接上生产；回滚用 input |
| SSH | **appleboy/ssh-action** | 成熟、脚本内联清晰 |

**放弃的方案**

- **scp docker save tar**：体积大、断点难续，已作为临时方案退役。
- **ECS 上 docker build**：2C2G 编译 frontend/backend 慢且占内存。
- **push main 自动 deploy**：首版风险高，后续可加 tag 触发。

---

## 3. 实现要点

### 3.1 新增文件

| 文件 | 作用 |
|------|------|
| `backend-java/Dockerfile.runtime` | 只 COPY 已打好的 jar，JRE 运行 |
| `.github/workflows/deploy.yml` | build-and-push job + deploy job |
| `docker-compose.prod.yml` | GHCR 三服务 `image:` + 公网 URL env |

### 3.2 Workflow 结构

```
build-and-push (可 skip)
  login GHCR → mvn package → push backend/frontend/ai (:sha + :latest)
deploy
  SSH: git pull → .env.workbench → compose pull/up → ps
```

### 3.3 Secrets（仓库 Settings → Actions）

- `ECS_HOST`、`ECS_USER`、`ECS_SSH_KEY`、`ECS_DEPLOY_PATH`
- `GHCR_PAT`（可选）：包 private 时 ECS pull 前 `docker login`

### 3.4 与 CI 关系

- [`githubCI.yml`](../.github/workflows/githubCI.yml)：`push`/`PR` 编译检查，**不**部署。
- [`deploy.yml`](../.github/workflows/deploy.yml)：手动触发，**不**阻塞 merge。

---

## 4. 风险与运维

| 风险 | 缓解 |
|------|------|
| 首次 CD 前 ECS 无 prod compose | 必须先 **push main** 再 Run workflow |
| GHCR 包默认 private | 公开 repo 可在 Packages 设 public；或配 `GHCR_PAT` |
| `git pull` 失败 | 确认 ECS 为 public clone；私有 repo 需在 ECS 配 deploy key |
| AI Key 丢失 | `ai-service-python/.env` 在 ECS 本地，CD 不覆盖 |
| 数据库 / 上传 | 只重启三业务容器；`mysql_data`、`uploads_data` volume 保留 |

---

## 5. 验收清单

- [ ] Actions Build & push 三镜像成功
- [ ] Packages：`backend` / `frontend` / `ai` 可见
- [ ] ECS `docker compose ps` 四服务 Up
- [ ] http://8.148.238.164:8088 功能正常
- [ ] skip_build + 旧 `image_tag` 回滚成功

---

## 6. 下一步

- **Wave A · 1-F**：域名 + HTTPS（Let's Encrypt），更新 `APP_PUBLIC_BASE_URL` 与 Nginx。
- 可选：CD 成功后给 `push` tag `v*` 加自动 deploy。

---

## 7. 相关链接

- [`docs/deploy.md` §12](../deploy.md)
- [`docs/project-roadmap.md` §4.4](../project-roadmap.md)
- Demo：http://8.148.238.164:8088
