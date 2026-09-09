# 简历 · AI Creative Workbench 项目经历

> 投递用完整段落，格式对齐 Clip Plugin 示例。  
> **Demo：** http://8.148.238.164:8088 · STAR 深挖见 [`interview.md`](interview.md)

---

## 简历正文（可直接复制）

**AI 创意素材与知识工作台（AI Creative Workbench）** | 独立全栈开发 | 2026.03-2026.09 &nbsp;&nbsp;**个人项目**

**技术栈：** React 19 + TypeScript + Vite + Ant Design + TanStack Virtual + Spring Boot 3 + MyBatis-Plus + FastAPI + Chroma + MySQL + Docker Compose + GitHub Actions + Nginx

**项目地址：** http://8.148.238.164:8088

**项目描述：** 面向游戏 / 内容团队的 **AI 创意素材 + 知识工作台**，解决素材分散难检索、规范文档（PDF/DOCX）无法直接 AI 问答两类痛点。集成素材库管理、知识库 RAG 流式问答、SSE 多模态 Chat、Campaign 活动帖与抠图工作流、Admin 用量与反馈运营五大核心能力，以 **可部署、可演示** 的全栈架构落地（非纯前端 Demo）。

**项目职责：** 独立负责产品架构设计、前后端与 AI 服务开发、Docker 化与 CI/CD、公网 Demo 部署及性能加固，端到端交付可面试演示的完整产品。

**个人项目成果：**

**全栈架构与工程化交付：** 设计 Java BFF + Python AI 能力层分层（前端只调 Java，统一 JWT 鉴权与错误模型）；搭建 Docker **四服务**（MySQL + Java + Python + Nginx）Compose 编排；实现 GitHub Actions **3 job CI + workflow_dispatch CD**，镜像推送 GHCR 后 SSH 一键部署 **2G** 阿里云 ECS，镜像 tag 绑定 **commit SHA** 支持回滚，公网 Demo 可持续更新；

**RAG 混合检索与质量闭环：** 在不替换 SSE/生成/Prompt 前提下，用 LangChain 检索链 + BM25 实现 **4 路**混合召回（dense + BM25 + multi-query RRF + 标签定向），**30** 候选经本地 BGE rerank 截断至 **top 6**；落地 Query 改写、语义 chunk、AI 打标、主体锚定与文档级 penalize/boost 反馈信号；入库 embedding 含 **filename/heading/summary**，Chroma documents 仍存纯正文；支持 **md/txt/pdf/docx** 四格式，文本框 DOCX 简历提取约 **7000** 字可引用；

**前端 AI 交互与工程体验：** 实现 Chat / RAG **SSE 流式** + **1000+** 条消息虚拟列表双模式（流式阶段禁 virtual、结束后恢复，解决气泡重叠）；**8** 个大页 `React.lazy` 按需加载；统一 **401/502/断网/超时** 中文错误（`parseApiError` + 防双 toast）；长任务 API 超时分级（批量删除 **3min**、全库 reindex **10min**）；Knowledge/Chat 👍👎 反馈持久化，Admin 可查看点踩样本与撤销文档信号；

**2G 轻量机性能与部署加固：** 定位素材 Grid **40** 条/页标签查询 **N+1**（约 **80+** 次 SQL）→ 批量 **2** 次 IN 查询；配合懒加载与 Swap，修复 nginx `/assets` 与 Vite 打包目录冲突导致的刷新 **502**；排查 YAML 密码 `#` 解析、公网 URL 端口不一致等线上故障，保障 Demo 刷新稳定；

**AIGC 工作流与可观测：** 交付 **5** 步抠图机台 + Campaign **4 Tab** 活动帖工作流（配图/文案/预览）；Chat 多模态参考图经 Java 转 Python OpenAI 兼容格式；Python SSE `usage` 事件写入 `ai_call_log`，Admin 可按用户/模型/场景统计 Token 与预估费用，支撑 AI 功能成本可观测。

---

## 诚实档位说明（面试自用，勿写进简历）

| 成果 | 档位 |
|------|------|
| 公网 Demo、CD、N+1、Chat 虚拟列表、lazy、apiError | **已验收** |
| 混合检索、rerank、反馈闭环、Admin 信号、embed filename | **已交付**，Golden G-Resume / BC-004 建议部署后手测一句 |
| Tavily 联网、HTTPS、Redis、Golden 自动化 | **规划中**，简历不写 |

---

## 建议背诵 STAR（2 条，各 30～60 秒）

### 故事 A：RAG 混合检索 + 反馈闭环

**S：** 知识库仅向量 top3，简历「两实习只答一家」、PNG 问题混入无关文档。  
**T：** 在不重写 SSE 的前提下提升召回、排序与可持续优化能力。  
**A：** BM25+dense+RRF+标签召回，30→BGE rerank→6；语义 chunk+AI 打标；点踩分诊写 penalize_source，Admin 可撤销；embed 含 filename 提升 dense 文件名词命中。  
**R：** 可演示 9 步 RAG 归因链路 + Admin 运营页；bad case 可回流 Golden 调参。

### 故事 B：2G ECS 502 + GitHub Actions CD

**S：** 公网 Demo 刷新 502、SSH 卡死；更新靠 scp 大 tar 易断。  
**T：** Demo 稳定可演示 + 一键可复现部署。  
**A：** 批量标签查询去 N+1；nginx 路由修复；GHCR+compose pull/up；密钥分层不进 Git。  
**R：** Grid 页刷新稳定；push 后 workflow 可更新公网环境。

---

## 岗位微调建议

| 投递方向 |  bullet 顺序建议 |
|----------|------------------|
| AI 应用 / RAG 岗 | RAG 闭环 → Chat SSE → 全栈 CD → 性能 |
| AI 前端 / AIGC 前端 | Chat 虚拟列表 → 工作流 UI → RAG 交互 → lazy/apiError |
| 通用全栈 | 全栈 CD → RAG → 性能 → 可观测 |
