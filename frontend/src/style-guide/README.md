# Style Guide Preview — Studio Neutral v2

独立风格预览入口，**不修改**主应用 `main.tsx` / 业务页面。

设计方向：**Studio Neutral** — 对标 Notion / Figma / Google Workspace 的企业创意工具感，去除 Indigo/紫渐变「AI 味」。

**页面需求文档**：[`docs/frontend-requirements.md`](../../docs/frontend-requirements.md) — 供全栈导师 AI 与学习者按模块实现业务页。

## 如何查看

```bash
cd frontend
pnpm dev
```

浏览器打开：

- **风格预览：** http://localhost:5173/style-preview.html
- **主应用（不变）：** http://localhost:5173/

预览页右上角可切换 **Light / Dark** 主题。

## 设计 Token 对照

| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| `--color-ink` | `#18181B` | `#FAFAFA` | 主按钮、主文字 |
| `--color-canvas` | `#F7F7F8` | `#09090B` | 页面背景 |
| `--color-surface` | `#FFFFFF` | `#18181B` | 卡片/侧栏 |
| `--color-accent` | `#0D9488` | `#2DD4BF` | 链接、选中、AI 强调 |
| `--color-muted` | `#71717A` | `#A1A1AA` | 次要文字 |

字体：**Plus Jakarta Sans**（UI）+ **IBM Plex Mono**（文件名/数据）

## 文件说明

| 文件 | 用途 |
|------|------|
| `tokens.css` | Design Tokens（Light/Dark CSS Variables） |
| `antdTheme.ts` | `getWorkbenchTheme(mode)` — Ant Design 主题 |
| `global.css` | 预览页全局 reset + 字体 |
| `DesignPreviewPage.tsx` | 完整示例页 + 主题切换 |
| `components/ThemeToggle.tsx` | Light/Dark 切换 |
| `components/Preview*.tsx` | 各模块静态 mock |

## 预览模块

1. **App Shell** — 侧栏 + 顶栏 + 素材 Assets 页（Grid + Table）
2. **Auth** — 登录卡片预览
3. **AI Chat · 初始空态** — `PreviewChatEmpty`（GPT 式问候 + pill Composer）
4. **AI Chat · 对话态** — `PreviewChatActive`（历史侧栏 + Avatar + 气泡 + SSE）
5. **Knowledge / RAG** — `PreviewKnowledgePanel`（飞书式：文档库 + 历史问答 + 线程回答 + References）

共用组件：`PreviewConversationSidebar`、`PreviewMessageRow`

## Signature 元素

素材 Grid 使用 **透明格 checkerboard** 缩略图（设计软件通用 pattern），替代彩虹渐变占位图。

## 验收通过后

按 [`docs/frontend-style-guide.md`](../../docs/frontend-style-guide.md) 逐页迁移 Login / Layout / Assets，将 `style-guide/` 内容迁入 `styles/` 与 `theme/`。

## 设计 Skill

UI 设计遵循 [`frontend/.agents/skills/frontend-design/SKILL.md`](../../.agents/skills/frontend-design/SKILL.md)。
