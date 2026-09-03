# 活动帖配图对齐 + AI 附图输入 + 预览页操作

> 2026-03 · AI Creative Workbench · 面试向开发复盘

## 1. 背景与目标

**用户痛点**

- 活动帖配图 Tab 与抠图源图 UI 不一致，且「生成 4 张候选」「选为封面并入库」语义混乱。
- 牛客发帖最多 9 张图，预览仅支持单张 cover。
- Matting / Campaign / Chat 的 AI 输入框不支持参考图（后端已有 `referenceUrls`，前端未接）。
- Campaign 仅 `sessionStorage` 单 draft，无法并行多个发帖任务。

**目标**

1. 多任务草稿侧栏（对齐 Matting TaskSidebar 体验）
2. 抽取 `OpsImageSourcePicker`，Matting ↔ Campaign UI 归一
3. Campaign 最多 9 张选图，选中即预览九宫格
4. 预览 Tab 集中「保存活动帖」+「发布」占位
5. `AiImageComposer` 三通道附图（拖拽/粘贴/素材库）接入 Matting、Campaign、Chat
6. Chat 多模态 SSE 链路（Java → Python → DeepSeek OpenAI 格式）

---

## 2. 方案选型

| 决策点 | 选型 | 理由 |
|--------|------|------|
| 多 draft | `GET/DELETE/PATCH /api/ops/campaign/drafts` + `CampaignDraftSidebar` | 与 Matting 任务列表一致；`sessionStorage` 只记 last active id |
| 共享选图器 | 从 `MattingStage1Source` 抽 `OpsImageSourcePicker` | 三态 UI 一处维护；Matting 保留 confirm API，Campaign 仅前端 Set |
| AI scheme 持久化 | `activityJson.postSchemes` | 不新增 Matting 级 scheme 表；保存活动帖时再 `import-url` |
| Chat 附图存储 | `[[images:url1\|\|url2]]\n` 前缀编码进 `message.content` | 无 DB 迁移；`MessageVO.imageUrls` 解析展示 |
| 发布 | disabled + Tooltip | 牛客发帖 API 未对接，避免假成功 |

---

## 3. 关键实现

### 3.1 组件分层

```
CampaignDraftSidebar ──► CampaignPage
                              ├── CampaignImagePicker ──► OpsImageSourcePicker
                              │                              └── AiImageComposer (AI Tab)
                              └── CampaignPreviewPanel (九宫格 + 保存/发布)

MattingStage1Source ──► OpsImageSourcePicker + SourceGenerateComposer ──► AiImageComposer

ChatPage ──► AiImageComposer ──► chatStreamApi(imageUrls)
```

### 3.2 九张上限算法

Campaign 侧 `selectedAssetIds` + `postSchemes.filter(selected)` 合计 ≤ 9；toggle 前计数，超出 `message.warning` 拒绝。

### 3.3 AiImageComposer 三通道

- **拖拽**：composer `onDrop` → `uploadAssetApi` → chip
- **粘贴**：`onPaste` 读 `clipboardData.files`
- **素材库**：Modal 多选 assets

输出 `{ text, attachments[] }`；Matting/Campaign 生图映射为 `referenceUrls`。

### 3.4 Chat 多模态 messages 示例

```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "这张海报适合什么活动？" },
    { "type": "image_url", "image_url": { "url": "https://cdn.example/a.png" } }
  ]
}
```

Java `ChatMultimodalUtil.buildLlmContent` 构建；Python `ChatMessageItem.content: str | list` 原样转发 DeepSeek。

---

## 4. 踩坑与取舍

| 问题 | 处理 |
|------|------|
| DeepSeek 部分模型不支持 vision | 优先 multimodal；失败时可 fallback 把 URL 拼进 text（文档记录，未自动降级） |
| scheme 仅 URL 无 assetId | 「保存活动帖」时批量 `POST /api/assets/import-url` |
| 切换 Campaign draft | `getCampaignDraft` 恢复 `postSchemes` + `selectedAssetIds`；配图 state 按 draftId 隔离 |
| 发布 API | UI 占位，避免用户误以为已发帖 |

---

## 5. 验收清单

1. **多草稿**：新建/切换/重命名/删除侧栏项；`保存草稿` 创建 draftId
2. **配图**：上传/素材库/AI 三态；最多 9 张；预览 Tab 实时九宫格
3. **Matting 回归**：源图三态 + confirm 进框选；AI 生图可附参考图
4. **预览操作**：保存活动帖全量同步；发布 disabled + Tooltip
5. **Chat**：拖拽/粘贴/素材库附图；用户消息展示缩略图；SSE 正常
6. **导出**：zip 下载仍可用

---

## 6. 面试话术（STAR）

- **组件抽象**：抠图与活动帖配图交互 90% 重合，抽取 `OpsImageSourcePicker` 后 Matting 只保留 task 确认逻辑，Campaign 只保留 9 张上限与 draft meta，减少 duplicate UI bug surface。
- **跨模块复用**：`AiImageComposer` 统一 Chat / 生图 referenceUrls，后端 Matting 已有 DTO，Campaign 走 `generateOpsImageApi`，Chat 扩展 SSE 多模态，一条附件模型三处消费。
- **Multimodal 链路**：前端 imageUrls → Java 拼 OpenAI content parts → Python  schema 放宽 content 类型 → DeepSeek；DB 用 content 前缀编码避免 migration，展示层 parse 为 `MessageVO.imageUrls`。
