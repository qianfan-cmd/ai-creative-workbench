# 前端代码规范（样式与组件）

> **页面级需求以 [`frontend-requirements.md`](frontend-requirements.md) 为准**  
> **AI 速查：[`frontend-ai-brief.md`](frontend-ai-brief.md)**  
> 适用范围：`frontend/` React + TypeScript + Ant Design 项目  
> 风格基准：Studio Neutral — http://localhost:5173/style-preview.html

---

## 0. 设计方向：Studio Neutral

对标 Notion / Figma / Google Workspace，**避免** Indigo/紫渐变 AI 模板风。

| Token | Light | 用途 |
|-------|-------|------|
| `--color-ink` | `#18181B` | 主按钮、主文字 |
| `--color-canvas` | `#F7F7F8` | 页面背景 |
| `--color-surface` | `#FFFFFF` | 卡片、侧栏 |
| `--color-accent` | `#0D9488` | 链接、Nav 激活（Teal） |
| `--color-muted` | `#71717A` | 次要文字 |

**字体：** Plus Jakarta Sans（UI）、IBM Plex Mono（文件名/MIME）  
**禁止硬编码：** `#4F46E5`、`#7C3AED` 等旧版 Indigo 色

---

## 1. 样式方案选型

| 方案 | 结论 | 说明 |
|------|------|------|
| Inline `style={{}}` | **禁止**用于布局/主题/复用 | 仅允许运行时动态值（如 `width: \`${pct}%\``） |
| `className` + CSS Modules + Design Tokens | **主方案** | 与 Ant Design 生态一致 |
| Tailwind CSS | **不推荐** | 与 Ant Design 样式体系易冲突 |

### 样式分层决策树

```
需要写样式？
├─ Ant Design 有现成组件？ → 用 Ant Design（Button/Form/Table/Upload…）
├─ 布局/品牌/卡片/grid？ → CSS Modules + tokens.css 变量
└─ 值是运行时计算的？ → 允许 inline style（单行或极简对象）
```

---

## 2. 目录约定

```
frontend/src/
├── styles/
│   ├── tokens.css             # Design Tokens（从 style-guide 同步）
│   └── global.css             # Reset + 字体
├── theme/
│   └── antdTheme.ts           # getWorkbenchTheme('light' | 'dark')
├── style-guide/               # 设计原型（只读参考，不 import 到 pages）
├── pages/
│   └── XxxPage.tsx + XxxPage.module.css
└── components/
    ├── layout/                # AppSidebar, AppTopBar
    ├── auth/                  # AuthCardLayout
    └── assets/                # AssetGrid, AssetStatsStrip
```

**规则：**

- 每个 Page 最多一个 `.module.css`
- 禁止在 Page 内写超过 3 行的 `style={{}}` 对象
- 颜色/间距/圆角优先用 `var(--xxx)`，禁止魔法数字散落
- **禁止** `pages/` import `Preview*` 组件；从 `Preview*.module.css` 复制样式

---

## 3. Design Tokens

所有 token 定义在 `src/styles/tokens.css`：

```css
.myCard {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
}
```

Ant Design 主题：

```tsx
import { getWorkbenchTheme } from '@/theme/antdTheme'

<ConfigProvider theme={getWorkbenchTheme('light')}>
```

Light 模式 `colorPrimary` = Ink `#18181B`；链接色 = Teal `#0D9488`。

---

## 4. CSS Modules 命名

采用 **camelCase + 语义化**，必要时用 `_` 表状态：

```css
.sidebar { }
.navItem { }
.navItem_active { }
```

---

## 5. Ant Design 使用原则

1. **优先 props**：`size="small"`、`layout="vertical"`
2. **其次 theme token**：`getWorkbenchTheme('light')`
3. **最后 :global 覆盖**：仅在 Module 内做最小覆盖

```tsx
// 好：主题统一
<ConfigProvider theme={getWorkbenchTheme('light')}>
  <Button type="primary">上传</Button>
</ConfigProvider>

// 差：硬编码旧色
<Button style={{ background: '#4F46E5' }}>上传</Button>
```

---

## 6. 响应式断点

| 断点 | 宽度 | 用途 |
|------|------|------|
| sm | 768px | 侧边栏隐藏 |
| md | 1024px | 内容区 padding 缩小 |

---

## 7. 验收与迁移

1. 对照 http://localhost:5173/style-preview.html
2. 按 [`frontend-requirements.md`](frontend-requirements.md) 6.2 Step 顺序逐页迁移
3. 每步完成后勾选 requirements 第 7 章验收清单

---

## 8. 相关文档

- [`frontend-requirements.md`](frontend-requirements.md) — 页面线框、API、完整验收
- [`frontend-ai-brief.md`](frontend-ai-brief.md) — AI/导师 30 秒速查
- [`frontend/src/style-guide/README.md`](../frontend/src/style-guide/README.md) — 设计预览说明
