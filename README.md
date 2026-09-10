# AI Creative Workbench

**AI 创意素材与知识工作台** — 把团队素材、内部文档和 AI 能力放在同一套产品里。

**在线体验：** http://8.148.238.164:8088（支持注册登录）

---

## 这个产品能帮你做什么

### 企业知识库 — 问文档，答有据

上传规范、策划案、FAQ、简历说明等文档，用自然语言提问，AI 基于**已索引内容**回答，并标注引用来源，减少「凭空编造」。

- 支持 **md / txt / pdf / docx** 上传与自动入库
- 流式问答，回答带 **[1][2]** 引用角标，可查看原文片段与文件名
- Markdown 文档可在线编辑，保存后自动更新索引
- PDF / DOCX 支持提取文本预览（扫描版暂不支持 OCR）
- 对回答点赞 / 点踩，帮助持续改进检索质量

### 内容运营 — 从活动主题到成稿预览

面向社区发帖、活动宣传等场景，用**结构化工作流**（不是开放式聊天）完成一条活动帖：

```
活动信息 → 配图 → AI 文案 → 预览成稿
```

- 填写主题、时间、受众、福利、视觉风格
- 从素材库选图（最多 9 张），支持九宫格预览
- AI 生成标题与正文，可换 Prompt 模板、流式输出、手动修改
- 预览最终发帖效果并保存草稿
- 配套 **抠图工作台**：从原图提取透明底元素，保存到素材库供活动帖选用

---

## 功能导览

### 登录与账户

![登录页](docs/screenshots/01-login.png)

- 用户名 / 密码登录，新用户可注册，支持找回密码

---

### 素材库

管理图片等创意素材，统一检索与复用。

![素材库 Grid](docs/screenshots/02-assets-grid.png)

- Grid / List 切换，关键词搜索，按标签筛选
- 查看统计条，编辑文件名与标签，批量删除

![上传素材](docs/screenshots/02-assets-upload.png)

- 拖拽或选择文件上传，命名并绑定标签

---

### 标签管理

![标签管理](docs/screenshots/03-tags.png)

- 新建、编辑标签名称与颜色
- 查看关联素材数量，搜索与批量删除

---

### AI 对话

通用多轮对话，适合开放式提问与创意讨论。

![AI 对话](docs/screenshots/04-chat-streaming.png)

- 多会话：新建、切换、重命名
- 流式打字机输出，显示 Token 用量
- 可附带参考图进行多模态提问

---

### 知识库

#### 文档库

![文档库](docs/screenshots/05-knowledge-documents.png)

- 上传 md / txt / pdf / docx，自动建立索引
- 分页、搜索、排序，查看文档 chunk 数量
- 删除文档，进入编辑器或预览页

#### 问答

![知识库问答](docs/screenshots/05-knowledge-rag.png)

- 针对已入库文档提问，流式回答
- 引用角标对应具体文档片段，可展开 references
- 管理问答会话历史，对单条回答反馈 👍 / 👎

#### 文档编辑与预览

| Markdown 编辑 | PDF / DOCX 预览 |
|:---:|:---:|
| ![Markdown 编辑器](docs/screenshots/05-knowledge-editor-md.png) | ![PDF/DOCX 预览](docs/screenshots/05-knowledge-editor-docx.png) |
| 双栏源码 + 预览，保存后重建索引 | 查看提取文本，二进制文件需重新上传更新 |

---

### 活动帖 Campaign

从活动描述到可发帖草稿的全链路。

![活动帖 — 草稿与活动信息](docs/screenshots/07-campaign-sidebar.png)

- 侧栏管理多个草稿，填写活动主题、时间、受众、福利、视觉风格

![活动帖 — 配图](docs/screenshots/07-campaign-tab-image.png)

- 从素材库选择配图，最多 9 张

![活动帖 — AI 文案](docs/screenshots/07-campaign-tab-copy-streaming.png)

- 选择 Prompt 模板，AI 流式生成标题与正文，生成后可编辑

![活动帖 — 九宫格预览](docs/screenshots/07-campaign-tab-preview-grid.png)

- 预览配图排列与文案排版，保存完整活动帖

---

### 抠图工作台 Matting

五步机台：源图 → 框选 → 元素 → 候选 → 保存。

| 源图 | 框选 |
|:---:|:---:|
| ![步骤1 源图](docs/screenshots/06-matting-step1-source.png) | ![步骤2 框选](docs/screenshots/06-matting-step2-crop.png) |
| 从素材库或本地上传 | 拖拽调整识别区域 |

| 元素 | 候选 |
|:---:|:---:|
| ![步骤3 元素](docs/screenshots/06-matting-step3-elements.png) | ![步骤4 候选](docs/screenshots/06-matting-step4-candidates.png) |
| 勾选、重命名、增删元素 | 为每个元素挑选最佳抠图结果 |

![步骤5 保存](docs/screenshots/06-matting-step5-save.png)

- 预览成品，命名打标签，保存到素材库供 Campaign 等活动帖使用

---

### 设置

![外观设置](docs/screenshots/08-settings-tab-appearance.png)

- **账户**：头像、资料、修改密码
- **外观**：浅色 / 深色 / 跟随系统
- **Prompt 模板**：自定义文案风格，供 Campaign 与 Chat 选用

---

### 管理后台（Admin）

需管理员角色，侧栏可见入口。

![用户管理](docs/screenshots/09-admin-users-list.png)

- 用户列表：搜索、新建、编辑、禁用
- 点击「查看」打开用户详情

![单用户 AI 用量](docs/screenshots/09-admin-user-usage.png)

- 查看近 30 天 Token 汇总与预估费用
- 按模型统计：调用次数、Token、费用区间
- 按场景统计：Chat、知识库、Campaign 等各功能用量
- AI 反馈统计、文档级信号管理、全库向量重建

---

更多截图与页面说明见 [docs/portfolio.md](docs/portfolio.md#产品截图导览)。

---

## 快速体验（约 3 分钟）

1. 打开 http://8.148.238.164:8088 ，注册或登录
2. **知识库路径**：文档库 → 上传一份 pdf/docx → 知识库问答 → 提问并查看引用来源
3. **运营路径**：活动帖 → 新建草稿 → 填活动信息 → 配图 → 生成文案 → 预览 Tab 查看成稿

---

## 本地运行与开发文档

本地一键启动（需 Docker）：

```bash
docker compose up -d
# 浏览器访问 http://localhost:8088
```

- 部署与环境变量：[docs/deploy.md](docs/deploy.md)
- 架构说明：[docs/architecture.md](docs/architecture.md)

技术栈：React · TypeScript · Spring Boot · FastAPI · MySQL · Chroma
