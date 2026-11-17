# AGENTS.md — 前端开发约定

> **作用域**：`frontend/` 目录下所有代码。
> **阅读时机**：每次开始任务前读一遍；每次准备新增文件、改接口、改类型前再核对对应章节。
> **优先级**：用户当前指令 > 本文件 > `docs/` 下的设计文档。与现有代码冲突时先停下来问，不要自行"纠正"。

---

## 0. 开工前 60 秒检查

- [ ] 先读要改目录里已有的同类文件，沿用它的结构、命名和写法（不要凭印象另起一套）。
- [ ] 涉及接口/字段：先查 `src/types/api.ts`、对应的 `src/api/*.ts`，再查后端 `backend-java/src/main/java/com/workbench/backendjava/vo/`；查不到就问，**不要猜**。
- [ ] 明确本次最小改动范围；不做顺手的重构、格式化、重命名。
- [ ] 确认不需要新增依赖、全局状态、路由或公共 API。
- [ ] 完成后运行 `pnpm lint` 和 `pnpm build`，如实报告结果。

---

## 1. 技术栈与目录

| 项 | 约定 |
|----|------|
| 框架 | React 19 + TypeScript + Vite |
| UI | Ant Design 6（`antd`）+ `@ant-design/icons` |
| 路由 | `react-router-dom` 7 |
| 状态 | `zustand`（仅跨页面/全局状态） |
| 请求 | `axios`，统一走 `src/api/request.ts` |
| 样式 | CSS Modules + `src/styles/tokens.css` 设计变量 |
| 别名 | `@/` → `frontend/src/` |

```
src/
├── api/          # 按领域拆分的接口函数 + 该领域类型
├── components/   # 可复用组件，按业务域分子目录；Xxx.tsx + Xxx.module.css
├── pages/        # 路由页面，XxxPage.tsx + XxxPage.module.css
├── layouts/      # 页面骨架
├── hooks/        # useXxx.ts
├── stores/       # zustand：authStore / aiSessionStore
├── services/     # 跨组件业务流程（如 AI 流式执行）
├── utils/        # 无 React 依赖的纯函数
├── constants/    # 常量、localStorage key
├── types/        # 跨模块共享的后端返回类型
└── style-guide/  # 设计原型，禁止被业务代码 import
```

**包管理器只能用 pnpm**：`pnpm install` / `pnpm dev` / `pnpm lint` / `pnpm build`。不要用 npm/yarn，不要手改 `pnpm-lock.yaml`。

---

## 2. 三条核心原则

### 2.1 不过度设计（KISS / YAGNI）

- **只实现当前需求**。不写"以后可能会用"的参数、配置项、开关、兼容分支。
- **不新增依赖**。确实需要时先说明用途、体积、替代方案，等用户同意。
- **不为了抽象而抽象**。同一段逻辑出现 3 次以上再抽公共函数/组件；只有 1–2 处就直接写。
- **不从零造轮子**。先查 `src/components`、`src/hooks`、`src/utils` 和 antd 是否已有能力。
- **不预建**空文件、空目录、占位组件、 barrel 文件（`index.ts` 统一导出）。
- **不提前优化**。没有实测到性能问题，不加 memo、缓存、虚拟列表、防抖；已有虚拟列表/防抖 hook 直接复用，不重写（详见第 8 节）。
- **不扩大改动面**。不批量换引号/缩进/排序，不重命名现有导出，不迁移目录，不顺手升级依赖。
- **不引入新的架构层**（如 repository、adapter、DTO 转换层）。当前项目就是 `页面 → api 函数 → request`，保持简单。
- 新依赖、新全局 store、新路由、改 `request.ts` 拦截器、改公共工具行为——**先说明并征得同意**。

### 2.2 不猜后端字段

字段的唯一可信来源，按顺序查：

1. `src/types/api.ts`（跨模块共享的 VO）
2. `src/api/<domain>.ts` 里导出的类型（仅该模块使用的类型）
3. 后端 `backend-java/src/main/java/com/workbench/backendjava/vo/*.java`
4. 对应 Controller / DTO；仍不确定就问用户要接口文档或示例响应

硬性要求：

- **禁止臆造字段名**：`createdAt` vs `createTime`、`avatarUrl` vs `avatar`、`records` vs `list`、`page/size` vs `pageNum/pageSize`，都必须以实际代码为准。
- **禁止用类型逃逸掩盖未知**：不写 `any`、`as any`、`as unknown as X`、`// @ts-ignore`、`// @ts-expect-error` 来"先跑起来"。
- **禁止伪造后端没返回的数据**。缺字段时，要么去掉该 UI，要么向用户说明需要后端补字段，不要用假值/随机值/本地拼装糊过去。
- **不自定义后端枚举值**。`status`、`type`、`role` 等只能使用后端实际返回的字符串/数字。
- **不擅自加字段转换层**。后端 VO 字段名直接对应前端类型，不批量 camelCase/snake_case 互转；要改先确认。
- **接口参数同样不猜**：路径、HTTP 方法、query 参数名、分页结构、上传字段名（如 `file`）都照抄已有实现或后端代码。
- 复用已有类型，不重复定义同结构 interface。跨模块共享放 `types/api.ts`，单模块用放 `api/*.ts`。

### 2.3 可读性与简洁性

- **先读后写**：改动前看同目录已有实现，保持一致的顺手写法。
- **命名即注释**：变量/函数名说清意图，不用 `data1`、`temp`、`obj`、`flag`。
- **函数只做一件事**：超过约 50 行或嵌套超过 3 层就拆分；组件超过约 300 行或职责混杂就拆子组件。但**不要为拆而拆**。
- **早返回**：用 `if (...) return` 消掉 `else` 和深层嵌套；禁止嵌套三元。
- **注释写"为什么"**，中文；不复述代码（`// 设置 loading` 这类废话不要）。导出的 api 函数、hook、复杂分支写一句 JSDoc/块注释。
- **不留垃圾**：注释掉的代码、`console.log`、未使用 import/变量、TODO 占位、调试代码，提交前删掉（`tsconfig` 已开启 `noUnusedLocals` / `noUnusedParameters`）。
- **不复制粘贴**：实现前先搜索是否已有同名能力；重复代码超过两处再抽。
- **状态最小化**：能由已有 state/props 推导的就不要新增 state；不要用 effect 同步本可在渲染期计算的值。
- **类型明确**：props 用 `interface XxxProps`；事件参数、接口返回值尽量有类型；不用 `Function`、`object` 这种宽泛类型。
- **与所在文件风格保持一致**：现有文件存在 2 空格与 4 空格混用，跟随该文件即可，**不要整文件重排**。

---

## 3. 命名规范

| 对象 | 规则 | 示例 |
|------|------|------|
| 页面 | PascalCase + `Page` | `AssetListPage.tsx` |
| 组件 | PascalCase，一文件一个主组件 | `AssetGrid.tsx`、`CampaignPostCard.tsx` |
| Hook | `use` + PascalCase，默认导出 | `useDebouncedValue.ts` |
| 普通函数/变量 | camelCase | `formatFileSize`、`visibleSelectedRowKeys` |
| 布尔值 | `is/has/can/should` 开头 | `isLoading`、`hasMore` |
| 事件处理 | `handleXxx`；回调 prop 用 `onXxx` | `handleDeleteTag`、`onProgress` |
| 接口函数 | 动词 + 实体 + `Api` | `listAssetsApi`、`getAssetStatsApi`、`createTagApi`、`batchDeleteTagsApi` |
| API 文件 | camelCase | `adminFeedback.ts`、`knowledge.ts` |
| 类型 | 后端响应用 `XxxVO`；参数用 `XxxParams`；props 用 `XxxProps` | `AssetVO`、`ListAssetsParams`、`UploadAssetOptions` |
| store | `useXxxStore`，状态接口 `XxxState` | `useAiSessionStore` |
| 常量 | UPPER_SNAKE_CASE | `API_TIMEOUT_BATCH`、`GRID_PAGE_SIZE` |
| CSS Module 类 | camelCase；状态后缀 `_xxx` | `.navItem`、`.navItem_active` |
| localStorage key | 集中放 `src/constants/` | `CHAT_ACTIVE_CONVERSATION_KEY` |

要求：

- 不用无意义缩写；`api`、`url`、`id`、`img` 等通用词除外。
- 同一概念全项目只用一个词（不要 `asset`/`material`、`delete`/`remove` 混用）。
- 文件名与其默认导出一致。

---

## 4. API 层与错误处理

```ts
// src/api/tags.ts —— 新增接口照此模式
import request from '@/api/request'
import type { ApiResponse } from '@/types/api'

export async function getTagApi(id: number) {
  const res = await request.get<ApiResponse<TagVO>>(`/tags/${id}`)
  return res.data.data
}
```

- 必须使用 `@/api/request` 的 axios 实例（baseURL `/api`、自动带 token、统一解包/错误处理）。禁止页面里直接 `axios`/`fetch`；SSE 走 `src/api/sseTextStream.ts`，AI 流式流程走 `src/services/aiStreamRunner.ts`。
- 后端统一返回 `ApiResponse<T> = { code, message, data }`；`code !== 200` 已被拦截器转成 `ApiRequestError`。
- 有数据的接口 `return res.data.data`；`void` 接口直接 `await`，不要返回无意义的值。
- 超时不要写魔法数字，使用 `src/api/timeouts.ts` 中的常量。
- 页面 `catch` 统一用 `showApiError(err, '加载素材失败')`（来自 `@/utils/apiError`）：
  - 401 跳转、网络/超时/5xx 已由拦截器统一 toast，页面不要重复弹。
  - 不要每个 `catch` 都写 `message.error`，会重复提示。
- 不修改 `request.ts` 的全局行为来解决单个页面的问题；确需修改先说明影响面。
- 分页、上传进度、批量删除等写法，直接参考 `src/api/assets.ts`。

---

## 5. React / TypeScript

- 只写函数组件 + hooks，不写 class 组件。
- 遵循 hooks 规则与 `eslint-plugin-react-hooks`；**不要为了绕开 lint 加 `eslint-disable`**。
- `useEffect` 只用于与外部系统同步（请求、订阅、DOM、定时器）；用户操作放事件处理函数，可推导的数据在渲染期计算。
- 异步副作用必须处理清理：沿用现有的 `cancelled` 标志、`AbortController`、`clearTimeout` 模式，避免卸载后 setState / 竞态覆盖。
- 列表 `key` 用稳定 id，不用数组下标（除非列表静态且不重排）。
- import 类型一律 `import type { ... }`（`verbatimModuleSyntax` 已开启）。
- 不用 `any`；未知值用 `unknown` + 类型收窄。不用非空断言 `!` 掩盖可能为空的数据。
- 组件 props 就近定义 `interface XxxProps`；可选项用 `?`，默认值在解构参数里给。
- 表单、Modal、Table 等优先用 antd 官方 API，不手写重复交互。
- 尽量保持组件纯函数式：不在渲染期发请求、改 store、写 localStorage。

---

## 6. 样式

- 每个组件/页面用同目录 `.module.css`，类名 camelCase，禁止新增全局样式类。
- 颜色、间距、圆角、字体、阴影优先使用 `src/styles/tokens.css` 的 `var(--token)`。
- 禁止硬编码旧版 Indigo/紫渐变（`#4F46E5`、`#7C3AED` 等）；视觉规范见 `docs/frontend-ai-brief.md`。
- antd 主题统一由 `getWorkbenchTheme()` 提供，不散落自定义 ConfigProvider token。
- 内联 `style` 只允许放运行时计算值（如进度宽度、动态坐标）；布局/主题/间距不允许超过 3 行内联样式。
- `:global` 仅用于覆盖 antd 组件的最小必要样式，并写在对应 Module 内。
- **禁止**把 `src/style-guide/` 下的 `Preview*` 组件或 CSS 引入业务代码；原型只作视觉参考。

---

## 7. 状态与数据

- 页面局部数据用 `useState`/`useReducer`；只有跨页面共享或需要跨组件订阅时才放 zustand。
- 不把服务端列表再复制一份到全局 store，除非有明确跨页需求。
- 不在 store 里放组件实例、DOM、AbortController 之外的非序列化数据（现有 `abortControllers` 除外）。
- 防抖、滚动、上传、轮询、虚拟列表优先复用 `src/hooks/` 里已有的实现。
- localStorage 读写集中管理，key 放 `src/constants/`，不在业务代码里散写字符串。
- 不新增事件总线、全局单例、模块级可变缓存，除非任务明确要求。

---

## 8. 性能约定（先测量，再优化）

**默认不优化。** 只有出现可复现的问题（列表滚动卡顿、流式输出掉帧、首屏慢、请求风暴）才动手；优化前说明现象和判断依据，优化后用数据对比。禁止"感觉会慢"就加缓存或重构。

### 8.1 先复用已有能力

| 场景 | 已有实现 | 要求 |
|------|----------|------|
| 长列表 / 素材网格 | `VirtualAssetGrid`、`VirtualChatMessageList`（`@tanstack/react-virtual`） | 直接复用，不另写虚拟滚动 |
| 搜索输入 / 过滤 | `useDebouncedValue` | 输入触发请求或大列表过滤时使用 |
| 索引状态轮询 | `useKnowledgeIndexPolling` | 轮询必须有终止条件，不写常驻 `setInterval` |
| 流式输出 | `services/aiStreamRunner.ts` + `aiSessionStore` | 新模块沿用同一套，不另起 SSE 实现 |
| 长列表图片 | 原生 `loading="lazy"` | 图片必须懒加载 |
| 页面拆分 | `router/lazyPages.ts` | 重页面（编辑器/工作台）才 `lazy`，小页面不拆 |

### 8.2 高频更新（SSE / 输入 / 滚动）

- 流式 token 追加是最高频路径：`appendStreamText` 每次都会生成新的 `streams` 对象。**新增订阅时只取所需切片**（如 `useAiSessionStore((s) => s.streams[key])`），不要订阅整个 store 或整个 `streams`。
- 不在每个 chunk 上做全量 Markdown 解析、正则替换、大数组排序等昂贵计算；必须做时分片或缓存。
- 滚动/尺寸监听使用 `requestAnimationFrame`、`{ passive: true }`、`ResizeObserver`，沿用 `useStickToBottomScroll` 和现有虚拟列表的写法；不要监听 `scroll` 后直接高频 `setState`。

### 8.3 渲染与状态

- **不无脑加** `React.memo` / `useMemo` / `useCallback`：只在计算确实昂贵（大列表过滤/排序、复杂派生）或引用稳定能明显减少子组件重渲染时加，并保持依赖正确。
- `key` 用稳定 id；避免父级状态变化导致整棵子树反复卸载重挂。
- 状态放在最近的使用者，避免把高频变化的 state 提升到页面顶层导致整页重渲染。
- 列表分页加载，不一次性拉全量再在前端分页。

### 8.4 请求与包体积

- 请求可去重/取消：沿用 `cancelled` 标志、`AbortController`，避免快速切页时的竞态和重复请求。
- 不制造请求瀑布：互不依赖的请求用 `Promise.all` 并行。
- 不新增性能类依赖（lodash、监控 SDK、缓存库等）；需要时先说明收益和体积。
- 大库按需引入，不整包引入；不为理论性能提前加 Web Worker、缓存层或持久化。

### 8.5 测量与验证

- 先用浏览器 Performance 面板 / React DevTools Profiler 定位，再改；汇报时写清"改前/改后"的观察指标（滚动帧率、渲染次数、请求数等），不要只写"优化了性能"。
- 项目未配置性能监控和测试运行器，不要编造性能数据或声称跑过 benchmark。
- 性能优化不得牺牲正确性、可读性和类型安全：不用 `memo` 掩盖错误的 props 引用，不为指标删掉 loading/error 状态。

---

## 9. 改动边界

- **最小 diff**：只改与需求相关的文件；不顺手修无关代码、不调整无关格式。
- 修改被多处引用的函数/类型/组件前，先 `grep` 所有调用点，评估影响。
- 不随意改路由路径（如素材列表是 `/assets`，不是 `/asset`）、不改已有导出名。
- 不改后端或其他服务代码来完成纯前端需求；接口缺失时说明原因。
- 不提交 `dist/`、`node_modules/`、本地临时文件。
- 未经用户明确要求，不执行 `git commit` / `git push`。

---

## 10. 验证与汇报

- 改完必须运行：
  - `pnpm lint`
  - `pnpm build`（含 `tsc -b`，会检查未使用变量等类型问题）
- UI 改动建议 `pnpm dev` 自查；开发服务器 `http://localhost:5173`，`/api` 与 `/uploads` 代理到后端 `8080`。
- 项目当前**没有配置测试运行器**（`package.json` 中没有 vitest/jest）。不要声称"测试通过"，也不要擅自引入测试框架；如需补测试先和用户确认。
- 汇报时只讲事实：改了哪些文件、验证命令的真实结果、未验证/待确认的部分。构建或 lint 失败，原样贴出关键错误，不要说"应该没问题"。
- 不要为了通过构建而删类型、加 `any`、加 `eslint-disable`；优先修根因。

---

## 11. 常见反例

```tsx
// ❌ 猜字段 + 类型逃逸
const avatar = (user as any).avatar || (user as any).avatarUrl

// ✅ 先确认类型来源，字段不存在就问
import type { UserVO } from '@/types/api'
const avatar = user.avatarUrl
```

```tsx
// ❌ 为一个调用方造"通用"封装，参数越加越多
function useGenericRequest<T>(url: string, method: 'get' | 'post', ...options: unknown[]) { ... }

// ✅ 直接用已有 api 函数
const data = await listAssetsApi({ page, size })
```

```tsx
// ❌ 拦截器已提示过，页面再弹一次
try { await deleteAssetApi(id) } catch { message.error('删除失败') }

// ✅ 统一交给 showApiError，避免重复 toast
try { await deleteAssetApi(id) } catch (err) { showApiError(err, '删除失败') }
```

```tsx
// ❌ 过度防御 / 过度抽象：后端字段是必填，却造一堆默认值和转换层
const name = item?.assetName ?? item?.name ?? item?.fileName ?? ''

// ✅ 类型确定就直用；不确定就去核对接口
const name = item.name
```

---

## 12. 参考文档（按需查阅，不要全部复制进代码）

- `docs/frontend-ai-brief.md` — 设计方向、颜色 token、硬规则
- `docs/frontend-style-guide.md` — 样式与目录规范
- `docs/frontend-requirements.md` — 页面需求与验收
- `src/style-guide/README.md` — 设计原型说明
- `backend-java/src/main/java/com/workbench/backendjava/vo/` — 后端返回字段的最终依据

> 文档可能滞后于代码：**实现细节以现有代码和后端接口为准**，视觉规范以 design token 文档为准。发现文档与代码冲突时，先向用户指出，不要默默二选一。
