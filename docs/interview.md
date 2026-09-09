# 面试 STAR 故事集

> Wave C · 8 个可背诵故事，每个 30～60 秒。详细复盘见 [`dev-log/`](dev-log/)。

---

## 1. Chat SSE 流式 + 虚拟列表双模式

**S** 长对话 + 流式回复时，消息气泡重叠、无法上滑阅读、流式结束后历史布局崩溃。  
**T** 既要流式 UX，又要千条级虚拟列表性能。  
**A** 流式阶段 `disableVirtualization`，flex 列 + `ResizeObserver` 缓存行高；结束后恢复 TanStack Virtual；保存消息 merge 保留 React key；`stickToBottomRef` 仅在贴底时自动滚。  
**R** 流式稳定无 overlap，长会话滚动流畅，无需 F5 修复布局。

📄 [`dev-log/2026-09-chat-streaming-virtual-list.md`](dev-log/2026-09-chat-streaming-virtual-list.md)

**追问准备**

- 为什么流式不用 virtual？→ 行高剧变时 absolute + translateY 必然重叠。  
- 行高从哪来？→ flex 阶段 ResizeObserver 写 cache，virtual 阶段 estimateSize 读 cache。

---

## 2. 路由 Lazy Load + 统一 API 错误

**S** 首屏打进 Chat/Knowledge 等大页 bundle；错误提示英文 `Network Error`、双 toast。  
**T** 减小首屏、统一中文错误体验。  
**A** `lazyPages.ts` 独立 lazy 声明；MainLayout `Suspense` 包 Outlet；`parseApiError` 纯函数 + `finalizeApiRequestError` 401/502 只 toast 一次；页面 `showApiError` 防重复。  
**R** 首屏 JS 减小；断网/502/401 行为一致。

📄 [`dev-log/2026-09-lazy-load-api-error.md`](dev-log/2026-09-lazy-load-api-error.md)

---

## 3. 手写 RAG 流水线

**S** 知识库问答需要「有依据、可引用」，不能只调 Chat。  
**T** 实现入库 + 检索 + 生成，且能讲清每一步。  
**A** Python：`parse → split(400,50) → embed → Chroma`；问答 `embed(question) → top_k → prompt 约束仅依据资料 → stream LLM`；references 带 source/index。Java BFF 转发，前端展示角标。  
**R** md/txt 文档问答准确，references 可点击溯源；未引入 LangChain 降低黑盒度。

📄 [`rag-eval.md`](rag-eval.md)

**追问准备**

- chunk 为什么 400？→ 中文场景下单 chunk 信息量与 embed 窗口的平衡；overlap 50 防断句。  
- 空库怎么办？→ 返回无 references，prompt 侧可扩展联网工具（Phase 3）。

---

## 4. PDF/DOCX RAG 扩展（Wave B）

**S** 仅 md/txt，无法索引 PDF 规范与 Word 简历。  
**T** 插件化扩展格式，下游 chunk/embed 不变。  
**A** 新建 `binary_document_extractor`；pypdf + docx2txt；Java getContent 调 Python parse 预览；前端只读；无 OCR 明确 400。  
**R** 公网 Demo 可上传 pdf/docx，RAG references 含文件名；文本框 DOCX 经 docx2txt 补丁可提取。

📄 [`dev-log/2026-09-rag-pdf-docx.md`](dev-log/2026-09-rag-pdf-docx.md)

---

## 5. GitHub Actions CD + GHCR → ECS

**S** 公网更新靠 scp 大 tar，易断、不可复现。  
**T** push 后一键部署，密钥不进 Git。  
**A** workflow_dispatch 构建三镜像推 GHCR；SSH `git pull` + `compose pull/up`；`.env.secrets` / AI Key 服务器侧注入；镜像 tag = commit SHA 可回滚。  
**R** 公网 Demo 可重复部署；排障 login 502 定位为 YAML `password: *` 导致 backend Exited。

📄 [`dev-log/2026-09-github-actions-cd.md`](dev-log/2026-09-github-actions-cd.md)

---

## 6. Campaign 多模态 + 组件复用

**S** Campaign 与抠图选图 UI 不一致；Chat 不支持参考图；多草稿无法并行。  
**T** 统一体验并接通多模态 SSE。  
**A** 抽 `OpsImageSourcePicker`；Campaign draft API + 侧栏；`AiImageComposer` 三通道附图；Chat `[[images:url]]` 前缀编码；Java → Python OpenAI 多模态格式。  
**R** 三页选图 UI 一致；Chat 可带参考图流式回复。

📄 [`dev-log/2026-03-campaign-image-picker-ai-composer.md`](dev-log/2026-03-campaign-image-picker-ai-composer.md)

---

## 7. 2G ECS 素材页性能（N+1 + 懒加载）

**S** 公网 2G 轻量机，素材 Grid 一次 40 条 + N+1 查标签 + 40 张缩略图 → SSH 卡死、502。  
**T** Demo 稳定可刷新。  
**A** 后端批量查标签去 N+1；前端分页/懒加载；nginx `/assets` 路由与 Vite 打包目录冲突修复；Swap + JVM 内存限制；**禁止 ECS 上 build frontend**。  
**R** 素材页刷新稳定；Grid 模式 API 单次请求标签齐全。

📄 [`project-roadmap.md`](project-roadmap.md) §4 Phase 1.5

**追问准备**

- 怎么定位 N+1？→ 日志/SQL 条数 vs 素材条数线性增长；改为 IN 批量查询。

---

## 8. AI 调用日志与用量（ai_call_log）

**S** 需要知道每次 Chat 用了多少 token、什么模型，便于成本与排障。  
**T** 流式场景也要记录 usage。  
**A** Python SSE 发 `usage` 事件；Java `PythonAiClient` 解析 prompt/completion tokens，流结束后写 `ai_call_log`；前端可选展示。  
**R** 每次对话有 token 记录；面试可讲「AI 功能也要可观测」。

📄 [`week12-ops-architecture.md`](week12-ops-architecture.md) §4.2

---

## 使用建议

1. **投递前**：挑 3 个故事练熟——RAG（#3+#4）、Chat 流式（#1）、CD（#5）。  
2. **全栈岗**：加 #7 性能、#6 多模态。  
3. **AI 应用岗**：强调 #3/#4/#8，边界（无 OCR）主动说。  
4. 每个故事准备 **1 个失败尝试**（dev-log 里「放弃的方案」）。

---

## 简历 Bullet 参考

> 完整 bullet 库、STAR 30s/60s、JD 映射 → [`.cursor/skills/resume-project-expert/`](../.cursor/skills/resume-project-expert/SKILL.md)  
> 完成状态以 [`project-roadmap.md`](project-roadmap.md) §9 为准。

### Wave C 版（4 条 · 当前投递默认 · 已验收）

- 独立设计并实现 React + Spring Boot + FastAPI 三端架构，Docker Compose **4 服务** + GitHub Actions **CI/CD**（GHCR → 阿里云 ECS），镜像 **commit SHA** 版本化，公网 Demo 可重复部署。  
- 实现 RAG「解析 → chunk → embed → Chroma → 流式问答 + references」流水线，插件化扩展 **PDF/DOCX**（**4** 种格式，DOCX ~**7000** 字可问答），references 可溯源。  
- Chat SSE 流式 + 虚拟列表双模式（**1000+** 条流畅），**7** 页路由 lazy load + 统一 **401/502/断网** 中文错误体验。  
- 2G ECS 素材页定位标签 **N+1**（~**80+** SQL/页）→ 批量 **2** 次查询 + 懒加载，修复 nginx `/assets` 冲突，保障 Demo 刷新稳定。

### Wave D 加强版（D1.5 验收全绿后追加 · 已交付待验收）

- LangChain **检索链**（BM25 + 向量 + RRF），**30** 候选 → BGE rerank → **top 6** 进 Prompt；Query 改写、结构化 chunk、**RAG_TRACE** 与 Golden Set 闭环。（**非** LangChain 全家桶；生成/Prompt/SSE 仍手写）

### 技术规划（D2–D6 · 规划中 · 正式简历默认不写）

- Tool 规则路由 + Tavily 联网兜底；RAG/Chat 用户反馈；Chat/生图上下文清理。详见 [`phase3-wave-d-requirements.md`](phase3-wave-d-requirements.md)。
