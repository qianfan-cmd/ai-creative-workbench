# GitHub Actions CD + GHCR 部署 ECS（含密钥分层与线上排障）

> 2026-09 · AI Creative Workbench · 面试向开发复盘  
> Roadmap：Wave A · **3d**（CD1～CD4）· **已验收**（公网 Demo 可登录）

## 1. 背景与目标

**用户痛点**

- 公网 Demo 更新靠本机 `docker build` → `docker save` → `scp`（大 tar 易断）→ ECS `docker load`，步骤多、不可复现。
- CI 已有（三 job 编译），缺 **CD**（一键部署到 ECS）。
- 密钥若写进 Git 有泄露风险；用 `*` 占位又会导致 YAML 解析失败、backend 起不来。

**目标**

1. GitHub Actions **workflow_dispatch** 构建三镜像并推 **GHCR**。
2. SSH 到 ECS：`git pull` + `compose pull/up`（仅 backend / frontend / ai）。
3. **密钥不进仓库**：本机 / Docker / ECS 分层注入，CD 不覆盖服务器上的密钥文件。
4. 支持 **按 commit SHA 回滚**（skip_build + 指定 tag）。

---

## 2. 端到端原理（一张图看懂）

```
开发者 push main
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  GitHub Actions · Deploy to ECS                               │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │ build-and-push      │    │ deploy (appleboy/ssh-action) │  │
│  │ · mvn package       │    │ · git pull origin main       │  │
│  │ · docker build ×3   │───▶│ · echo WORKBENCH_IMAGE_TAG   │  │
│  │ · push → GHCR       │    │ · compose pull/up (3 服务)   │  │
│  └─────────────────────┘    └─────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
       │                                    │
       ▼                                    ▼
  ghcr.io/.../backend|frontend|ai     ECS /root/ai-creative-workbench
  :<commit-sha>  +  :latest           · .env.workbench（镜像 tag，CD 写）
                                      · .env.secrets（JWT，只配一次）
                                      · ai-service-python/.env（AI Key）
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  ECS Docker Compose（docker-compose.yml + prod.yml）          │
│                                                               │
│  浏览器 :8088 → frontend(Nginx) ──/api/*──▶ backend:8080     │
│                                    │              │           │
│                                    │         mysql:3306      │
│                                    │              │           │
│                                    └──▶ ai:8000              │
└──────────────────────────────────────────────────────────────┘
```

**为何 CD 只 pull/up 三个业务容器？**

- `mysql` 用命名卷 `mysql_data` 持久化，不应随每次发版重建。
- `uploads_data` 同理。
- prod 覆盖文件只改 `backend` / `frontend` / `ai` 的 **GHCR 镜像地址** 和公网 URL。

**镜像 tag 如何 pin 到某次 commit？**

- Actions 构建时打 tag：`<github.sha>` 与 `latest`。
- SSH 脚本在 ECS 写入 `.env.workbench`：`WORKBENCH_IMAGE_TAG=<sha>`。
- `docker-compose.prod.yml` 引用：`ghcr.io/.../backend:${WORKBENCH_IMAGE_TAG:-latest}`。
- `compose pull` 拉指定 SHA 的镜像，`up -d` 滚动替换容器。

---

## 3. 密钥分层原理（不进 Git、不用每次 deploy 手改）

Spring Boot 配置合并顺序（后者覆盖前者）：

```
application.yml（仓库，无真实密码）
    → optional:application-local.yml（本机 IDE，gitignore）
    → 环境变量（Docker Compose 注入，优先级最高）
```

| 层级 | 文件 / 来源 | 作用范围 | 是否进 Git | CD 是否覆盖 |
|------|-------------|----------|------------|-------------|
| 结构配置 | `application.yml` | 全环境默认值 | ✅ | 随 git pull 更新 |
| 本机私密 | `application-local.yml` | IDE 直连本机 MySQL | ❌ gitignore | 不涉及 ECS |
| Docker MySQL | compose `SPRING_DATASOURCE_*` | 容器内连 `mysql:3306` | ✅（Demo 密码 `workbench`） | 随 compose 更新 |
| ECS JWT | `.env.secrets` → `JWT_SECRET` | 生产 JWT 签名 | ❌ 仅 ECS 磁盘 | **不覆盖** |
| AI Key | `ai-service-python/.env` | Python 服务 | ❌ | **不覆盖** |
| 镜像版本 | `.env.workbench` → `WORKBENCH_IMAGE_TAG` | 本次部署 SHA | ❌ | CD 每次重写 |

**设计原则**

- 仓库里 **绝不** 写真实密码；**勿用 `*`** 占位（YAML 中 `*` 是 alias 语法，会导致 SnakeYAML 启动失败）。
- 需要「服务器上有、仓库里没有」的文件 → 放在 ECS 本地，compose 用 `env_file` 挂载。
- `git pull` 只更新代码和 compose **结构**；`.env.secrets` / `ai-service-python/.env` 与 volume 数据一直保留。

---

## 4. 方案选型

| 决策点 | 选型 | 理由 |
|--------|------|------|
| 镜像仓库 | **GHCR** | 与 GitHub 同域、`GITHUB_TOKEN` 可 push；免自建 Registry |
| Backend 构建 | Runner 上 `mvn package` + **`Dockerfile.runtime`** | 多阶段 Maven Dockerfile 在 Windows 本地曾不稳定；CI 分步更可控 |
| Frontend / AI | 现有 Dockerfile 直接 build-push | 与本地一致 |
| Compose 生产覆盖 | `docker-compose.prod.yml` | GHCR `image:` + 公网 URL + `env_file: .env.secrets` |
| 版本 pin | ECS `.env.workbench` | compose 变量替换；CD 写入 commit SHA |
| 触发方式 | 仅 **workflow_dispatch** | 首版避免误 push 直接上生产 |
| SSH | **appleboy/ssh-action** + **密钥登录** | 密码登录无法用于 Actions |

---

## 5. 关键实现

### 5.1 新增 / 修改文件

| 文件 | 作用 |
|------|------|
| `backend-java/Dockerfile.runtime` | CI 先 `mvn package`，镜像只 COPY jar |
| `.github/workflows/deploy.yml` | build-and-push + SSH deploy |
| `docker-compose.prod.yml` | GHCR 镜像、公网 URL、`env_file: .env.secrets` |
| `env.secrets.example` | ECS `.env.secrets` 模板（JWT） |
| `application.yml` | 去掉 `password` 行；JWT 用合法占位符 |

### 5.2 GitHub Actions Secrets（给 Workflow 用）

| Secret | 用途 |
|--------|------|
| `ECS_HOST` | ECS 公网 IP |
| `ECS_USER` | SSH 用户（`root`） |
| `ECS_SSH_KEY` | SSH **私钥**全文 |
| `ECS_DEPLOY_PATH` | 项目路径 `/root/ai-creative-workbench` |
| `GHCR_PAT` | （可选）GHCR 包 private 时 ECS pull 前 login |

### 5.3 与 CI 的分工

- [`githubCI.yml`](../.github/workflows/githubCI.yml)：`push` / PR → 编译检查，**不部署**。
- [`deploy.yml`](../.github/workflows/deploy.yml)：手动 Run workflow → 构建镜像 + 部署。

---

## 6. 踩坑与排障（本次线上真实经历）

| 现象 | 根因 | 解法 |
|------|------|------|
| `ssh: unable to authenticate, attempted methods [none publickey]` | 本机用 **密码** SSH ECS，Actions 只支持 **公钥**；`ECS_SSH_KEY` 未配或配错 | 生成 `workbench_deploy` 密钥对；公钥写入 ECS `~/.ssh/authorized_keys`；私钥存入 GitHub Secret |
| 登录页能开，点登录 **502 Bad Gateway** | `workbench-backend` **Exited (1)**，Nginx 转发 `/api` 无 upstream | `docker compose ps -a` + `logs backend` 查崩溃原因 |
| backend 日志 `ScannerException … password: *` | 仓库 `application.yml` 用 `*****` 占位密码；YAML 解析阶段即失败，**环境变量还没来得及注入** | 从 `application.yml` **删除 password**；MySQL 靠 `SPRING_DATASOURCE_PASSWORD`；JWT 靠 `.env.secrets` |
| 担心「服务器从 Git 拉代码，密码放哪」 | 混淆了 **代码仓库** 与 **运行时配置** | 密钥放 ECS 本地文件（`.env.secrets`）或 compose 环境变量；CD 不覆盖这些文件 |
| 本机停 Docker 后公网 502？ | 本机停容器 **不影响** ECS；502 是 ECS 上 backend 挂了 | 在 ECS 上查容器状态，不要在本机排查公网问题 |

**502 排查口诀**

1. `ps -a` → backend 是否 **Up**
2. `logs backend` → 是否 YAML / 连库 / OOM
3. `curl localhost:8080` → 绕过 Nginx 直连 Java

---

## 7. 首次上线 Checklist（一次性）

- [x] GitHub Secrets：`ECS_HOST` / `ECS_USER` / `ECS_SSH_KEY` / `ECS_DEPLOY_PATH`
- [x] ECS：`~/.ssh/authorized_keys` 含 deploy 公钥
- [x] ECS：`cp env.secrets.example .env.secrets` 并设置 `JWT_SECRET`
- [x] ECS：已有 `ai-service-python/.env`
- [x] push `main` → Actions **Deploy to ECS** 成功
- [x] http://8.148.238.164:8088 **登录成功**

---

## 8. 日常运维

**发新版 Demo**

1. merge / push 到 `main`
2. Actions → Deploy to ECS → Run workflow

**回滚**

- Run workflow，**image_tag** = 旧 commit SHA，勾选 **skip_build**

**换 JWT（不必重新 deploy 镜像）**

```bash
nano ~/ai-creative-workbench/.env.secrets
docker compose --env-file .env.workbench -f docker-compose.yml -f docker-compose.prod.yml restart backend
```

---

## 9. 面试话术（STAR）

- **Situation**：公网 Demo 在阿里云 ECS，更新靠本机 scp 几 GB 镜像 tar，易断、不可复现；CI 已有但无 CD。  
  **Task**：设计 GitHub Actions → GHCR → ECS 的一键部署，且密钥不能进 Git。  
  **Action**：Runner 构建三镜像 push GHCR；SSH 执行 git pull + compose pull/up；镜像 tag 用 commit SHA pin；密钥三层（application-local / compose env / ECS `.env.secrets`）；SSH 改用 deploy 专用密钥对。  
  **Result**：workflow_dispatch 一键更新 Demo；502 与 SSH /auth、YAML 占位等坑均有文档化排障路径；公网可登录验收通过。

- **Situation**：CD 后登录 502，frontend Up、backend Exited。  
  **Task**：定位是 Nginx 还是 Java 问题。  
  **Action**：`compose ps -a` 见 backend Exited；日志为 SnakeYAML 在 `password: *` 处失败；改为仓库无 password、运行时 env 注入。  
  **Result**：理解「Spring 先 parse YAML 再读 env」顺序；生产密钥与代码仓库解耦。

- **Situation**：Actions SSH 报 publickey 认证失败。  
  **Action**：区分 GitHub Secrets（给 CI 用）与 ECS 运行时 secrets；为 ECS 配置专用 ed25519 密钥，本机验证 `ssh -i key root@host` 免密后再写入 Secret。  
  **Result**：Deploy job 稳定通过。

---

## 10. 关键文件

| 文件 | 作用 |
|------|------|
| [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) | CD workflow |
| [`docker-compose.prod.yml`](../docker-compose.prod.yml) | GHCR + prod env |
| [`env.secrets.example`](../env.secrets.example) | JWT 模板 |
| [`docs/deploy.md` §12](../deploy.md) | 操作手册 |
| Demo | http://8.148.238.164:8088 |

---

## 11. 下一步

- **Wave A · 1-F**：域名 + HTTPS（Let's Encrypt）
- 可选：`push` tag `v*` 触发自动 deploy
