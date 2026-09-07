# Chat 流式输出 + 虚拟列表 + 智能滚底

> 2026-09 · AI Creative Workbench · 面试向开发复盘  
> Roadmap：Phase 1 · #3 Chat 虚拟列表

## 1. 背景与目标

**用户痛点**

- 流式回复时内容先全量出现，再以「打字机」方式覆盖一遍，消息气泡互相重叠。
- 流式输出期间无法向上滚动，一滑就被强制拉回底部。
- 新一轮提问输出完成后，**前面所有历史气泡布局折叠乱掉**，只能 F5 刷新恢复。

**目标**

1. 流式阶段内容逐段增长，布局稳定、无重叠。
2. 用户上滑阅读时不打断；在底部时自然跟随新内容。
3. 流式结束后恢复虚拟列表性能，历史消息布局不乱。

---

## 2. 方案选型

| 决策点 | 选型 | 理由 |
|--------|------|------|
| 流式阶段列表渲染 | `disableVirtualization` → flex 列布局 | absolute + translateY 在高度剧变时必然 overlap |
| 流式结束后性能 | 恢复 TanStack Virtual | 长对话仍需虚拟化 |
| 行高估算 | flex 阶段 `ResizeObserver` 写缓存 → virtual `estimateSize` 读缓存 | cumulative offset 依赖前面各行高度之和，不能默认 160px |
| 保存后消息更新 | merge 补 `dbId`，保留客户端 `id` 作 React key | 全量替换导致 remount + 缓存丢失 |
| 自动滚底 | `stickToBottomRef` + scroll 监听 | 去掉 `streaming` 无条件滚底 |

**放弃的方案**

- 流式期间继续用 virtual + 每 chunk `measure()`：chunk 频率高，行高滞后，overlap 更严重。
- 保存后 `setMessages(detail.messages.map(...))` 全量替换：id 变化触发 remount，与 virtual 错误估算叠加。

---

## 3. 关键实现

### 3.1 双模式列表

```
ChatPage (streaming?)
    └── VirtualChatMessageList
            ├── streaming=true  → staticList + FlexMeasuredItem (ResizeObserver)
            └── streaming=false → TanStack Virtual + measureElement
```

- `disableVirtualization={streaming}`：流式时用文档流，避免 absolute 行重叠。
- 删除原 `virtualItems.length === 0` fallback：该分支造成「先 flex 全量 → 再 virtual 覆盖」的闪变。

### 3.2 行高缓存

- flex 模式下每行 `ResizeObserver` → `heightCacheRef.set(itemKey, height)`。
- virtual 模式 `estimateSize(index)` 读缓存，缺省才 160。
- `listResetKey={activeConversationId}`：切换会话清空缓存。
- flex → virtual 切换时双 `requestAnimationFrame` + `virtualizer.measure()`。

### 3.3 智能滚底

```tsx
// 仅 forceScroll 或（用户本来在底部 && 仍在底部阈值内）才滚
if (forceScrollRef.current || (stickToBottomRef.current && isNearBottom(el))) {
  requestAnimationFrame(() => scrollMessagesToBottom(el))
}
```

- scroll 监听：`!isNearBottom` → `stickToBottomRef = false`。
- 发消息 / 切会话 / 重新生成：`forceScrollRef` + `stickToBottomRef = true`。

### 3.4 保存后 merge

```tsx
setMessages((prev) =>
  prev.length !== detail.messages.length
    ? detail.messages.map(mapMessageFromApi)  // 极端 fallback
    : prev.map((m, i) => ({ ...m, dbId: detail.messages[i].id, ... }))
)
```

---

## 4. 踩坑与思考

| 现象 | 根因 | 思考 | 最终解法 |
|------|------|------|----------|
| 像打字机覆盖 | fallback flex 正确排版 → virtual 用 160px 估算 → 行重叠后逐步 measure | 不是 SSE 一次吐完，是 **渲染模式切换** | 流式禁用 virtual；去掉 fallback 双路径 |
| 无法上滑 | `streaming` 在 auto-scroll 条件里 | 应区分「用户意图」与「在底部跟随」 | `stickToBottomRef` + 去掉 streaming 强制滚底 |
| 输出完后全乱 | flex→virtual + 全量替换 id | translateY = Σ前面行高；低估则全局错位 | 行高缓存 + merge 保留 key |
| 刷新才正常 | 整页重载未触发 flex↔virtual 恶劣切换 | 根因未修只是暂时隐藏 | 上述三件套一起修 |

---

## 5. 验收清单

- [x] 长回复流式：逐段增长，无重叠/覆盖
- [x] 流式中上滑：不被拉回底部
- [x] 流式中在底部：跟随新 chunk
- [x] 发送新消息：自动滚底
- [x] 流式结束后：历史气泡布局正常
- [x] 连续多轮提问：无需 F5
- [x] `pnpm exec tsc --noEmit` 通过

---

## 6. 面试话术（STAR）

- **虚拟列表 + 流式**：Chat 长对话用 TanStack Virtual，但流式回复高度每帧变化，absolute 定位 + 错误 estimate 会导致行 overlap。我的做法是在 `streaming` 时切回 flex 文档流，结束后再 virtual，并用 ResizeObserver 缓存行高作为 `estimateSize`，保证 cumulative offset 正确。
- **滚动 UX**：自动滚底不能绑 `streaming` 标志，而要绑用户是否在底部。用 ref 记录 stick-to-bottom，scroll 监听用户上滑后停止强制滚底，发新消息时再恢复。
- **状态更新与布局**：保存消息后若全量替换并改 React key，会 remount 丢缓存。改为按 index merge 只补 `dbId`，保留客户端 id，避免虚拟列表在切换模式时因 remount 叠加剧烈错位。

---

## 7. 关键文件

| 文件 | 作用 |
|------|------|
| `frontend/src/components/chat/VirtualChatMessageList.tsx` | 双模式渲染、行高缓存、measure 时机 |
| `frontend/src/pages/ChatPage.tsx` | stickToBottom、save merge、传 props |
| `frontend/src/components/chat/ChatMessageRow.tsx` | 去掉重复 streaming 光标 |
| `frontend/src/components/knowledge/AnswerRenderer.tsx` | Markdown 流式渲染 + 光标 |
