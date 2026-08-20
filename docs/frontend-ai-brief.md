# 前端 AI 速查 Brief（Studio Neutral Workbench）

> **AI / 导师必读**：写任何前端业务代码前先看本文（30 秒），再查完整规格。  
> **完整需求**：[`frontend-requirements.md`](frontend-requirements.md)  
> **代码规范**：[`frontend-style-guide.md`](frontend-style-guide.md)  
> **视觉预览**：http://localhost:5173/style-preview.html  
> **设计原型**：[`frontend/src/style-guide/`](../frontend/src/style-guide/)

---

## 设计方向：Studio Neutral

对标 Notion / Figma / Google Workspace。**禁止** Indigo/紫渐变 AI 模板风。

| 角色 | Light 值 | 用途 |
|------|----------|------|
| Ink | `#18181B` | 主按钮、主文字（antd `colorPrimary`） |
| Canvas | `#F7F7F8` | 页面背景 |
| Surface | `#FFFFFF` | 卡片、侧栏、顶栏 |
| Muted | `#71717A` | 次要文字 |
| **Accent Teal** | `#0D9488` | 链接、Nav 激活、AI 强调 |
| Accent subtle | `rgba(13,148,136,0.08)` | Nav 激活背景 |

**Signature：** 素材缩略图使用 **checkerboard 透明格**（`--checker-light` / `--checker-dark`）。

**字体：** UI = Plus Jakarta Sans（`--font-sans`）；文件名/MIME = IBM Plex Mono（`--font-mono`）。

**禁止硬编码：** `#4F46E5`、`#7C3AED`、旧版 Indigo 主色。

---

## 硬规则（6 条）

1. **不 import `Preview*`** 到 `pages/` 或业务组件；对照 requirements + style-preview，**手写**业务 CSS Modules（骨架 → 分块写 CSS，不默认复制原型文件）。
2. **样式**：CSS Modules + `var(--token)`；布局/主题 **禁止** 超过 3 行的 inline `style={{}}`。
3. **Ant Design**：优先 props → `getWorkbenchTheme('light')` token → 最小 `:global` 覆盖。
4. **保留现有 API 逻辑**（Login/Register 的 `onFinish` 等）；UI 迁移时不改接口调用。
5. **一次只做一个 Step**（见下方顺序）；完成后对照 requirements 第 7 章验收。
6. **Phase 1 范围**：Shell、Login、Register、Assets List；**不做** Upload UI 细节、Chat SSE、Knowledge RAG（除非进入对应 Week）。

---

## 原型 → 业务文件映射

| 原型 | 业务组件 | 路径 |
|------|----------|------|
| PreviewAuthCard | AuthCardLayout | `components/auth/AuthCardLayout.tsx` |
| PreviewSidebar | AppSidebar | `components/layout/AppSidebar.tsx` |
| PreviewTopBar | AppTopBar | `components/layout/AppTopBar.tsx` |
| PreviewStatsStrip | AssetStatsStrip | `components/assets/AssetStatsStrip.tsx` |
| PreviewAssetGrid | AssetGrid | `components/assets/AssetGrid.tsx` |
| tokens.css | 全局 tokens | `src/styles/tokens.css` |
| antdTheme.ts | 主题 | `src/theme/antdTheme.ts` |
| global.css | 全局样式 | `src/styles/global.css` |

---

## Phase 1 实施顺序

```
Step 1  迁移 tokens + theme + global.css → main.tsx 引入
Step 2  重写 MainLayout + AppSidebar + AppTopBar
Step 3  抽取 AuthCardLayout，迁移 LoginPage
Step 4  迁移 RegisterPage
Step 5  新建 api/assets.ts
Step 6  实现 AssetListPage（Stats + Toolbar + Grid + Table）
Step 7+ Phase 2：Upload / Chat / Knowledge
```

**导师原则：** 每次对话只推进 **一个 Step**。

---

## 布局常量

| Token | 值 |
|-------|-----|
| `--sidebar-width` | 240px |
| `--header-height` | 56px |
| `--content-max-width` | 1200px |
| `--radius-panel` | 12px |
| `--radius-control` | 8px |

**响应式：** `< 768px` 侧栏隐藏；`< 1024px` 内容 padding 缩小。

---

## 路由（Phase 1）

| 路径 | 组件 | 动作 |
|------|------|------|
| `/login` | LoginPage | UI 迁移 |
| `/register` | RegisterPage | UI 迁移 |
| `/assets` | AssetListPage | 完整实现 |
| `/assets/upload` | AssetUploadPage | Phase 2 占位 |

Nav 路由必须是 `/assets`（不是 `/asset`）。

---

## 验收快检（每步完成后）

- [ ] 视觉与 style-preview.html 一致
- [ ] 无 Indigo/紫硬编码
- [ ] 无超 3 行 inline style
- [ ] 颜色/间距用 `var(--token)`
- [ ] Ant Design 与自定义区域无色差

---

## 文案规范

- 中文为主，术语保留英文：`Assets`、`Upload`、`Chat`、`Knowledge`
- 按钮用动词：「登录」「注册」「上传」「删除」
- 错误说明原因，不道歉

---

## 相关文档

- [frontend-requirements.md](frontend-requirements.md) — 页面线框、字段、API、完整验收
- [frontend-style-guide.md](frontend-style-guide.md) — CSS Modules、目录、Ant Design 原则
- [study-plan.md](study-plan.md) — 16 周排期

*设计变更时同步更新 style-guide 原型 + frontend-requirements.md + 本 Brief。*
