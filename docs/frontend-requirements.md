# 前端页面需求文档（Phase 1）

> **版本**：Phase 1 — 基于 Studio Neutral 设计原型  
> **读者**：全栈导师 AI（页面生成）、项目学习者（跟着实现）  
> **设计预览**：http://localhost:5173/style-preview.html  
> **视觉规范**：[`frontend-style-guide.md`](frontend-style-guide.md)  
> **设计 Token 源**：[`frontend/src/style-guide/tokens.css`](../frontend/src/style-guide/tokens.css)

---

## 1. 文档说明

### 1.1 用途

本文档是 **AI 创意资产与知识工作台** 前端页面级需求的唯一来源。全栈导师 AI 在生成/改造业务页面时，必须：

1. 先阅读本文档对应章节；
2. 打开 style-preview 对照视觉；
3. 遵循 [`frontend-style-guide.md`](frontend-style-guide.md) 的代码规范；
4. 从 `style-guide/` 原型**复制样式与结构到业务组件**，禁止业务页直接 `import Preview*` 组件。

学习者按本文档 + 设计稿逐步实现，每完成一页勾选第 7 章验收清单。

### 1.2 Phase 1 范围

| 包含 | 不包含（Phase 2） |
|------|------------------|
| 设计系统迁移（tokens / theme） | Tags 标签管理页 |
| App Shell（Sidebar + TopBar + MainLayout） | Settings 设置页 |
| 登录 / 注册页 | Asset Upload 上传页 UI 细节 |
| 素材列表页 Assets List | Chat / Knowledge 的 SSE / RAG 联调 |
| Chat / Knowledge **UI 规格**（文档描述，Week 9+ 实装） | Canvas 标注、虚拟列表 |
| Light 主题优先 | Dark 主题（增强项，可选） |

### 1.3 设计方向：Studio Neutral

对标 Notion / Figma / Google Workspace 的企业创意工具感，**刻意避免** Indigo/紫渐变等「AI 模板」视觉。

- **主操作色**：Ink 近黑（Light 模式主按钮）
- **强调色**：Teal `#0D9488`（链接、导航激活、AI 相关）
- **Signature 元素**：素材缩略图 **透明格 checkerboard**（设计软件通用 pattern）

### 1.4 文案规范

- **中文为主**，关键产品术语保留英文：`Assets`、`Upload`、`SSE`、`RAG`、`References`、`Chat`、`Knowledge`
- 示例：「素材 Assets」「上传 Upload」「引用片段 References」
- 按钮用动词：「登录」「注册」「上传」「删除」「停止生成」
- 错误提示说明原因，不道歉：「用户名不能为空」「登录失败，请检查账号密码」

### 1.5 技术栈与实现约束

```
React 19 + TypeScript + Vite + Zustand + React Router + Ant Design
```

| 约束 | 说明 |
|------|------|
| 样式 | CSS Modules + Design Tokens（`var(--xxx)`） |
| 禁止 | 布局/主题用 inline `style={{}}`（超 3 行） |
| Ant Design | 优先 props → theme token → 最小 :global 覆盖 |
| 状态 | 登录态 `stores/authStore.ts`；页面数据 `useState` + `useEffect` |
| API | `api/request.ts` 封装，类型放 `types/api.ts` |

---

## 2. 设计系统速查

> 完整 Token 定义见 [`tokens.css`](../frontend/src/style-guide/tokens.css)，Ant Design 主题见 [`antdTheme.ts`](../frontend/src/style-guide/antdTheme.ts)。

### 2.1 色板

| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| `--color-ink` | `#18181B` | `#FAFAFA` | 主按钮、主文字 |
| `--color-canvas` | `#F7F7F8` | `#09090B` | 页面背景 |
| `--color-surface` | `#FFFFFF` | `#18181B` | 卡片、侧栏、顶栏 |
| `--color-subtle` | `#F4F4F5` | `#27272A` | 次级背景、输入区 |
| `--color-border` | `#E4E4E7` | `#27272A` | 边框 |
| `--color-muted` | `#71717A` | `#A1A1AA` | 次要文字 |
| `--color-faint` | `#A1A1AA` | `#71717A` | 辅助文字、placeholder |
| `--color-accent` | `#0D9488` | `#2DD4BF` | 链接、选中、AI 强调 |
| `--color-accent-subtle` | `rgba(13,148,136,0.08)` | `rgba(45,212,191,0.1)` | 激活背景 |
| `--color-success` | `#059669` | — | 正向 delta |
| `--color-error` | `#DC2626` | — | 删除、危险操作 |

**Legacy 别名**（迁移期可用）：`--color-bg-page` = canvas，`--color-text-primary` = ink，`--color-text-secondary` = muted。

### 2.2 字体

| 角色 | 字体 | 用途 |
|------|------|------|
| UI | Plus Jakarta Sans | 标题、正文、按钮 |
| 数据 | IBM Plex Mono | 文件名、MIME、chunks、文件大小 |

```css
font-family: var(--font-sans);   /* UI */
font-family: var(--font-mono);   /* 文件名、类型 */
```

### 2.3 布局常量

| Token | 值 | 用途 |
|-------|-----|------|
| `--sidebar-width` | 240px | 侧栏宽度 |
| `--header-height` | 56px | 顶栏高度 |
| `--content-max-width` | 1200px | 内容区最大宽度 |
| `--space-4` | 16px | 常用间距 |
| `--space-6` | 24px | 内容区 padding |
| `--radius-control` | 8px | 按钮、输入框 |
| `--radius-panel` | 12px | 卡片、面板 |
| `--shadow-sm` | 轻阴影 | 卡片默认 |
| `--shadow-md` | 中阴影 | 卡片 hover |

### 2.4 主题切换（增强项）

原型通过 `document.documentElement.dataset.theme = 'light' | 'dark'` + `getWorkbenchTheme(mode)` 实现。  
**Phase 1 业务页可只做 Light**；Dark 作为后续增强，结构需预留 `[data-theme='dark']` 选择器。

### 2.5 响应式断点

| 断点 | 行为 |
|------|------|
| `< 768px` | 侧栏隐藏；TopBar 用户名隐藏，仅 Avatar |
| `< 1024px` | 内容区 padding 缩小为 `--space-4` |

---

## 3. 全局布局 App Shell

### 3.1 概述

**页面目标**：已登录用户的统一框架，包含侧栏导航、顶栏、内容插槽。

**原型文件**：
- [`PreviewSidebar.tsx`](../frontend/src/style-guide/components/PreviewSidebar.tsx)
- [`PreviewTopBar.tsx`](../frontend/src/style-guide/components/PreviewTopBar.tsx)

**业务目标文件**（需新建/重写）：
- [`layouts/MainLayout.tsx`](../frontend/src/layouts/MainLayout.tsx) + `MainLayout.module.css`
- `components/layout/AppSidebar.tsx` + `AppSidebar.module.css`
- `components/layout/AppTopBar.tsx` + `AppTopBar.module.css`

**当前状态**：`MainLayout.tsx` 仅为占位 `<h2>Workbench主布局</h2>`，需完全重写。

### 3.2 布局线框

```
┌──────────┬────────────────────────────────────────┐
│          │ TopBar（56px）                          │
│ Sidebar  │  面包屑          Docs | 用户 Avatar    │
│ (240px)  ├────────────────────────────────────────┤
│          │                                        │
│ Logo     │  <Outlet />  页面内容区                 │
│ Nav ×5   │  max-width: 1200px, padding: 24px      │
│          │                                        │
│ Footer   │                                        │
└──────────┴────────────────────────────────────────┘
```

### 3.3 Sidebar 规格

#### Logo 区

| 元素 | 规格 |
|------|------|
| Logo Mark | 32×32px，圆角 8px，背景 `--color-ink`，白色字母「W」 |
| 主标题 | 「Workbench」，14px，font-weight 600 |
| 副标题 | 「AI 创意资产工作台」，12px，`--color-text-tertiary` |
| 分隔 | Logo 区底部 1px `--color-border-subtle` |

Dark 模式下 Logo Mark 可改为 `--color-accent` 背景（见原型 CSS）。

#### 导航项

| key | 文案 | 图标（Ant Design Icons） | 路由 | Phase |
|-----|------|--------------------------|------|-------|
| assets | 素材 Assets | `AppstoreOutlined` | `/assets` | 1 — 实现 |
| tags | 标签 Tags | `TagsOutlined` | `#` 或 disabled | 2 |
| chat | AI 对话 Chat | `MessageOutlined` | `/chat` | 2 |
| knowledge | 知识库 Knowledge | `BookOutlined` | `/knowledge` | 2 |
| settings | 设置 Settings | `SettingOutlined` | `#` 或 disabled | 2 |

**NavItem 样式**：
- 默认：13px，font-weight 500，`--color-text-secondary`
- Hover：`--color-bg-hover` 背景
- Active：`--color-accent-subtle` 背景 + `--color-accent` 文字 + 左侧 2px Teal 竖条（高 18px）
- 内边距：`8px 12px`，圆角 8px

**Phase 1 行为**：Tags / Chat / Knowledge / Settings 可渲染但点击不跳转或显示「即将推出」；Assets 高亮并跳转 `/assets`。

**Footer**：底部提示文字可选隐藏；生产环境不需要「风格预览」文案。

#### 响应式

`@media (max-width: 768px)` → `.sidebar { display: none }`（Phase 2 可加 Drawer）。

### 3.4 TopBar 规格

| 区域 | 内容 |
|------|------|
| 左侧面包屑 | `Workbench / {当前页名称}`，当前页 font-weight 500 |
| 右侧 | 「文档 Docs」按钮（default, small）+ 用户信息块 |

**用户信息块**：
- 显示：`user.username`（或显示名）、角色文案（如 `Creator`，可取自 `user.role`）
- Avatar：32px，背景 Ink，显示用户名首字母
- Dropdown 菜单：个人资料、设置、---、退出登录（danger）
- 退出：调用 `authStore.clearAuth()` + 跳转 `/login`

**数据来源**：`useAuthStore`；MainLayout 已有 `getMeApi` 自动拉取逻辑，保留。

### 3.5 MainLayout 实现要点

```tsx
// 结构示意
<div className={styles.shell}>
  <AppSidebar activeKey="assets" />
  <div className={styles.mainColumn}>
    <AppTopBar breadcrumbCurrent="素材 Assets" />
    <main className={styles.content}>
      <Outlet />
    </main>
  </div>
</div>
```

- 保留现有 `useEffect` 中 `getMeApi` 逻辑
- `content` 背景 `--color-bg-page`，padding `--space-6`
- 子页面自行控制 `max-width: 1200px` 居中（或在 Layout 层统一包一层 `contentInner`）

### 3.6 App Shell 验收标准

- [ ] 侧栏视觉与 style-preview 一致（Logo、Nav 激活态、图标）
- [ ] 顶栏面包屑、用户 Avatar、Dropdown 正常
- [ ] `/assets` 路由下 Assets 导航高亮
- [ ] 768px 以下侧栏隐藏
- [ ] 退出登录清除 token 并跳转登录页
- [ ] 无 inline 布局样式

---

## 4. 页面模块规格

---

### 4.1 登录页 Login

| 属性 | 值 |
|------|-----|
| **路由** | `/login` |
| **守卫** | `GuestGuard`（已登录则 redirect） |
| **业务文件** | [`pages/LoginPage.tsx`](../frontend/src/pages/LoginPage.tsx) |
| **原型文件** | [`PreviewAuthCard.tsx`](../frontend/src/style-guide/components/PreviewAuthCard.tsx) |
| **建议抽取** | `components/auth/AuthCardLayout.tsx`（Login / Register 共用） |

#### 页面目标

用户输入账号密码登录，成功后进入工作台首页。

#### 布局线框

```
┌─────────────────────────────────────┐
│     全屏 canvas 背景                 │
│                                     │
│         ┌─────────────────┐         │
│         │  [W] Logo       │         │
│         │  登录工作台      │         │
│         │  Sign in to...  │         │
│         │                 │         │
│         │  用户名 [____]   │         │
│         │  密码   [____]   │         │
│         │  [  登录  ]      │         │
│         │  还没有账号？注册  │         │
│         └─────────────────┘         │
│         max-width: 400px            │
└─────────────────────────────────────┘
```

#### 组件清单

| 组件 | 来源 | 说明 |
|------|------|------|
| AuthCardLayout | 新建 | 居中容器 + 卡片壳 |
| Form | Ant Design | layout="vertical" |
| Input | Ant Design | 用户名 |
| Input.Password | Ant Design | 密码 |
| Button | Ant Design | type="primary" block loading |

#### 文案

| 元素 | 文案 |
|------|------|
| 标题 | 登录工作台 |
| 副标题 | Sign in to AI Creative Workbench |
| 用户名 label | 用户名 |
| 密码 label | 密码 |
| 主按钮 | 登录 |
| 底部链接 | 还没有账号？立即注册 → `/register` |

#### 交互与状态

| 状态 | 行为 |
|------|------|
| 初始 | 空表单 |
| 校验失败 | Form.Item rules 提示 |
| 提交中 | 按钮 loading，禁用重复提交 |
| 成功 | `message.success('登录成功')` → `setAuth(token, user)` → `navigate('/')` |
| 失败 | `message.error(错误信息)` |

**现有逻辑保留**（`LoginPage.tsx` 中 `onFinish` + `loginApi`），只改 UI。

#### API

```
POST /api/auth/login
Body: { username, password }
Response: { token, user }
```

前端：`loginApi()` in [`api/auth.ts`](../frontend/src/api/auth.ts)

#### 样式要点

- 页面背景：`--color-bg-subtle` 或 `--color-canvas`
- 卡片：surface 背景，1px border，`--radius-panel`，`--shadow-md`
- Logo：40×40px，Ink 背景，圆角 8px
- 主按钮：Light 下 `--color-ink` 背景（或通过 antd theme `colorPrimary: #18181B`）
- **删除**现有 inline `minHeight/display/flex/background` 样式

#### 验收标准

- [ ] 视觉与 PreviewAuthCard 一致
- [ ] Form 校验、登录、跳转正常
- [ ] 使用 CSS Modules + tokens，无超 3 行 inline style
- [ ] 注册链接可跳转 `/register`

---

### 4.2 注册页 Register

| 属性 | 值 |
|------|-----|
| **路由** | `/register` |
| **守卫** | `GuestGuard` |
| **业务文件** | [`pages/RegisterPage.tsx`](../frontend/src/pages/RegisterPage.tsx) |
| **原型** | 复用 Auth 卡片布局（PreviewAuthCard 对称扩展，无独立原型） |

#### 页面目标

新用户注册账号，成功后跳转登录页。

#### 与 Login 的差异

| 元素 | Register |
|------|----------|
| 标题 | 注册账号 |
| 副标题 | Create your AI Creative Workbench account |
| 额外字段 | 邮箱（可选） |
| 主按钮 | 注册 |
| 底部链接 | 已有账号？去登录 → `/login` |
| 成功行为 | `navigate('/login', { replace: true })` |

#### 表单字段

| 字段 | name | 规则 |
|------|------|------|
| 用户名 | username | required |
| 密码 | password | required |
| 邮箱 | email | 可选 |

#### API

```
POST /api/auth/register
Body: { username, password, email? }
```

前端：`registerApi()` in [`api/auth.ts`](../frontend/src/api/auth.ts)

#### 验收标准

- [ ] 与 Login 共用 AuthCardLayout，视觉一致
- [ ] 注册成功跳转登录页
- [ ] 错误提示正常

---

### 4.3 素材列表页 Assets List

| 属性 | 值 |
|------|-----|
| **路由** | `/assets` |
| **守卫** | `AuthGuard` + MainLayout |
| **业务文件** | [`pages/AssetListPage.tsx`](../frontend/src/pages/AssetListPage.tsx) + `AssetListPage.module.css` |
| **原型文件** | [`DesignPreviewPage.tsx`](../frontend/src/style-guide/DesignPreviewPage.tsx) 主内容区 |
| | [`PreviewStatsStrip.tsx`](../frontend/src/style-guide/components/PreviewStatsStrip.tsx) |
| | [`PreviewAssetGrid.tsx`](../frontend/src/style-guide/components/PreviewAssetGrid.tsx) |
| | Table 区块（DesignPreviewPage 内） |

#### 页面目标

展示用户上传的创意素材，支持 KPI 概览、搜索筛选、Grid/List 两种视图、查看与删除。

#### 布局线框（自上而下）

```
PageHeader
├── 左：标题「素材 Assets」+ 描述「管理创意文件、标签与上传」
└── 右：Button primary「上传 Upload」→ /assets/upload

StatsStrip（3 列 grid）
├── 素材总数 | 128 | 本周 +12
├── 本周上传 | 24  | 较上周 +18%
└── 知识库文档 | 36 | RAG 已索引

Toolbar
├── Input 搜索（width 260, allowClear, debounce 300ms）
├── Select 按标签筛选（allowClear）
├── Select 排序（最新 / 最早）
└── Button「新建标签」（Phase 2 实装，Phase 1 可 disabled）

Section: Grid 网格视图
└── AssetGrid（checkerboard 缩略图卡片）

Section: List 列表视图
├── Panel Header：标题 + ViewToggle（Grid | List）
└── Ant Design Table（分页）
```

#### 组件清单

| 组件 | 文件 | 原型参考 |
|------|------|----------|
| AssetStatsStrip | `components/assets/AssetStatsStrip.tsx` | PreviewStatsStrip |
| AssetGrid | `components/assets/AssetGrid.tsx` | PreviewAssetGrid |
| AssetTable | 可在 Page 内或拆分 | DesignPreviewPage Table |
| ViewToggle | Page 内 CSS Module | DesignPreviewPage `.viewToggle` |

#### StatsStrip KPI

| label | 示例 value | 示例 delta |
|-------|------------|------------|
| 素材总数 | 来自 API total | 本周 +N |
| 本周上传 | 聚合或 mock | 较上周 +N% |
| 知识库文档 | mock 或后续 API | RAG 已索引 |

Phase 1 允许 KPI 部分 mock，接口就绪后替换。

#### AssetGrid 卡片规格

| 元素 | 规格 |
|------|------|
| 网格 | `repeat(auto-fill, minmax(180px, 1fr))`，gap 16px |
| 缩略图 | aspect-ratio 4:3 |
| 无预览 | **透明格 checkerboard**（CSS 背景 pattern） |
| 有预览 | 图片 URL 或纯色 previewFill（仅运行时 dynamic color 允许 inline） |
| 类型 Badge | 左上角，mono 10px，MIME 子类型大写（PNG / SVG+XML） |
| Hover Overlay | 半透明黑底 + 「查看」「删除」按钮 |
| 卡片体 | 文件名 ellipsis + mono 类型 · 人类可读大小 |

**Mock 数据示例**（与原型一致）：
- hero-banner-v2.png, character-sprite.png, icon-set.svg, promo-cutscene.mp4, brand-guide.pdf, ui-kit.fig

#### Table 列定义

| 列 | dataIndex | width | 说明 |
|----|-----------|-------|------|
| 文件名 | name | auto | ellipsis |
| 类型 | type | 140 | mono 风格可选 |
| 大小 | size | 100 | 格式化为 KB/MB |
| 标签 | tags | auto | Ant Design Tag 列表 |
| 上传时间 | createdAt | 120 | YYYY-MM-DD |
| 操作 | — | 120 | Link「查看」「删除」danger |

#### Toolbar 交互

| 控件 | 行为 |
|------|------|
| 搜索 | debounce 300ms → 重置 page=1 → 请求列表 |
| 标签筛选 | Select 变更 → 带 tagId 请求 |
| 排序 | desc（最新）/ asc（最早） |
| ViewToggle | 切换 Grid / List 区域显隐（同页，非路由切换） |

#### 空状态

无素材时 Grid 区域显示：
- 文案：「还没有素材，上传第一个文件吧」
- CTA 按钮：「上传 Upload」→ `/assets/upload`

#### 数据与 API

```typescript
// types/api.ts — 已有
interface AssetVO {
  id: number
  name: string
  url: string
  path: string
  size: number      // bytes
  type: string      // MIME
  createdAt: string
}

interface PageResult<T> {
  records: T[]
  total: number
  page: number
  size: number
}
```

```
GET /api/assets?page=1&pageSize=10&keyword=&tagId=&sort=desc
Response: PageResult<AssetVO>

DELETE /api/assets/{id}
```

Phase 1 需新建 `api/assets.ts` 封装上述接口。标签字段若后端 AssetVO 暂未包含，Table 列可先空数组，Grid 不显示 tags。

#### 工具函数

```typescript
formatFileSize(bytes: number): string  // 840 KB / 1.2 MB
formatDate(iso: string): string         // 2026-08-10
```

#### 验收标准

- [ ] PageHeader、Stats、Toolbar、Grid、Table 结构与原型一致
- [ ] Grid 缩略图使用 checkerboard，非彩虹渐变
- [ ] 搜索、分页、删除（含确认 Modal）可用
- [ ] 上传按钮跳转 `/assets/upload`
- [ ] ViewToggle 切换 Grid/List 显示
- [ ] 空状态有引导
- [ ] 文件名/类型使用 mono 字体

---

### 4.4 AI 对话页 Chat

| 属性 | 值 |
|------|-----|
| **路由** | `/chat` |
| **原型文件** | [`PreviewChatEmpty.tsx`](../frontend/src/style-guide/components/PreviewChatEmpty.tsx)（初始空态） |
| | [`PreviewChatActive.tsx`](../frontend/src/style-guide/components/PreviewChatActive.tsx)（对话态） |
| | [`PreviewConversationSidebar.tsx`](../frontend/src/style-guide/components/PreviewConversationSidebar.tsx) |
| | [`PreviewMessageRow.tsx`](../frontend/src/style-guide/components/PreviewMessageRow.tsx) |
| **建议文件** | `pages/ChatPage.tsx`、`components/chat/ChatHistorySidebar.tsx`、`components/chat/ChatMessageRow.tsx` |
| **实施周次** | Week 9（SSE 流式输出 + 历史会话） |
| **参考** | ChatGPT 布局（空态/对话态均保留历史侧栏 + 问候/消息区） |

> 业务页 [`ChatPage.tsx`](../frontend/src/pages/ChatPage.tsx) 已有 SSE 基础实现；后续需按本原型补齐 **空态、历史侧栏、Avatar、主流气泡**。

#### 页面目标

用户与 AI 多轮对话，支持历史会话切换、SSE 流式输出、停止生成、复制与重新生成。

#### 4.4.1 初始空态（无消息）

**原型**：`PreviewChatEmpty`  
**触发条件**：`messages.length === 0`（当前为新对话）

```
┌─────────────┬───────────────────────────────────┐
│ [+ 新对话]   │                                   │
│ 历史对话     │      有什么可以帮你？               │
│   夏日文案…  │   基于 SSE 的 AI 创意助手 Chat     │
│   活动推送…  │                                   │
│             │     ┌─────────────────────┐       │
│             │     │ 输入…          [发送] │       │
│             │     └─────────────────────┘       │
└─────────────┴───────────────────────────────────┘
     260px              flex 1
```

| 元素 | 规格 |
|------|------|
| 历史侧栏 | **始终显示**（与对话态相同）；`PreviewConversationSidebar` |
| 新对话 | 点击后进入空态，历史列表无 active 项 |
| 历史项 | 点击加载对应对话，侧栏该项高亮 |
| 问候语 | `--text-2xl`，居中于主内容区 |
| Composer | pill 形，贴主区底部，max-width 640px |

#### 4.4.2 对话态（含历史侧栏）

**原型**：`PreviewChatActive`

```
┌─────────────┬───────────────────────────────────┐
│ [+ 新对话]   │                                   │
│ 历史对话     │  [AI]  助手气泡 + 复制/重新生成      │
│ ● 夏日文案…  │              [你] 用户气泡（右）    │
│   活动推送…  │  [AI]  流式回复…|                  │
│             ├───────────────────────────────────┤
│             │ [ TextArea              ] [停止]  │
└─────────────┴───────────────────────────────────┘
     260px              flex 1
```

**历史侧栏（PreviewConversationSidebar）**：

| 元素 | 规格 |
|------|------|
| 宽度 | 260px |
| 新对话 | outline 按钮，Plus 图标 |
| 列表项 | 首条用户问题 truncate；active 项 accent-subtle + 左侧 2px Teal 条 |
| 数据 | Week 9：`GET /api/conversations` |

**消息行（PreviewMessageRow）**：

| 角色 | 布局 | 气泡 |
|------|------|------|
| 用户 | 右对齐：`content \| Avatar` | accent-subtle 底，圆角 16px，右下小圆角 |
| AI | 左对齐：`Avatar \| content` | surface + border；Avatar 显示「AI」 |
| Avatar | 32px 圆形 | 用户 Ink 首字母；AI accent-subtle |
| 流式 | AI 气泡末尾 | 2px accent 光标 blink |
| 操作 | 气泡下方 | 复制（全部）；AI 额外「重新生成」 |

**Composer**：

| 状态 | 主按钮 |
|------|--------|
| 空闲 | 发送（无输入 disabled） |
| 流式中 | 停止生成（AbortController） |

Enter 发送，Shift+Enter 换行。

#### 状态机

```
idle → sending → streaming → idle
                  ↓ stop
                 idle（保留 partial 内容）
```

#### API

```
GET/POST /api/chat/stream        SSE 流式
GET /api/conversations           历史列表
GET /api/conversations/{id}      历史消息
```

#### 不包含（参考 GPT 但不做）

图片/资料库/项目/Codex、语音输入、Thinking 模式、Chat/Work 切换、点赞点踩。

#### 验收标准（Week 9）

- [ ] 空态：历史侧栏 + 居中问候 + pill Composer（侧栏与对话态一致）
- [ ] 对话态：历史侧栏 + Avatar + 用户右气泡 + AI 左气泡
- [ ] 流式光标、停止生成、复制、重新生成
- [ ] 视觉与 style-preview 两个 Chat 预览块一致
- [ ] SSE 与历史会话 API 联调通过

---

### 4.5 知识库问答页 Knowledge / RAG

| 属性 | 值 |
|------|-----|
| **路由** | `/knowledge` |
| **原型文件** | [`PreviewKnowledgePanel.tsx`](../frontend/src/style-guide/components/PreviewKnowledgePanel.tsx) |
| **建议文件** | `pages/KnowledgePage.tsx`、`components/knowledge/KnowledgeDocSidebar.tsx` |
| **实施周次** | Week 11（RAG 知识库问答） |
| **参考** | 飞书知识问答（历史问答 + 宽问题泡 + 文档式回答 + 引用） |

> 当前 [`KnowledgePage.tsx`](../frontend/src/pages/KnowledgePage.tsx) 为「顶部搜索 + 回答卡片」结构；**后续需按本原型迁移为线程式 RAG UI**。

#### 页面目标

用户上传文档、基于 RAG 连续问答；回答以文档式排版展示，附带行内引用角标与 References 列表。

#### 布局线框

```
┌──────────────┬────────────────────────────────────────────┐
│ 文档库        │  [你]  用户问题宽气泡                       │
│ [上传文档]    │  [AI]  文档式回答 + 列表 + 行内 [1][2]     │
│ 📄 手册.md   │  ── 引用资料 References（N） ──            │
│ ───────────  │  [1] source — excerpt                      │
│ 历史问答      ├────────────────────────────────────────────┤
│ [+ 新问答]    │ [ 继续提问…                    ] [ 提问 ]   │
│ ● 夏日活动…   │                                            │
└──────────────┴────────────────────────────────────────────┘
     280px                        flex 1
```

#### 左栏（双区）

**1. 文档库**

| 元素 | 规格 |
|------|------|
| Header | 「文档库」uppercase 12px |
| 上传 | primary 按钮「上传文档」；支持 .txt / .md |
| DocItem | FileTextOutlined + 文件名 ellipsis + `{n} chunks` mono |

**2. 历史问答**（复用 ConversationSidebar 样式）

| 元素 | 规格 |
|------|------|
| 新问答 | 「新问答」按钮 |
| 列表 | 历史问题标题，active 高亮 |

#### 主内容区（线程式，非顶部表单）

| 区块 | 规格 |
|------|------|
| 用户问题 | PreviewMessageRow user；宽气泡 accent-subtle |
| AI 回答 | Avatar + **文档块**（段落、小标题、列表）；非 heavy 气泡 |
| 行内引用 | `[1]` `[2]` superscript badge，mono accent 色 |
| References | 标题「引用资料 References · 共 N 条」；编号 + source + excerpt |
| Composer | **底部**输入 + 「提问」按钮（连续对话感） |

#### API

```
POST /api/knowledge/upload     multipart 文档
POST /api/rag/query            { question } → { answer, references[] }
```

#### 不包含

飞书最左侧全局 icon rail、参考资料分页、复杂文档预览。

#### 验收标准（Week 11）

- [ ] 左栏：文档库 + 历史问答双区
- [ ] 主区：问题泡 + 文档式回答 + `[n]` 角标 + References
- [ ] 底部 Composer 提问（非顶部单行搜索）
- [ ] 视觉与 PreviewKnowledgePanel 一致
- [ ] RAG 联调通过，引用可追溯

---

### 4.8 抠图工作台 Matting

| 属性 | 值 |
|------|-----|
| **路由** | `/ops/matting` |
| **原型文件** | `PreviewMattingWelcome.tsx`、`PreviewMattingStepSource/Config/Candidates/Save.tsx`、`PreviewMattingDialogs.tsx`、`PreviewImageSourcePanel.tsx` |
| **建议文件** | `pages/MattingPage.tsx`、`components/ops/TaskSidebar.tsx`、`components/ops/CandidateGallery.tsx` |
| **实施周次** | Week 12+（Phase 2 图文运营） |
| **参考** | ai-center 美术机台任务侧栏/历史/候选画廊（布局与能力，非暗色 UI） |

#### 页面目标

运营人员选择源图（上传或素材库），配置抠图模板与 Prompt，生成多候选透明 PNG，选中后保存到 Assets（`matted` 标签）。

#### 图片来源（步骤 ①，与 Campaign 共用组件）

| 顶层路径 | 子路径 | 说明 |
|----------|--------|------|
| **直接上传** | — | Dropzone + 已选缩略图条 |
| **素材库** | **已有素材** | mini 网格 Picker，带 `matted`/`reference` 标签 |
| **素材库** | **AI 生图入库** | Prompt → 生成 4 张 → 选候选 → `PreviewTagAssetDialog` 打标入库 |

原型：`PreviewImageSourcePanel`（`mode`: upload / library-existing / library-ai）；三态对比见 `PreviewMattingDialogs` 底部并排区块。

#### 布局线框

```
┌────────────┬──────────────────────────────────────────────────┐
│ TaskSidebar│ PreviewStepNav: ①源图 → ②配置 → ③候选 → ④保存   │
│ 260px      ├──────────────────────────────────────────────────┤
│ 新建任务/组 │ [当前步骤内容区]                                    │
│ 置顶/分组   │  ③ 候选: CandidateGallery（checkerboard）         │
│            ├──────────────────────────────────────────────────┤
│            │ footer: [取消]  [保存到 Assets · matted]          │
└────────────┴──────────────────────────────────────────────────┘
```

#### 空态（PreviewMattingWelcome）

| 元素 | 规格 |
|------|------|
| 左栏 | TaskSidebar（新建任务/分组、置顶、未分组、文件夹折叠） |
| 右区 | 居中 Scissor 图标 + 「抠图工作台 Matting」+ 引导文案 |

#### 工作态四步流（各为独立预览块）

| 步骤 | 原型文件 | 内容 |
|------|----------|------|
| ① 源图 | `PreviewMattingStepSource` | `PreviewImageSourcePanel`（默认 upload 态） |
| ② 配置 | `PreviewMattingStepConfig` | 源图只读条 + 模板/Prompt/模型 + 「框选区域」 |
| ③ 候选 | `PreviewMattingStepCandidates` | CandidateGallery + 重新生成/历史 |
| ④ 保存 | `PreviewMattingStepSave` | 已选大图预览 + 标签 + 保存说明 |

外壳组件：`PreviewMattingStepFrame`（TaskSidebar + StepNav + footer 按步变化）

#### 共用组件

| 原型 | 业务 | 说明 |
|------|------|------|
| PreviewTaskSidebar | TaskSidebar | 260px，任务行 active/running/done |
| PreviewStepNav | StepNav | 水平四步条 |
| PreviewCandidateGallery | CandidateGallery | checkerboard、选中勾、已选计数 |
| PreviewOpsDialog | OpsDialog | 新建/重命名任务 |
| PreviewHistoryDrawer | HistoryDrawer | 右侧历史生成列表 |
| PreviewImageSourcePanel | ImageSourcePanel | 上传 / 素材库·已有 / 素材库·AI 入库 |
| PreviewTagAssetDialog | TagAssetDialog | AI 候选打标入库 |
| PreviewMattingStepFrame | MattingStepFrame | 四步共用外壳 |

#### API 占位

```
POST /api/ops/matting/tasks          新建任务
POST /api/ops/matting/{id}/generate    生成候选
POST /api/ops/matting/{id}/save        保存到 Assets
GET  /api/ops/matting/{id}/history     历史生成
```

#### 验收标准（Week 12+）

- [ ] 空态：TaskSidebar + welcome 与 PreviewMattingWelcome 一致
- [ ] 四步各块独立可见，StepNav 高亮对应步骤
- [ ] 图片来源三态（upload / library-existing / library-ai）+ 打标入库 Dialog
- [ ] 对话框/历史 drawer 与 PreviewMattingDialogs 一致
- [ ] **非 Chat 气泡**主布局；Studio Neutral 色板
- [ ] 模块 A 独立路由，不嵌入 Campaign Tab

---

### 4.9 活动帖工作流 Campaign

| 属性 | 值 |
|------|-----|
| **路由** | `/ops/campaign` |
| **原型文件** | `PreviewCampaignWorkspace.tsx`、`PreviewCampaignPostCard.tsx`、`PreviewCampaignImageSources.tsx`、`PreviewImageSourcePanel.tsx` |
| **建议文件** | `pages/CampaignPage.tsx`、`components/ops/CampaignPostCard.tsx` |
| **实施周次** | Week 12+（Phase 2 图文运营） |
| **参考** | Brief §5 活动帖双栏 + Tab 工作流 |

#### 页面目标

运营填写活动信息，生成配图候选与推送文案，预览牛客帖卡片，导出草稿包或 zip。

#### 布局线框

```
┌─────────────────────┬────────────────────────────────────────┐
│ 活动信息（表单）~360px│  Tab: [配图] [文案] [预览]              │
│ 主题/时间/受众/福利  │  配图: ImageSourcePanel + 生候选 + Gallery │
│ 风格/画幅/禁用词     │  文案: 生成初稿 + 风格模板 + prose 块     │
│ [保存草稿]          │  预览: CampaignPostCard + 下载/草稿包     │
└─────────────────────┴────────────────────────────────────────┘
```

#### 左栏表单字段

| 字段 | 类型 | 必填 |
|------|------|------|
| 活动主题 | Input | 是 |
| 活动时间 | DateRange | 否 |
| 目标受众 | Input | 否 |
| 福利亮点 | TextArea | 否 |
| 视觉风格 | Select | 否 |
| 画幅比例 | Select | 否 |
| 禁用词 | TextArea | 否 |

#### 配图 Tab 图片来源

与 Matting 步骤 ① 共用 `PreviewImageSourcePanel`（contextLabel=`参考图`）：

1. **直接上传** 或 **素材库**（已有素材 / AI 生图打标入库）
2. 参考图选定后 → 「生成 4 张候选」→ CandidateGallery
3. 选中配图进入草稿包；可另存 Assets · `generated`

独立三态对比：`PreviewCampaignImageSources`（三列并排）

#### 右栏 Tab

| Tab | 内容 |
|-----|------|
| 配图 | ImageSourcePanel + 「生成 4 张候选」+ CandidateGallery + 选用说明 |
| 文案 | 「生成初稿」+ 风格模板 Select + 「优化」；**prose 文档块**（非 Chat 气泡） |
| 预览 | CampaignPostCard（16:9 封面 + 标题 + 正文 + #活动）+ 下载 zip / 保存草稿包 |

#### 草稿包结构（MVP）

```json
{
  "title": "...",
  "body": "...",
  "coverAssetId": "...",
  "tags": ["活动"],
  "exportedAt": "ISO8601"
}
```

#### API 占位

```
POST /api/ops/campaign/draft           保存草稿
POST /api/ops/campaign/generate-images 生成配图
POST /api/ops/campaign/generate-copy    生成/优化文案
GET  /api/ops/campaign/{id}/export      导出 zip
```

#### 验收标准（Week 12+）

- [ ] 左表单 + 右三 Tab 与 PreviewCampaignWorkspace 一致
- [ ] 配图 Tab 含 ImageSourcePanel + 生图候选；三态预览块可对照
- [ ] 预览 Tab 牛客帖卡片与 PreviewCampaignPostCard 一致
- [ ] 文案区为 prose 块，**不用** PreviewMessageRow 气泡
- [ ] 模块 B 独立路由 `/ops/campaign`
- [ ] MVP 底部提示「复制到牛客手动发布」

---

## 5. 组件复用与文件映射

从原型复制到业务组件，**禁止**业务代码 `import Preview*`。

| 原型组件 | 业务组件 | 目标路径 |
|----------|----------|----------|
| PreviewAuthCard | AuthCardLayout | `components/auth/AuthCardLayout.tsx` |
| PreviewSidebar | AppSidebar | `components/layout/AppSidebar.tsx` |
| PreviewTopBar | AppTopBar | `components/layout/AppTopBar.tsx` |
| PreviewStatsStrip | AssetStatsStrip | `components/assets/AssetStatsStrip.tsx` |
| PreviewAssetGrid | AssetGrid | `components/assets/AssetGrid.tsx` |
| PreviewChatEmpty | ChatEmptyState | `components/chat/ChatEmptyState.tsx` |
| PreviewChatActive | ChatActiveLayout | `pages/ChatPage.tsx`（对话态布局） |
| PreviewConversationSidebar | ChatHistorySidebar | `components/chat/ChatHistorySidebar.tsx` |
| PreviewMessageRow | ChatMessageRow | `components/chat/ChatMessageRow.tsx` |
| PreviewKnowledgePanel | KnowledgePanel | `pages/KnowledgePage.tsx`（线程式 RAG） |
| PreviewTaskSidebar | TaskSidebar | `components/ops/TaskSidebar.tsx` |
| PreviewStepNav | StepNav | `components/ops/StepNav.tsx` |
| PreviewCandidateGallery | CandidateGallery | `components/ops/CandidateGallery.tsx` |
| PreviewOpsDialog | OpsDialog | `components/ops/OpsDialog.tsx` |
| PreviewHistoryDrawer | HistoryDrawer | `components/ops/HistoryDrawer.tsx` |
| PreviewMattingWelcome | MattingEmptyState | `pages/MattingPage.tsx`（空态） |
| PreviewMattingStepSource | MattingStepSource | `pages/MattingPage.tsx`（步骤 ①） |
| PreviewMattingStepConfig | MattingStepConfig | `pages/MattingPage.tsx`（步骤 ②） |
| PreviewMattingStepCandidates | MattingStepCandidates | `pages/MattingPage.tsx`（步骤 ③） |
| PreviewMattingStepSave | MattingStepSave | `pages/MattingPage.tsx`（步骤 ④） |
| PreviewMattingStepFrame | MattingStepFrame | `components/ops/MattingStepFrame.tsx` |
| PreviewImageSourcePanel | ImageSourcePanel | `components/ops/ImageSourcePanel.tsx` |
| PreviewTagAssetDialog | TagAssetDialog | `components/ops/TagAssetDialog.tsx` |
| PreviewCampaignWorkspace | CampaignPage | `pages/CampaignPage.tsx` |
| PreviewCampaignImageSources | — | 配图来源三态参考（实现时并入 ImageSourcePanel） |
| PreviewCampaignPostCard | CampaignPostCard | `components/ops/CampaignPostCard.tsx` |
| tokens.css | 全局 tokens | `src/styles/tokens.css` |
| antdTheme.ts | 主题 | `src/theme/antdTheme.ts` |
| global.css | 全局样式 | `src/styles/global.css` |

### 样式迁移步骤

1. 复制 `style-guide/tokens.css` → `src/styles/tokens.css`
2. 复制 `style-guide/antdTheme.ts` → `src/theme/antdTheme.ts`
3. 复制 `style-guide/global.css` → `src/styles/global.css`（字体 import）
4. 在 `main.tsx` 引入 `styles/global.css`，ConfigProvider 使用 `getWorkbenchTheme('light')`
5. 各业务组件 CSS Modules 从对应 `Preview*.module.css` 复制并调整 class 名

---

## 6. 路由与实现顺序

### 6.1 当前路由（[`router/index.tsx`](../frontend/src/router/index.tsx)）

| 路径 | 组件 | Phase 1 动作 |
|------|------|-------------|
| `/login` | LoginPage | 按设计迁移 UI |
| `/register` | RegisterPage | 按设计迁移 UI |
| `/` | MainLayout | 重写 Shell |
| `/assets` | AssetListPage | 完整实现 |
| `/assets/upload` | AssetUploadPage | Phase 2（占位保留） |
| `/chat` | — | Phase 2 新增 |
| `/knowledge` | — | Phase 2 新增 |
| `/ops/matting` | — | Phase 2 新增（Week 12+） |
| `/ops/campaign` | — | Phase 2 新增（Week 12+） |

### 6.2 推荐实施顺序

```
Step 1  迁移 tokens + theme + global.css → main.tsx 引入
Step 2  重写 MainLayout + AppSidebar + AppTopBar
Step 3  抽取 AuthCardLayout，迁移 LoginPage
Step 4  迁移 RegisterPage（共用 AuthCardLayout）
Step 5  新建 api/assets.ts
Step 6  实现 AssetListPage（Stats + Toolbar + Grid + Table）
Step 7  （Phase 2）AssetUploadPage
Step 8  （Phase 2）ChatPage + SSE
Step 9  （Phase 2）KnowledgePage + RAG
Step 10 （Phase 2）MattingPage + CampaignPage（图文运营）
```

**导师 AI 执行原则**：每次只做一个 Step，完成后对照第 7 章验收清单，再进入下一步。

---

## 7. 验收清单

### 7.1 全局（每步完成后检查）

- [ ] 视觉与 http://localhost:5173/style-preview.html 一致
- [ ] 无 `#4F46E5` / `#7C3AED` 等 Indigo/紫硬编码
- [ ] 无超过 3 行的 inline style 对象
- [ ] 颜色/间距使用 `var(--token)`
- [ ] Ant Design 组件与自定义卡片无色差

### 7.2 LoginPage

- [ ] Auth 卡片居中，max-width 400px
- [ ] Logo 扁平 Ink，无渐变
- [ ] 登录 API 联调成功，跳转 `/`
- [ ] 错误/loading 状态正常

### 7.3 RegisterPage

- [ ] 与 Login 视觉一致
- [ ] 注册成功跳转 `/login`

### 7.4 MainLayout + Shell

- [ ] Sidebar 5 项导航渲染，Assets 激活态正确
- [ ] TopBar 用户信息来自 authStore
- [ ] 退出登录可用
- [ ] 768px 侧栏隐藏

### 7.5 AssetListPage

- [ ] KPI 三卡片、Toolbar、Grid、Table 齐全
- [ ] Grid 透明格缩略图
- [ ] 分页、搜索、删除可用
- [ ] 上传按钮 → `/assets/upload`
- [ ] 空状态引导

### 7.6 ChatPage（Week 9）

- [ ] 空态与 PreviewChatEmpty 一致（历史侧栏 + 问候 + pill Composer）
- [ ] 对话态与 PreviewChatActive 一致（历史侧栏 + Avatar + 气泡）
- [ ] 流式光标、停止生成、复制、重新生成
- [ ] SSE 与历史会话 API 联调通过

### 7.7 KnowledgePage（Week 11）

- [x] 左栏文档库 + 历史问答与原型一致
- [x] 线程式问答：问题泡 + 文档式回答 + `[n]` 角标
- [x] References 列表 + 底部 Composer
- [x] RAG 联调通过，引用可追溯
- [x] 文档列表 API 持久化（Chroma）；历史会话 MySQL 持久化

### 7.8 MattingPage（Week 12+）

- [ ] 空态与 PreviewMattingWelcome 一致
- [ ] 四步各块独立，StepNav 高亮对应步骤
- [ ] 图片来源三态 + TagAssetDialog + 候选画廊 checkerboard
- [ ] 保存到 Assets API 联调

### 7.9 CampaignPage（Week 12+）

- [ ] 左表单 + 右三 Tab 与 PreviewCampaignWorkspace 一致
- [ ] 配图 Tab：ImageSourcePanel + 生图候选；三态预览可对照
- [ ] 文案 prose 块（非 Chat 气泡）
- [ ] 预览 Tab PostCard + 导出草稿包

---

## 8. 附录

### 8.1 原型 → 需求章节索引

| 原型文件 | 需求章节 |
|----------|----------|
| `PreviewAuthCard.tsx` | 4.1 Login、4.2 Register |
| `PreviewSidebar.tsx` | 3.3 Sidebar |
| `PreviewTopBar.tsx` | 3.4 TopBar |
| `DesignPreviewPage.tsx`（Assets 区） | 4.3 Assets List |
| `PreviewStatsStrip.tsx` | 4.3 StatsStrip |
| `PreviewAssetGrid.tsx` | 4.3 AssetGrid |
| `PreviewChatEmpty.tsx` | 4.4.1 Chat 初始空态 |
| `PreviewChatActive.tsx` | 4.4.2 Chat 对话态 |
| `PreviewConversationSidebar.tsx` | 4.4.2 / 4.5 历史侧栏 |
| `PreviewMessageRow.tsx` | 4.4.2 / 4.5 消息行 |
| `PreviewKnowledgePanel.tsx` | 4.5 Knowledge / RAG |
| `PreviewMattingWelcome.tsx` | 4.8 Matting 空态 |
| `PreviewMattingStepSource.tsx` | 4.8 Matting 步骤 ① 源图 |
| `PreviewMattingStepConfig.tsx` | 4.8 Matting 步骤 ② 配置 |
| `PreviewMattingStepCandidates.tsx` | 4.8 Matting 步骤 ③ 候选 |
| `PreviewMattingStepSave.tsx` | 4.8 Matting 步骤 ④ 保存 |
| `PreviewMattingDialogs.tsx` | 4.8 Matting 对话框/历史/图片来源三态 |
| `PreviewImageSourcePanel.tsx` | 4.8 / 4.9 图片来源 |
| `PreviewTagAssetDialog.tsx` | 4.8 / 4.9 AI 打标入库 |
| `PreviewCampaignImageSources.tsx` | 4.9 Campaign 参考图三态 |
| `PreviewCampaignWorkspace.tsx` | 4.9 Campaign 工作台 |
| `PreviewCampaignPostCard.tsx` | 4.9 Campaign 发帖预览 |
| `PreviewTaskSidebar.tsx` 等 Ops 共用 | 4.8 / 4.9 |
| `tokens.css` / `antdTheme.ts` | 第 2 章 |

### 8.2 Phase 2 待设计 / 待实装模块

以下模块**不在 Phase 1 范围**，后续单独补充需求章节：

| 模块 | 路由 | 说明 |
|------|------|------|
| 素材上传 Upload | `/assets/upload` | 拖拽区、进度条、类型校验 |
| 标签管理 Tags | `/tags` | CRUD、颜色标记 |
| 设置 Settings | `/settings` | 账户、主题偏好 |
| Canvas 标注 | `/assets/:id` | 图片预览、矩形标注、缩放拖拽 |
| 虚拟列表 | Chat / Assets | 长列表性能优化 |
| Dark 主题持久化 | 全局 | localStorage + ThemeToggle |

> **图文运营（Matting / Campaign）** 设计稿已完成，见 style-preview.html Ops 区块；需求见 §4.8 / §4.9。

### 8.3 给全栈导师 AI 的执行提示

1. **开始任何页面前**：阅读本文档对应章节 + 打开 style-preview 对照 + 阅读 frontend-style-guide.md
2. **一次只做一页/一步**：不要同时改 Login + Layout + Assets
3. **保留现有 API 逻辑**：Login/Register 的 `onFinish` 已可用，只迁移 UI
4. **不要 import Preview* 到 pages/**：复制样式与结构到业务组件
5. **Phase 2 模块不要提前创建**：Chat/Knowledge/Upload 除非学习者进入对应 Week
6. **Ops 模块**：Matting / Campaign 独立路由；禁止 import Preview*；抠图侧栏可参考 ai-center 交互清单，React 用简化 state
7. **完成后**：提醒学习者勾选第 7 章验收清单，并 `pnpm dev` 自测

### 8.4 相关文档

- 项目定位：[`project-idea.md`](project-idea.md)
- 16 周计划：[`study-plan.md`](study-plan.md)
- 前端代码规范：[`frontend-style-guide.md`](frontend-style-guide.md)
- 设计预览说明：[`frontend/src/style-guide/README.md`](../frontend/src/style-guide/README.md)

---

*文档维护：设计变更时同步更新 style-guide 原型与本需求文档，保持两者一致。*
