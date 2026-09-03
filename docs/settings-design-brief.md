# Settings & Campaign UI — 设计 Agent 需求说明

> **受众**：设计 Agent（出稿用，开发按稿手写 CSS Modules，不 import `Preview*` 到业务页）  
> **产品**：AI Creative Workbench · Studio Neutral  
> **关联路由**：`/settings` · `/ops/campaign`

---

## 1. 背景与约束

### 1.1 设计方向：Studio Neutral

对标 Notion / Figma / Google Workspace。**禁止** Indigo / 紫色渐变 AI 模板风。

| 角色 | Light 值 | 用途 |
|------|----------|------|
| Ink | `#18181B` | 主按钮、标题（antd `colorPrimary`） |
| Canvas | `#F7F7F8` | 页面背景 |
| Surface | `#FFFFFF` | 卡片、面板 |
| Muted | `#71717A` | 次要文字 |
| **Accent Teal** | `#0D9488` | 链接、Nav 激活、话题标签、关注按钮 |
| Accent subtle | `rgba(13,148,136,0.08)` | 激活背景 |

**禁止硬编码：** `#4F46E5`、`#7C3AED` 及 Indigo/Purple 主色。

### 1.2 开发约束（设计需知）

- 业务页使用 **CSS Modules + `var(--token)`**，不复制 style-guide 原型 CSS 文件
- 设计稿标注 token 名称即可，开发对照 `frontend/src/styles/tokens.css`
- 牛客预览为 **近似还原**，头像/昵称/互动数字用占位符，不使用真实牛客品牌素材

### 1.3 参考文件

| 文件 | 用途 |
|------|------|
| `frontend/src/style-guide/` | 现有原型（只读参考） |
| `http://localhost:5173/style-preview.html` | Ops 区块视觉对照 |
| `docs/frontend-requirements.md` §4.9 / §7.9 | Campaign 功能规格 |
| `frontend/src/assets/牛客web端预览.png` | Web 端牛客帖布局参考 |
| `frontend/src/assets/牛客移动端预览.jpg` | 移动端牛客帖布局参考 |

---

## 2. Settings 页 `/settings`

### 2.1 页面结构

```
┌─────────────────────────────────────────────────────────────┐
│ 设置 Settings                                                │
│ 账户、外观与 Prompt 模板管理                                  │
├─────────────────────────────────────────────────────────────┤
│ [ 账户 ] [ 外观 ] [ Prompt 模板 ]                             │
├─────────────────────────────────────────────────────────────┤
│ （Tab 内容区，max-width ~960px，左对齐）                      │
└─────────────────────────────────────────────────────────────┘
```

- 面包屑：`Workbench / 设置 Settings`
- Sidebar 与 TopBar 用户菜单「设置」均可进入（不再 disabled）

### 2.2 Tab 1 — 账户

| 元素 | 说明 |
|------|------|
| 用户名 | 只读，`UserVO.username` |
| 邮箱 | 只读，`UserVO.email` |
| 角色 | 只读 Badge，如 `User` / `Admin` |
| 退出登录 | 危险次要按钮或链接，清 token 跳转 `/login` |

布局：单列卡片，label 左 / value 右或上下堆叠，间距 `--space-4`。

### 2.3 Tab 2 — 外观

| 选项 | 说明 |
|------|------|
| 浅色 Light | 默认 Studio Neutral 浅色 |
| 深色 Dark | 深色 token（Ink 背景 + Teal accent） |
| 跟随系统 | `prefers-color-scheme`，持久化 `localStorage` key `workbench-theme-pref` |

控件：三选一 Segmented 或 Radio.Group，选中态 Teal 描边/背景 subtle。

切换后立即生效：`document.documentElement.dataset.theme` + antd ConfigProvider 换肤。

### 2.4 Tab 3 — Prompt 模板

**目标**：管理 AI 提示词模板（文案初稿、文案风格、视觉风格、配图等）。

#### 列表 Table

| 列 | 说明 |
|----|------|
| 名称 | `name` |
| 场景 | `scene` — Tag 着色分组（见下） |
| 类型 | 「系统内置」/「我的模板」 — `userId == null` 为系统 |
| 更新时间 | `updatedAt` 格式化 |
| 操作 | 查看/编辑、删除（系统内置仅「查看」，不可删改） |

**Scene 分组 Tag 色建议：**

| scene 前缀/值 | 标签文案 | 色 |
|---------------|----------|-----|
| `copy_draft` | 文案初稿 | Teal |
| `copy_style_*` | 文案风格 | Blue-gray |
| `campaign_visual_*` | 视觉风格 | Amber |
| `image_gen` | 配图生成 | Green |
| `matting*` | 抠图 | Muted |

#### 新建 / 编辑 Modal

| 字段 | 类型 | 校验 |
|------|------|------|
| 名称 | Input | 必填 |
| 场景 scene | Select 或 Input | 必填；新建用户模板默认 `copy_style_custom` 可改 |
| 模板内容 content | TextArea 6–10 行 | 必填；占位符说明见 tooltip |

**占位符提示（Tooltip 或 Modal 底部说明）：**

- `copy_draft`：`{{theme}}` `{{timeRange}}` `{{benefits}}` `{{audience}}`
- `copy_style_*`：`{{copy}}` `{{hint}}`
- `campaign_visual_*`：短描述写入活动 `visualStyle`，供配图模板引用
- `image_gen`：`{{theme}}` `{{visualStyle}}` `{{aspectRatio}}` 等

顶部工具栏：「新建模板」主按钮（Ink）。

---

## 3. Campaign 预览 Tab（设计对照）

路径：`/ops/campaign` → 右栏 **预览** Tab。

### 3.1 布局

```
┌──────────────────────────────────────────────────────────────┐
│ [ Web 端 ] [ 移动端 ]          ← Segmented 切换                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   （预览卡片居中，max-width 按端别）                           │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ [ 复制标题+正文 ] [ 下载草稿包 zip ]                          │
│ 话题标签：[ #活动________ ]  （可选 Input，Teal 色预览）       │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Web 端预览（参考牛客 web 截图）

白卡片 + 圆角 + 浅灰外背景（`--color-bg-subtle`）：

1. **用户头**：圆形占位头像 · 昵称「运营账号」· 时间「MM-DD HH:mm」· 右侧绿色「+ 关注」按钮（静态）
2. **标题**：粗体 18px，1–2 行
3. **正文**：14px，`line-height: 1.7`，保留换行
4. **配图区**：16:9，`coverUrl` 或渐变占位 + 角标画幅
5. **话题**：行内 `#活动` Teal 字重 500
6. **互动栏**（静态假数据）：评论 10 · 赞 4 · 收藏 2 · 分享 · 「浏览 2972」

### 3.3 移动端预览（参考牛客 mobile 截图）

窄栏 max-width ~390px，居中：

1. **App 顶栏**：返回 `<` · 居中「牛客」（灰色小字，占位）· 右侧 `···`
2. **用户行**：头像 · 昵称 · LV.4 绿标 · 副标题「研发(实习)」· 右侧 Teal「关注」胶囊
3. **标题**：大号粗体
4. **正文**：列表感段落，可多行
5. **底栏**：左「08-30 00:37 广东」灰字 · 右「送花」胶囊 + 数字角标（静态）

### 3.4 动态数据绑定

| Prop | 来源 |
|------|------|
| title | 文案标题或活动主题 fallback |
| body | 文案正文 |
| coverUrl | 已选封面或候选图 |
| hashtag | 默认 `#活动`，可编辑 |

---

## 4. Campaign 文案 Tab

### 4.1 工具栏

```
[ AI 生成初稿 ] [ 风格模板 ▼ ] [ 优化补充 ] [ AI 优化 ] [ 保存文案 ] [ 管理风格模板 → ]
```

「管理风格模板」打开右侧 **Drawer**（见 §5）。

### 4.2 内容区 — prose 文档块（非 Chat 气泡）

流式生成中：`pre`  monospace 感、灰色字「生成中…」

完成后：

```
┌ prose 容器 ─────────────────────────┐
│ 标题：夏日版本更新 · 登录即领限定皮肤   │
│                                     │
│ 新版本已上线！完成每日任务即可兑换…    │
│                                     │
│ （可编辑：标题 Input + 正文 TextArea  │
│   或只读 prose + 下方编辑区 — 开发取   │
│   流式/完成两态即可）                  │
└─────────────────────────────────────┘
```

样式：`background: surface`，`border: 1px solid border`，`border-radius: panel`，`padding: space-4`，`line-height: 1.7`。

### 4.3 草稿状态

右栏 Tab 行右侧或页面 header：`status` Badge

| status | 文案 | 色 |
|--------|------|-----|
| draft | 草稿 | default |
| ready | 可导出 | success |

---

## 5. Campaign — Prompt 快捷 Drawer

从文案 Tab「管理风格模板」打开，宽度 ~480px。

```
┌ 文案风格模板 ─────────────────────── ✕ ┐
│ 仅展示 scene = copy_style_* 的模板      │
│ ┌──────────────────────────────────┐  │
│ │ 活泼推送    copy_style_playful   │  │
│ │ 正式公告    copy_style_formal    │  │
│ │ …                                │  │
│ └──────────────────────────────────┘  │
│ [ + 新建风格模板 ]                      │
│ ─────────────────────────────────────  │
│ 在 Settings 中管理全部模板 →           │
└────────────────────────────────────────┘
```

- 列表项：名称 + scene 小字；点击编辑（Modal，同 Settings）
- 系统内置：只读查看 content
- 保存后刷新 Campaign 下拉

---

## 6. 左栏 — 视觉风格 Select

- 选项来自 API：`campaign_visual_*` 模板
- 显示 `name`，选中值写入活动 `visualStyle` = 模板 `content`（短描述）
- 无 API 数据时 fallback 三个硬编码选项

---

## 7. 交付物清单（设计 Agent 输出）

1. **Settings 三 Tab** 高保真（Light + Dark 各一套更佳）
2. **Campaign 预览 Tab**：Web / Mobile 两态 + Segmented
3. **Campaign 文案 Tab**：prose 块 + 工具栏 + Drawer 线框
4. **组件标注**：间距 token、字号、圆角、状态色
5. **可选**：Prompt Modal 表单、Table 空态

开发实现文件预期：

- `frontend/src/pages/SettingsPage.tsx`
- `frontend/src/components/settings/PromptTemplateManager.tsx`
- `frontend/src/components/ops/CampaignNowcoderWebPreview.tsx`
- `frontend/src/components/ops/CampaignNowcoderMobilePreview.tsx`
- `frontend/src/components/ops/CampaignPreviewPanel.tsx`
- `frontend/src/components/ops/PromptTemplateDrawer.tsx`

---

## 8. 不在本设计范围

- 草稿历史列表 / 多草稿切换
- 素材库 Tags 页改版
- Chat / Knowledge 模块
- style-preview.html 原型文件直接修改（设计稿到位后开发同步）
