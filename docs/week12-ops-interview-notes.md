# Week 12 Ops 面试复习笔记

> 对应实现：Campaign 活动帖 + Matting 抠图 + 双 Provider 图像链路（Seedream 优先 / 万相兜底）

---

## 1. 提示词工程

### 1.1 `prompt_template.scene` 分层

| scene | 用途 | 谁调用 |
|-------|------|--------|
| `copy_draft` | 活动文案初稿 | Campaign SSE `mode=draft` |
| `copy_style_*` | 文案风格优化 | Campaign SSE `mode=refine` |
| `image_gen` | 活动配图描述 | Campaign `generate-images` |
| `matting` | 抠图兜底（旧） | 兼容保留 |
| `matting_region` | 视觉元素名称识别 | Matting `crop/confirm` |
| `matting_extract` | 分组提取（去非目标） | Matting 异步 extract |
| `matting_single` | 单体元素提取 | Matting 异步 extract |

用户界面只展示模板 **name**，不暴露 `content` 原文（防 prompt 泄露、便于运营迭代 seed）。

### 1.2 `{{variable}}` 渲染链路

```
Java CampaignDraftService / MattingTaskService
  → PythonAiClient.renderPrompt(template, variables)
  → POST /ai/ops/render-prompt
  → prompt_renderer.render_prompt()
  → 最终字符串送入 LLM 或图像 API
```

**面试点**：为什么 Java 渲染而不是前端？—— 模板存 DB、变量来自服务端草稿，避免篡改与泄露。

### 1.3 Campaign 生图 prompt 注入字段

`image_gen` 模板变量：`theme`, `timeRange`, `audience`, `benefits`, `visualStyle`, `aspectRatio`, `forbiddenWords`。

左栏表单 → `activity_json` → 渲染一次 → 送入 Seedream/Wan。

### 1.4 Matting prompt 设计（对齐美术机台）

五步流：**源图 → 框选 → 元素识别 → 按元素提取 → 保存**。

| 阶段 | Prompt scene | 模型 |
|------|--------------|------|
| 元素清单 | `matting_region` | DashScope Qwen-VL（`DASHSCOPE_VISION_MODEL`） |
| 分组图 | `matting_extract` | Seedream → Wan 额度兜底 |
| 单体图 | `matting_single` | 同上 |

- 用户**不再手写**提取 Prompt；步骤③仅勾选/重命名元素
- `config_json` 存 `cropRegions` / `elements` / `elementImages` / `detectStatus` / `extractStatus`
- 提取异步 + 前端 5s 轮询 `GET .../extract/status`

### 1.5 文案 SSE 与 JSON 解析

- Seed 要求 LLM 输出 `{"title","body"}`
- 前端 `parseCampaignCopyFromLlm`：JSON.parse 失败时用正则提取，再降级整段为 body
- **面试点**：流式输出可能截断 JSON，所以要有降级路径；空 body 不 PUT `/copy`

---

## 2. 流程设计

### 2.1 Campaign 人机协同状态机

```
EditingForm → GeneratingCopy / GeneratingImages → PickingImages → DraftReady → Exported
```

- 文案与生图可并行（不同 Tab）
- `status`: `draft` → 选封面后 `ready`
- 外部 URL 24h 过期 → **TagAssetDialog / Matting save** 必须 `importFromUrl` 入库

### 2.2 Matting 四步与 `generation_job`

| stage | UI | 持久化 |
|-------|-----|--------|
| 1 | 选源图 | `source_asset_id` |
| 2 | Prompt/模板 | `config_json` |
| 3 | 候选画廊 | `generation_job`（`ref_task_id`） |
| 4 | 保存 | `importFromUrl` + tag `matted` |

### 2.3 Java 编排 + Python 调 API

- **Java**：鉴权、草稿/任务状态、`generation_job`、`ai_call_log`、Assets 入库
- **Python**：持有 `SEEDREAM_*` / `DASHSCOPE_*`，Provider 适配与 fallback
- **面试点**：Key 隔离、Provider 可替换、Java 不直连火山/阿里

### 2.4 SSE vs 同步 HTTP

| 能力 | 协议 | 原因 |
|------|------|------|
| 文案 | SSE | 长文本、用户体验 |
| 生图 4 张 | 同步 POST | 整包候选、超时可控（120~180s） |

---

## 3. 工程设计

### 3.1 `ImageProvider` + 窄 fallback

```
Seedream.generate() → ProviderQuotaError（仅 429/额度语义）
  → image_router 切换 DashScopeWanxAdapter
其他 ValueError → 直接失败，不浪费备用额度
```

实现集中在 `quota_errors.is_quota_error()`，**单一职责**。

### 3.2 `generation_job` + `ai_call_log`

- **job**：业务侧「一次 generate」、候选 URL、provider_used
- **log**：审计 scene/prompt/cost_ms/status，成功失败都记

### 3.3 前端组件复用

- `ImageSourcePanel`：Matting ① / Campaign 配图参考图
- `CandidateGallery`：Matting ③ / Campaign 配图 Tab
- `TagAssetDialog`：library-ai 入库（`generated` 标签）

### 3.4 Fail-fast 原则

- Provider 错误带 HTTP status + body 摘要返回前端
- 不在多层 catch 吞掉异常；router 层只做 **一种** fallback 条件

### 3.5 常见面试追问

1. **为什么 Seedream 循环 4 次请求？** — 单次 API 常返回 1 张，产品要 4 候选。
2. **sourceUrl 为何要 buildFullUrl？** — 存库是相对路径 `/uploads/xx`，外部 API 要公网 URL。
3. **export zip 读本地盘而非再下 URL？** — 封面已入库，MinIO/本地文件持久化，不依赖 24h 临时链。
4. **如何扩展第三家 Provider？** — 实现 `ImageProvider`，在 `image_router` 增加 fallback 链，Java 无感。

---

## 4. 配置清单

```env
# Python ai-service-python/.env
SEEDREAM_API_KEY=ark-...
SEEDREAM_API_BASE=https://ark.cn-beijing.volces.com/api/v3
SEEDREAM_IMAGE_MODEL=doubao-seedream-5-0-pro-260628

DASHSCOPE_API_KEY=sk-...
DASHSCOPE_API_BASE=https://dashscope.aliyuncs.com/api/v1
DASHSCOPE_IMAGE_MODEL=wan2.7-image-pro
```

DDL：执行 [`docs/sql/ops_tables.sql`](sql/ops_tables.sql)。

Health：`GET http://localhost:8000/ai/ops/health`
