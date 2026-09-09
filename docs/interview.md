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

## 3. 混合 RAG 流水线（Wave D1 + D1.5）

**S** 知识库问答需要「有依据、可引用」；纯向量 top3 漏专有名词、简历列举不全。  
**T** 实现可诊断的入库 + 混合检索 + rerank + 生成，生成/Prompt/SSE 保持手写。  
**A** 入库：semantic chunk + AI 打标 + `build_embed_text`  enriched embed；问答：Query 改写 → hybrid 30 候选 → BGE rerank → top 6 → 流式 LLM；`RAG_TRACE` 分阶段归因。Java BFF 转发，前端 references 角标。  
**R** 4 格式文档可问答；30→6 检索链可演示；LangChain **仅检索链**，生成侧无黑盒。

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

## 9. Admin 文档信号 + Embedding 含 Filename（D1.8）

**S** 点踩 penalize 后 Admin 无法撤销；dense 检索对文件名关键词（如 PNG）弱。  
**T** 运营可管的文档级信号 + 升级 embedding 输入，references 不被污染。  
**A** `rag_source_signal` + Admin 撤销 API；`build_embed_text` 与 rerank 格式对齐，documents 存纯 content；全库 reindex + 超时分级（10min）。  
**R** 反馈闭环可演示写入/撤销；reindex 后 filename 进入 dense（待 Golden 手测一句）。

📄 [`dev-log/2026-09-rag-admin-embed-signals.md`](dev-log/2026-09-rag-admin-embed-signals.md)

---

## 使用建议

1. **投递前**：挑 3 个故事练熟——RAG（#3+#4+#9）、Chat 流式（#1）、CD（#5）。  
2. **全栈岗**：加 #7 性能、#6 多模态。  
3. **AI 应用岗**：强调 #3/#4/#8/#9，边界（无 OCR）主动说。  
4. 每个故事准备 **1 个失败尝试**（dev-log 里「放弃的方案」）。

---

## 简历 Bullet 参考

> **可直接复制的完整项目段落：** [`resume-project.md`](resume-project.md)  
> bullet 库、JD 映射 → [`.cursor/skills/resume-project-expert/`](../.cursor/skills/resume-project-expert/SKILL.md)  
> 完成状态以 [`project-roadmap.md`](project-roadmap.md) §9 为准。

### 当前投递版（推荐 · 完整段落）

见 **[`resume-project.md`](resume-project.md)** — 含 5 条「个人项目成果」+ 2 条 STAR + 诚实档位说明。

### 精简 4 bullet 版（空间不够时用 · 已验收）

- 独立设计并实现 React + Spring Boot + FastAPI 三端，Docker **4 服务** + GitHub Actions **CI/CD** 部署 **2G** ECS，公网 Demo 可重复更新。  
- 混合 RAG：**30** 候选 → BGE rerank → **top 6**；**4** 格式文档 + 反馈闭环 + Admin 信号运营。（LangChain **仅检索链**）  
- Chat SSE + 虚拟列表双模式（**1000+** 条）；**8** 页 lazy load + 统一 **401/502/断网** 中文错误。  
- 素材页 **N+1**（~**80+** SQL/页）→ 批量 **2** 次查询，修复 nginx `/assets` **502**。

### 技术规划（D2–D6 · 规划中 · 正式简历默认不写）

- Tool 规则路由 + Tavily 联网兜底；RAG/Chat 用户反馈；Chat/生图上下文清理。详见 [`phase3-wave-d-requirements.md`](phase3-wave-d-requirements.md)。
