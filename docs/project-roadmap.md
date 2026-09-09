# AI Creative Workbench — 项目迭代计划表

> 更新日期：2026-09-10（Wave D D1.8 Admin 信号 + embed filename）  
> 目标岗位：AI 应用前端 / AI 全栈（腾讯 AI 应用工程师、字节 AIGC / 飞书 Agent 全栈等）  
> 说明：本文仅作计划与验收清单；每项具体用 **Chat 带着做** 还是 **Agent 直接做**，实施时再定。

---

## 一、总览

| 阶段 | 主题 | 预估 | 核心产出 |
|------|------|------|----------|
| **Phase 1** | 亮点 + 作品化 | 5～7 天 | 公网 Demo、前端工程亮点、**Wave C** README/面试材料 |
| **Phase 1.5** | 性能 + 部署加固 | 2～3 天 | 素材 N+1、懒加载、2G ECS 稳定、**Wave A** CD/HTTPS |
| **Phase 2** | RAG 扩展 PDF/DOCX | 2～3 天 | **Wave B** 知识库 pdf/docx 上传与问答 |
| **Phase 3（Wave D）** | JD 对齐增强 | 6～9 天 | LangChain 混合检索、Tool+Tavily、反馈闭环、上下文管理、可选 Redis |

**原则**

- 先能 **演示、能讲清**，再追 Agent / MCP 等关键词。
- **当前迭代顺序（2026-09 起）：Wave A → Wave B → Wave C → Wave D（Phase 3）**；Wave D 细则见 [`phase3-wave-d-requirements.md`](phase3-wave-d-requirements.md)。
- **Dev-log 门禁：** 每个里程碑验收通过后，必须在 [`docs/dev-log/`](dev-log/) 写复盘（见 [`.cursor/skills/dev-log-retrospective/SKILL.md`](../.cursor/skills/dev-log-retrospective/SKILL.md)），再进入下一序号。
- 不堆 Nacos、Spring Cloud Gateway、Spring AI、Kafka 全链路。
- 生成/Prompt/SSE **手写保留**；**LangChain 仅用于 Wave D1 检索链**；不整体替换、不默认上 LangGraph 主线。

---

## 二、已完成（不再重复做）

| 项 | 说明 |
|----|------|
| Docker 三镜像 | `backend-java` / `ai-service-python` / `frontend` Dockerfile |
| docker-compose 四服务 | MySQL + Java + Python + Nginx 前端 |
| 部署文档 | [`deploy.md`](deploy.md)（含常见问题） |
| GitHub Actions CI | [`.github/workflows/githubCI.yml`](../.github/workflows/githubCI.yml)，三 job 全绿 |
| 核心业务 | Chat SSE、RAG（md/txt）、美术机台、Campaign、AI 用量预估、管理后台 |
| Java + Python 架构 | BFF + AI 能力层，RestTemplate / FastAPI |
| **公网 Demo（HTTP）** | 阿里云轻量 `8.148.238.164:8088`；四容器 compose；uploads 同步；Swap + `JAVA_TOOL_OPTIONS`；nginx `/assets` 路由修复 |
| **Phase 1.5 核心** | O1～O6 素材 N+1/懒加载；D1/D2 部署分离；Grid/List 批量删除 |
| **Chat Week 13** | 虚拟列表 + 流式 UX；lazy load；统一错误体验（`apiError.ts`） |

---

## 三、Phase 1：亮点 + 作品化

> **§3.1～3.3 功能亮点大部分已完成**；§3.2 portfolio 与 §3.4 interview 材料延后至 **Wave C**（Wave B 之后）。

### 3.1 公网 Demo

| 项 | 内容 |
|----|------|
| **状态** | **HTTP Demo 已完成** — http://8.148.238.164:8088 |
| **做什么** | 阿里云 ECS 轻量服务器 + `docker compose up` |
| **改什么** | 服务器上 `APP_PUBLIC_BASE_URL` / `APP_FRONTEND_BASE_URL` 改为公网 `:8088`；本机 `docker-compose.yml` 保持 `localhost` |
| **参考** | [`deploy.md`](deploy.md)；Phase 1.5 部署复盘见下文 |
| **验收** | 面试官可打开链接登录；Chat / 知识库 / 素材各测至少 1 次；素材页刷新无 502 |
| **安全** | 演示专用 API Key、演示账号；`.env`、`workbench_backup.sql` 不进 Git |

**可选子项 1-F（未做）：** 绑定域名 + HTTPS（Let's Encrypt）；简历可先写 HTTP Demo 链接。

### 3.2 README + 架构图 + 作品说明

| 项 | 内容 |
|----|------|
| **做什么** | 完善 [`README.md`](../README.md)；新增 `docs/portfolio.md` |
| **必含** | 项目定位、技术栈、Mermaid 架构图、3～5 张截图、启动方式、**公网 Demo 链接** |
| **作品说明结构**（对齐飞书等 JD「作品入口」） | ① 解决的问题 ② 个人贡献 ③ AI 方案 ④ 验证结果 ⑤ 一次关键迭代 |
| **验收** | 陌生人 5 分钟内能看懂项目并点开 Demo |

### 3.3 前端 Week 13 亮点

| 序号 | 任务 | 主要文件 | 验收标准 |
|------|------|----------|----------|
| 1 | Chat 消息虚拟列表 | `frontend/src/pages/ChatPage.tsx`（可参考 `VirtualAssetGrid`） | 长会话滚动流畅（如 1000 条不卡） |
| 2 | 路由 lazy load | `frontend/src/router/index.tsx` | `React.lazy` + `Suspense`，首屏 bundle 减小 |
| 3 | 统一错误体验 | `frontend/src/api/request.ts` + 关键页 | 401、网络超时、AI 失败、文件过大等有清晰提示 |
| 4 | 上传体验（可选） | `AssetUploadPage` | 进度条、大小限制提示 |

**刻意不做：** 通用 Canvas 图片预览器 —— 抠图裁切 `CropRegionEditor` 已可作为 Canvas 面试故事。

**素材页性能与懒加载**见 Phase 1.5 §4.2（O1～O6）；部署加固见 §4.3。

### 3.4 文档与面试材料

| 文件 | 内容 |
|------|------|
| `docs/architecture.md` | 正式架构说明（可扩展 `java-python-architecture.md`） |
| `docs/interview.md` | 8 个 STAR 故事：SSE、Java+Python、RAG、工作流、Docker/CI、用量计费等 |
| `docs/rag-eval.md` | RAG 策略与评测说明（chunk、TopK、bad case；Phase 2 后补充 PDF 案例） |

### Phase 1 完成标准

- [x] 公网 Demo 可访问（HTTP）
- [x] 素材页刷新稳定、Grid 模式 API 无 N+1（Phase 1.5）
- [x] Chat 虚拟列表 + lazy + 错误体验上线
- [x] README + portfolio 完成（**Wave C**）
- [x] `interview.md` 可背诵级（**Wave C**）

---

## 四、Phase 1.5：性能与部署加固（Demo 复盘）

> 来源：2026-09-07 公网 Demo 联调踩坑；**本轮仅文档排期，实施按序号 3a～3c 动手**。

### 4.0 问题复盘（Incident → 根因 → 对策）

| 现象 | 根因 | 代码/运维对策 | 优先级 |
|------|------|---------------|--------|
| 登录 / API 502 | `application.yml` 密码含 `#` 未加引号，YAML 解析失败 | 仓库内用占位密码 + Docker env 覆盖；[`deploy.md`](deploy.md) 补充说明 | P0 |
| 图片空白 / 查看 502 | `APP_PUBLIC_BASE_URL` 指向 `:8080`，防火墙仅放行 `:8088` | 生产统一 `http://<IP>:8088`；本地/生产 compose 分离 | P0 |
| 刷新素材页 502 | React 路由 `/assets` 与 Vite 打包目录 `dist/assets/` 冲突 | [`frontend/nginx.conf`](../frontend/nginx.conf) 增加 `location = /assets`；长期改 `vite build.assetsDir` | P0 |
| 刷新后间歇 502 / SSH 卡死 | 2G 内存 + Grid 一次 40 条 + **N+1 查标签** + 40 张缩略图并发 | 见 §4.1 O1～O6；**禁止在 ECS 上 `docker build frontend`** | P0 |
| `/uploads` 404 返回 JSON | `GlobalExceptionHandler` 捕获过宽 | 静态资源 404 不走 `Result` JSON 包装 | P1 |
| 老素材无图 | 只导入 SQL，未同步 `uploads` volume | 部署检查清单：DB dump + `uploads` 目录 | P1 |

### 4.1 2G 轻量服务器运维备忘

| 项 | 建议 |
|----|------|
| Swap | 2G swapfile，`/etc/fstab` 持久化 |
| Java 堆 | `JAVA_TOOL_OPTIONS: "-Xmx512m -Xms256m"` |
| MySQL | 可选 `command: --innodb-buffer-pool-size=128M` |
| 构建前端镜像 | **本机** `docker build` → `docker save` → `scp` → 服务器 `docker load`（**临时方案，见 §4.4 CD**） |
| 仅改 nginx.conf | `docker cp` + `nginx -s reload`（临时）；正式应打入镜像 |
| 配置分离 | 仓库 [`docker-compose.yml`](../docker-compose.yml) 用 `localhost:8088`；服务器用 `docker-compose.prod.yml` 或 `.env` 覆盖公网 IP |

### 4.2 素材页 API / 前端优化（架构方案）

**现状（代码事实）：**

- [`AssetService.toAssetVO`](../backend-java/src/main/java/com/workbench/backendjava/service/AssetService.java) 每条素材调用 `loadTagsForAsset` → **N+1**（Grid 40 条 ≈ 80+ 次 SQL）
- Grid 视图 [`AssetGridCard`](../frontend/src/components/assets/AssetGridCard.tsx) **不展示标签**，但列表 API 仍返回 `tags`
- [`AssetListPage`](../frontend/src/pages/AssetListPage.tsx) 挂载时即 `listTagsApi()`，即使用户未打开筛选下拉
- [`VirtualAssetGrid`](../frontend/src/components/assets/VirtualAssetGrid.tsx) 已做 **DOM 虚拟化**，但 API 仍一次拉 `GRID_PAGE_SIZE=40` 条完整 `AssetVO`

**数据流（目标态）：**

```mermaid
flowchart LR
  subgraph gridMode [Grid模式]
    A1["GET /assets?includeTags=false&size=20"]
    A2["仅 url/name/type/size"]
  end
  subgraph listMode [List模式]
    B1["GET /assets?includeTags=true&size=10"]
    B2["批量查 asset_tag + tag 共2次SQL"]
  end
  subgraph tagFilter [标签筛选]
    C1["下拉 onOpen 才 GET /tags"]
    C2["选定 tagId 后 GET /assets?tagId="]
  end
  gridMode --> tagFilter
  listMode --> tagFilter
```

| 序号 | 任务 | 层级 | 做法 | 验收 |
|------|------|------|------|------|
| **O1** | 列表默认不带 tags | 后端 | `GET /api/assets` 增加 `includeTags`（默认 `false`）；Grid 不传或传 false | Grid 请求 SQL 仅 1 次分页查询 |
| **O2** | 批量加载 tags | 后端 | `includeTags=true` 时：一次 `asset_tag WHERE asset_id IN (...)` + 一次 `tag WHERE id IN (...)`，内存组装 Map | List 模式 10 条仍 ≤3 次 SQL |
| **O3** | 标签下拉懒加载 | 前端 | [`ToolBar`](../frontend/src/components/assets/ToolBar.tsx) `Select` 的 `onOpenChange` 触发 `listTagsApi`；移除 AssetListPage 挂载即请求 | 首屏少 1 个 API |
| **O4** | 按视图区分请求 | 前端 | Grid：`includeTags=false`，`size` 降至 20；List：`includeTags=true`，`size=10` | Grid 刷新 ECS 内存占用明显下降 |
| **O5** | 编辑弹窗 tags | 前端 | [`EditAssetModal`](../frontend/src/components/assets/EditAssetModal.tsx) 打开时再拉 tags + asset 详情 | 不在列表阶段预加载 |
| **O6** | 虚拟列表与分页对齐 | 前端 | 保留 VirtualAssetGrid；无限滚动与 virtualizer `overscan` 协调，避免一次 append 40 条 | 滚动流畅且单次 payload 可控 |
| **O7** | 按可见 id 拉取（可选） | 前后端 | 新 API `GET /assets?ids=` 或 cursor；复杂度高 | Phase 1.5 后期或 Phase 2 前视情况 |

**设计说明（参考产品思路，架构定稿）：**

- **按 tag 筛选**：已有 `tagId` 参数在 SQL 层过滤，**无需**在每条 asset 上再查关联。
- **用户未打开标签下拉**：不请求 `/api/tags`（O3）。
- **Grid 不看标签**：列表 API 不带 tags（O1 + O4），与「用到再请求」一致。
- **List / 编辑需要标签**：`includeTags=true` 或弹窗内单独请求（O2 + O5）。

### 4.3 其它前端 / 后端加固（与 Phase 1 §3.3 衔接）

| 序号 | 任务 | 主要文件 | 验收 |
|------|------|----------|------|
| F1 | Chat 消息虚拟列表 | `frontend/src/pages/ChatPage.tsx` | ✅ |
| F2 | 路由 lazy load | `frontend/src/router/lazyPages.ts` | ✅ |
| F3 | 缩略图 URL 归一化 | `AssetGridCard` + `normalizeMediaUrl` | 生产环境图片正常 |
| F4 | 统一 502 / 超时提示 | `frontend/src/utils/apiError.ts` | ✅ |
| D1 | nginx `/assets` 打入镜像 | `frontend/nginx.conf` + 本机构建 | 重建容器后刷新仍 200 |
| D2 | compose 本地/生产分离 | `docker-compose.prod.yml` 或 `.env` | 仓库不含公网 IP |
| D3 | 静态资源 404 不返回 JSON | `GlobalExceptionHandler.java` | `curl` 缺图返回 404 非 JSON |

### Phase 1.5 完成标准

- [x] O1～O2 上线，Grid 模式后端 SQL ≤1 次分页 + 统计
- [x] O3～O6 上线，素材页首屏 API 数减少
- [x] 2G ECS 上素材页连续刷新 10 次无 502（已验证）
- [x] D1～D2 部署配置规范化（D3 可选 ⬜）
- [ ] **§4.4 CD + HTTPS（Wave A）**

### 4.4 CD 自动化部署（GitHub Actions → ECS）

> **背景：** 当前公网更新依赖本机 `docker build` → `docker save` → `scp`（大文件易断）→ ECS `docker load` → `docker compose up`，步骤多、易出错。**已有 CI**（[`.github/workflows/githubCI.yml`](../.github/workflows/githubCI.yml) 三 job 编译），**缺 CD**（push 后自动部署）。

**目标：** `git push main`（或手动 workflow）→ 自动构建三镜像 → SSH 部署 ECS → `docker compose` 滚动更新，**不再手传 tar**。

| 序号 | 任务 | 内容 | 验收 |
|------|------|------|------|
| **CD1** | 部署 Workflow | 新建 `.github/workflows/deploy.yml`：`workflow_dispatch` + 可选 `push` tag/`main` | Actions 页可一键 Deploy |
| **CD2** | 远程构建镜像 | Runner 上 `docker build`（backend 用 `Dockerfile.runtime` 或带阿里云 Maven mirror 的多阶段 Dockerfile；frontend/ai 照旧） | 三镜像 build 成功 |
| **CD3** | SSH 部署 ECS | GitHub Secrets：`ECS_HOST`、`ECS_USER`、`ECS_SSH_KEY`；SSH 执行 `git pull` + `docker compose -f docker-compose.yml -f docker-compose.prod.yml pull/up` 或 `load` 后 `up -d` | push 后 Demo 自动更新 |
| **CD4** | 文档与回滚 | [`deploy.md`](deploy.md) 补充 CD 说明、Secrets 配置、失败回滚（保留上一版镜像 tag） | 他人可按文档复现 |

**不在 CD 首版范围：**

- uploads / DB 自动同步（仍手动或单独脚本）
- 多环境（staging/prod 两套 ECS）
- Kubernetes

**依赖：** #1 Demo 稳定、D2 `docker-compose.prod.yml` 已用、3a～3b 核心功能已部署验证。

**预估：** 0.5～1 天（含 Secrets 与首次联调）。

**面试一句话：**

> CI 保证合并前编译通过；CD 通过 GitHub Actions SSH 到轻量 ECS，构建 Docker 镜像并 compose 更新，替代手工 scp 分卷传输。

---

## 五、Phase 2：RAG 支持 PDF / DOCX

### 5.1 现状

| 层级 | 位置 | 现状 |
|------|------|------|
| Python | `ai-service-python/app/services/document_parser.py` | 仅 `.md` / `.txt` / `.markdown`，UTF-8 解码 |
| Java | `KnowledgeDocumentService.java` | 同上校验 |
| 前端 | `KnowledgePage.tsx`、`KnowledgeDocumentListPage.tsx` | `accept` 与文案仅 txt/md |
| 链路 | Java 存文件 → Python `indexDocument` | 二进制已传递，瓶颈在 Python 文本解析 |

### 5.2 技术方案

```
上传文件
  → 按后缀分支解析
      .txt / .md / .markdown  → UTF-8（现有）
      .pdf                    → pypdf 或 pymupdf 提取纯文本
      .docx                   → docx2txt 提取文本（段落/页眉/页脚/文本框）
  → split_text → embed → Chroma（不变）
```

**本阶段边界（写进文档，避免 demo 翻车）**

- 不支持扫描版 PDF（无 OCR）。
- 不支持加密 PDF。
- DOCX 用 docx2txt；支持文本框/页眉页脚；纯图片扫描件仍无 OCR。
- 超大文件设字符/页数上限，与 upload max-size 对齐。

### 5.3 预计改动文件（实施时用，现在不动代码）

| 优先级 | 文件 |
|--------|------|
| P0 | `ai-service-python/app/services/document_parser.py` |
| P0 | 新建 `ai-service-python/app/services/binary_document_extractor.py` |
| P0 | `ai-service-python/requirements.txt`（`pypdf`、`docx2txt` 等） |
| P0 | `backend-java/.../KnowledgeDocumentService.java` |
| P0 | `frontend/.../KnowledgePage.tsx`、`KnowledgeDocumentListPage.tsx` |
| P1 | `KnowledgeDocumentEditorPage` — PDF/DOCX 仅索引，编辑器只读或不可编辑 |
| P1 | `docs/deploy.md`、Docker 镜像 rebuild |

### 5.4 验收标准

- [x] 上传 `.pdf`、`.docx` 成功，`chunk_count > 0`（代码已交付，待公网 CD 验收）
- [x] 知识库问答能引用 PDF/DOCX 内容（references 含文件名）
- [x] 原有 md/txt 仍正常
- [x] 空 PDF / 加密 PDF / 扫描版有明确错误提示
- [x] Docker 环境 rebuild 后可用（见 deploy.md）

### 5.5 面试一句话

> RAG 入库统一为 plain text 流水线；解析层按后缀插件化，PDF/DOCX 提取后再 chunk+embed；文本格式可编辑，二进制格式仅上传索引。

---

## 六、Phase 3：Wave D — JD 对齐增强

> **详细需求（逐步开发用）：** [`phase3-wave-d-requirements.md`](phase3-wave-d-requirements.md)  
> **开发方式：** Agent 模式说「**开始 Wave D1**」…「**开始 Wave D6**」；每 Wave 验收 → dev-log → 更新 §9 状态。  
> **方案定稿日：** 2026-09-09（业务代码尚未改动）

依据 [`JD.md`](JD.md)；对齐腾讯 **AI 应用工程师**、字节 **飞书 Agent 全栈**。

### 6.0 已定选型

| 项 | 决定 |
|----|------|
| 检索框架 | **LangChain 仅检索链**（BM25 + Chroma + RRF + 阈值） |
| 生成/Prompt | **继续手写**（citation、SSE、history 截断） |
| Tool Use | **规则 Router**：`search_knowledge` → 弱/无命中 → **Tavily `web_search`** |
| 联网 API | **Tavily**（`TAVILY_API_KEY`） |
| MCP / LangGraph | **不在 Wave D 主线**；MCP 留 C3 后续；LangGraph 仅实验分支 |

### 6.1 Wave D 一览

| Wave | 主题 | 预估 | 核心产出 | 状态 |
|------|------|------|----------|------|
| **D1** | LangChain 混合检索 + 调优 v1 | 2～3d | BM25+向量+RRF、threshold | ✅ |
| **D1.5** | RAG 质量 + 9 步闭环 | 4～5d | 改写/rerank/chunk/trace/G-Resume | ✅ |
| **D1.8** | Admin 信号 + embed filename | 1d | 撤销 penalize/boost、全库 reindex、embed 含 filename | ✅ 待手测 |
| **D2** | Tool Router + Tavily | 2d | 知识库优先、联网兜底 | ⬜ |
| **D3** | AI 反馈闭环 | 1～2d | `ai_feedback` 表、RAG/Chat 👍👎、Admin stats | ✅ |
| **D4** | 上下文管理 | 1d | Chat 清空上下文、生图清空附件、无隐式 reference | ⬜ |
| **D6** | 评测与面试材料 | 0.5～1d | rag-eval Golden Set、interview STAR、portfolio/resume 更新 | 进行中（resume ✅，Golden 待填） |
| **D5** | Redis（可选） | 1d | 限流或 embedding 缓存 | ⬜ |

**建议顺序：** D1 → **D1.5** → D3 → D2 → D4 → D6 → D5（可选）；**1-F HTTPS** 可并行。

### 6.2 简历叙事（Wave D 完成后）

> 知识问答：LangChain 混合检索 + 相似度阈值；本地无命中 Tool 路由 Tavily；RAG/Chat 用户反馈闭环；Chat/生图上下文可控。

### 6.3 可选 / 后续（Wave D 之后）

| 项 | 说明 |
|----|------|
| **C3 MCP 最小 Server** | 字节 JD；暴露「查知识库」工具 |
| C2 LangGraph 实验分支 | 独立分支，不合并主线 |
| GitHub Actions CD | 见 §4.4 **3d**（✅ 已验收） |
| **1-F HTTPS** | Wave A 遗留，备案后做 |

### 6.4 明确不做

- Nacos / Spring Cloud Gateway / Spring AI / Kafka 全链路
- LangChain **整体替换** RAG/SSE
- 完整多 Agent 平台、RAG 自动化 CI benchmark、OCR

---

## 七、岗位投递节奏

| 完成阶段 | 适合投递 | 叙事重点 |
|----------|----------|----------|
| **Wave B 结束** | 技术面试练手、内推预热 | 全栈 Demo + SSE + **PDF/DOCX RAG** + **CD/HTTPS** + 前端工程亮点 |
| **Wave C 结束** | 腾讯 **AI 应用工程师**；字节 **AIGC 全栈 / AI 前端** | 上述 + **portfolio/README** + STAR 可背 |
| **Wave D 结束** | 腾讯 AI 应用 **加强版**；字节 **飞书 Agent 全栈** | LangChain 检索 + Tool/Tavily + 反馈闭环 |
| Wave D + C3 MCP 后 | 字节 Agent 专向 | + MCP Server |
| Agent 专岗 | stretch | 需 LangGraph 深度 + Agent 专向作品 |

**主简历叙事（Wave C 定稿时写入 README）**

> AI 创意工作台：React + Spring Boot + FastAPI；RAG 知识问答（**含 PDF/DOCX**）、SSE 对话、美术机台与运营文案 AIGC 流水线；Docker + GitHub Actions **CI/CD**；[**HTTPS Demo 链接**]

**副叙事（Wave D 后追加）**

> LangChain 混合检索；Tool 路由 + Tavily 联网；AI 反馈与 RAG Golden Set 评测。

---

---

## 八、迭代波次与 Dev-log 门禁

> **2026-09 起执行顺序：** 先 **Wave A/B**（硬核亮点），再 **Wave C**（作品化投递包）。

### 8.1 三波次一览

| 波次 | 序号 | 内容 | 预估 | dev-log |
|------|------|------|------|---------|
| **Wave A** | 3d | CD1～CD4 GitHub Actions → ECS | 0.5～1 天 | `docs/dev-log/2026-09-github-actions-cd.md` |
| **Wave A** | 1-F | 域名 + HTTPS（Let's Encrypt） | 0.5～1 天 | `docs/dev-log/2026-09-demo-https.md` |
| **Wave A** | D3 | 静态 404 不返回 JSON（可选） | ~2h | 可合并进 CD dev-log |
| **Wave B** | 5～7 | Phase 2 PDF/DOCX RAG 全链路 | 2～3 天 | `docs/dev-log/2026-09-rag-pdf-docx.md` |
| **Wave C** | 2 | README + portfolio + architecture | ~1 天 | 内容进 portfolio；STAR 进 interview |
| **Wave C** | 4 | interview.md + rag-eval 完善 | ~1 天 | 从 dev-log 提炼 |
| **Wave D** | D1 | LangChain 混合检索 | 2～3 天 | `dev-log/2026-09-rag-hybrid-retrieval.md` |
| **Wave D** | D1.5 | RAG 质量闭环 | 4～5 天 | `dev-log/2026-09-rag-quality-d1_5.md` |
| **Wave D** | D2 | Tool Router + Tavily | 2 天 | 合并或 `dev-log/2026-09-rag-tool-router.md` |
| **Wave D** | D3 | AI 反馈闭环 | 1～2 天 | `dev-log/2026-09-rag-tool-feedback.md` |
| **Wave D** | D4 | 上下文管理 | 1 天 | 可合并进 D3 dev-log |
| **Wave D** | D6 | Golden Set + interview | 0.5～1 天 | 更新 rag-eval / interview |
| **Wave D** | D5 | Redis（可选） | 1 天 | architecture 小节 |

**门禁：** 验收通过 → 写 dev-log（六块：背景、选型、实现、踩坑、验收、STAR）→ 更新 §8.2 / §9 状态 → 下一项。Wave D 细则见 [`phase3-wave-d-requirements.md`](phase3-wave-d-requirements.md)。

### 8.2 已完成 Dev-log 索引

| 主题 | 文件 | 状态 |
|------|------|------|
| Chat 流式 + 虚拟列表 | [`dev-log/2026-09-chat-streaming-virtual-list.md`](dev-log/2026-09-chat-streaming-virtual-list.md) | ✅ |
| Lazy load + 错误体验 | [`dev-log/2026-09-lazy-load-api-error.md`](dev-log/2026-09-lazy-load-api-error.md) | ✅ |
| Campaign 配图 / 多模态 Chat | [`dev-log/2026-03-campaign-image-picker-ai-composer.md`](dev-log/2026-03-campaign-image-picker-ai-composer.md) | ✅ |

---

## 九、执行顺序（一张表）

| 序号 | 任务 | 波次 | 依赖 | 状态 |
|------|------|------|------|------|
| 1 | 公网 Demo（HTTP） | — | Docker 已有 | ✅ |
| 3a | O1～O2 素材列表 API 去 N+1 | P1.5 | #1 稳定 | ✅ |
| 3b | O3～O6 素材页前端懒加载 / 分页 / 批量删除 | P1.5 | 3a | ✅ |
| 3c | D1～D3 部署加固 | P1.5 | #1 | ✅（D3 可选 ⬜） |
| 3 | Chat 虚拟列表 + lazy + 错误体验 | P1 | — | ✅ |
| **3d** | **CD1～CD4 GitHub Actions 部署 ECS** | **Wave A** | 3c、Demo 稳定 | **✅ 已验收（公网可登录）** |
| **1-F** | **域名 + HTTPS** | **Wave A** | 3d、有域名 | **⬜** |
| D3 | 静态 404 不 JSON（可选） | Wave A | 3c | ⬜ |
| **5** | PDF/DOCX 解析（Python） | **Wave B** | Wave A 核心 | **✅** |
| **6** | Java + 前端格式对齐 | **Wave B** | #5 | **✅** |
| **7** | 联调 + Docker rebuild + deploy 更新 | **Wave B** | #6 | **✅（ECS 公网已验收）** |
| **2** | README + portfolio + architecture | **Wave C** | Wave B | **✅** |
| **4** | interview.md + rag-eval | **Wave C** | #2 | **✅** |
| **D1** | LangChain 混合检索 + 调优 v1 | **Wave D** | Wave C | ✅ |
| **D1.5** | RAG 质量 + 闭环 | **Wave D** | D1 | ✅ 待手测 |
| **D2** | Tool Router + Tavily 联网 | **Wave D** | D1.5 | ⬜ |
| **D3** | AI 反馈闭环 | **Wave D** | D2（可部分并行） | ✅ |
| **D4** | Chat/生图/RAG 上下文管理 | **Wave D** | D3 或并行 | ⬜ |
| **D6** | Golden Set + interview 更新 | **Wave D** | D1～D4 | ⬜ |
| **D5** | Redis 限流/缓存（可选） | **Wave D** | 按需 | ⬜ |
| 8～10 | （旧 P3 序号，已并入 D1～D5） | — | — | — |

**建议实施顺序：** **3d ✅ → 5～7 ✅ → 2/4 ✅ → D1 → D2 → D3 → D4 → D6 → D5（可选）**；**1-F HTTPS** 与 Wave D 并行。

**说明：** Wave B/C 已验收。**Wave D 方案已写入 [`phase3-wave-d-requirements.md`](phase3-wave-d-requirements.md)，代码未动。** 开发时说「**开始 Wave D1**」。

---

## 十、架构与 JD 关键词对照（备忘）

| JD 常写 | 本项目 | 计划后 |
|---------|--------|--------|
| RAG | 手写 embed + Chroma + prompt | Wave B ✅；**Wave D1：LangChain 混合检索** |
| SSE / 流式 | Chat 已有 | 保持 |
| 全栈交付 | 三端 + Docker + Demo | Wave A：CD ✅；HTTPS ⬜ |
| 前端工程 | 虚拟列表、lazy、apiError | ✅ dev-log 已记录 |
| Agent / Tool Use | 弱 | **Wave D2：Router + Tavily** |
| LangChain | 无 | **Wave D1：仅检索链** |
| MCP / Skills | 无 | Wave D 后 C3（可选） |
| LangGraph | 无 | C2 实验分支（可选） |
| 效果闭环 | 仅 ai_call_log | **Wave D3：ai_feedback** |
| Redis / MQ | 无 | **Wave D5 可选** |
| CI/CD | CI + CD | CD ✅ |

---

## 十一、风险与范围控制

1. **PDF 扫描件**：无 OCR 会提取失败 — UI 必须提示。  
2. **大 PDF**：需上限，避免 embed 超时。  
3. **Phase 1.5 核心（3a～3b）未完成前慎加新重接口** — 2G Demo 机易再现 OOM / 502。  
4. **Wave C 完成前**：可技术面试练手；**正式投递**建议等 README/portfolio 齐（Wave C）。  
5. **数据库备份 `workbench_backup.sql`** — 勿提交 Git；`*.tar`、`*.part_*` 等部署产物勿提交。  
6. **手动 scp 镜像** — Wave A（3d）完成前的临时方案；见 §4.4。  
7. **Dev-log** — 每里程碑必写，见 §8.1；skill：[`.cursor/skills/dev-log-retrospective/SKILL.md`](../.cursor/skills/dev-log-retrospective/SKILL.md)。  
8. **实施方式** — 每项开始前决定：分步学习 vs Agent 批量实现。

---

## 十二、相关文档索引

| 文档 | 用途 |
|------|------|
| [`deploy.md`](deploy.md) | Docker 部署与故障排查；生产 2G ECS 细节见本文 §4.1 |
| 本文 §4.0～§4.4、§8 | Demo 复盘、**Wave A/B/C 排期**、dev-log 门禁 |
| [`docs/dev-log/`](dev-log/) | 面试向开发复盘（每里程碑一篇） |
| [`.cursor/skills/dev-log-retrospective/SKILL.md`](../.cursor/skills/dev-log-retrospective/SKILL.md) | dev-log 写作规范 |
| [`JD.md`](JD.md) | 目标岗位 JD 汇总 |
| [`phase3-wave-d-requirements.md`](phase3-wave-d-requirements.md) | **Wave D 逐步开发需求**（说「开始 Wave D1」用） |
| [`ai-pricing-sources.md`](ai-pricing-sources.md) | AI 用量计费出处 |
| [`java-python-architecture.md`](java-python-architecture.md) | Java + Python 分工草稿 |
| [`study-plan.md`](study-plan.md) | 原始周计划（Week 13～14） |

---

*下一步：Agent 模式 **「开始 Wave D1」**（LangChain 混合检索）；或并行 **「开始 1-F」**（HTTPS）。Wave D 细则见 [`phase3-wave-d-requirements.md`](phase3-wave-d-requirements.md)。*
