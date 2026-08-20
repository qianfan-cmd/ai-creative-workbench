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
| **路由** | `/chat`（Phase 2 注册） |
| **原型文件** | [`PreviewChatPanel.tsx`](../frontend/src/style-guide/components/PreviewChatPanel.tsx) |
| **建议文件** | `pages/ChatPage.tsx`、`components/chat/ChatPanel.tsx` |
| **实施周次** | Week 9（SSE 流式输出） |

> **Phase 1 本文档仅定义 UI 规格，不要求实现路由与 API 联调。** 全栈导师 AI 在 Phase 1 不要创建 ChatPage，除非学习者明确进入 Week 9。

#### 页面目标

用户与 AI 对话，支持 SSE 流式输出、停止生成、历史消息展示。

#### 布局线框

```
┌─────────────────────────────────────────┐
│ 消息列表（flex column, min-height 220）   │
│                                         │
│  [你]                                   │
│  ┌─────────────────────────┐            │
│  │ 用户消息气泡（右对齐）    │            │
│  └─────────────────────────┘            │
│                                         │
│  [Assistant · SSE]                      │
│  ┌─────────────────────────┐            │
│  │ AI 回复气泡（左对齐）     │            │
│  │ 流式文字...|             │ ← 光标动画 │
│  └─────────────────────────┘            │
├─────────────────────────────────────────┤
│ Composer                                │
│ [ 输入消息，Enter 发送…              ]  │
│              [停止生成] [发送]           │
└─────────────────────────────────────────┘
```

#### 消息气泡样式

| 角色 | 样式 |
|------|------|
| 用户 | 右对齐；Light: Ink 底 + -inverse 文字；Dark: subtle 底 |
| Assistant | 左对齐；subtle 背景 + border；label「Assistant · SSE」 |
| 流式光标 | 2px 宽 accent 色竖线，blink 动画；`prefers-reduced-motion` 时静态 |

#### Composer

| 控件 | 说明 |
|------|------|
| 输入框 | TextArea 或 Input；Enter 发送，Shift+Enter 换行 |
| 发送 | primary，生成中 disabled |
| 停止生成 | 流式进行中显示，点击 AbortController abort |

#### 状态机

```
idle → sending → streaming → idle
                  ↓ stop
                 idle（保留已生成 partial 内容）
```

#### Phase 2 API

```
GET /api/chat/stream?message=xxx   (SSE)
或 POST /api/chat/stream { message }

GET /api/conversations
GET /api/conversations/{id}
```

#### Phase 1 UI 验收（Week 9 时勾选）

- [ ] 气泡样式与 PreviewChatPanel 一致
- [ ] 流式光标动画正常
- [ ] 停止生成按钮可见且逻辑正确
- [ ] SSE 联调通过

---

### 4.5 知识库问答页 Knowledge / RAG

| 属性 | 值 |
|------|-----|
| **路由** | `/knowledge`（Phase 2 注册） |
| **原型文件** | [`PreviewKnowledgePanel.tsx`](../frontend/src/style-guide/components/PreviewKnowledgePanel.tsx) |
| **建议文件** | `pages/KnowledgePage.tsx`、`components/knowledge/KnowledgePanel.tsx` |
| **实施周次** | Week 11（RAG 知识库问答） |

> **Phase 1 本文档仅定义 UI 规格，不要求实现。** 全栈导师 AI 在 Phase 1 不要创建 KnowledgePage。

#### 页面目标

用户上传知识文档，基于 RAG 检索问答，回答附带引用片段（References）。

#### 布局线框

```
┌──────────────┬────────────────────────────────────┐
│ 已索引文档    │  QA 面板                            │
│ (240px)      │                                    │
│              │  [🔍 夏日活动推送有什么注意事项？ ]   │
│ 📄 手册.md   │                                    │
│    42 chunks │  ┌─ RAG 回答 ─────────────────┐   │
│              │  │ 建议在版本更新后 48 小时内...  │   │
│ 📄 指南.pdf  │  └─────────────────────────────┘   │
│    28 chunks │                                    │
│              │  引用片段 References                │
│ 📄 FAQ.txt   │  ┌─ 游戏活动运营手册.md ────────┐   │
│    15 chunks │  │ 夏日活动推荐在版本更新后...    │   │
│              │  └─────────────────────────────┘   │
└──────────────┴────────────────────────────────────┘
```

#### 左栏文档列表

| 元素 | 规格 |
|------|------|
| Header | 「已索引文档」，uppercase 12px |
| DocItem | FileTextOutlined accent 色 + 文件名 + `{n} chunks` mono |
| Hover | `--color-bg-hover` |

#### 右栏 QA 面板

| 区块 | 规格 |
|------|------|
| 查询输入 | Search icon + 用户问题 |
| RAG 回答 | accent-subtle 背景 + accent 边框；label「RAG 回答」 |
| References | label「引用片段 References」；每项含 source（mono accent）+ excerpt |

#### Phase 2 API

```
POST /api/knowledge/upload     multipart 文档
GET  /api/knowledge/documents  文档列表
POST /api/rag/query            { question } → { answer, references[] }
```

#### Phase 1 UI 验收（Week 11 时勾选）

- [ ] 左右分栏与原型一致
- [ ] References 卡片可展示多条引用
- [ ] RAG 联调通过，引用来源可追溯

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
| PreviewChatPanel | ChatPanel | `components/chat/ChatPanel.tsx` |
| PreviewKnowledgePanel | KnowledgePanel | `components/knowledge/KnowledgePanel.tsx` |
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

### 7.6 ChatPage（Phase 2 / Week 9）

- [ ] UI 与 PreviewChatPanel 一致
- [ ] SSE 流式 + 停止生成

### 7.7 KnowledgePage（Phase 2 / Week 11）

- [ ] UI 与 PreviewKnowledgePanel 一致
- [ ] RAG 回答 + References 展示

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
| `PreviewChatPanel.tsx` | 4.4 Chat |
| `PreviewKnowledgePanel.tsx` | 4.5 Knowledge |
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

### 8.3 给全栈导师 AI 的执行提示

1. **开始任何页面前**：阅读本文档对应章节 + 打开 style-preview 对照 + 阅读 frontend-style-guide.md
2. **一次只做一页/一步**：不要同时改 Login + Layout + Assets
3. **保留现有 API 逻辑**：Login/Register 的 `onFinish` 已可用，只迁移 UI
4. **不要 import Preview* 到 pages/**：复制样式与结构到业务组件
5. **Phase 2 模块不要提前创建**：Chat/Knowledge/Upload 除非学习者进入对应 Week
6. **完成后**：提醒学习者勾选第 7 章验收清单，并 `pnpm dev` 自测

### 8.4 相关文档

- 项目定位：[`project-idea.md`](project-idea.md)
- 16 周计划：[`study-plan.md`](study-plan.md)
- 前端代码规范：[`frontend-style-guide.md`](frontend-style-guide.md)
- 设计预览说明：[`frontend/src/style-guide/README.md`](../frontend/src/style-guide/README.md)

---

*文档维护：设计变更时同步更新 style-guide 原型与本需求文档，保持两者一致。*
