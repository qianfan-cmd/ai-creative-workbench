# AI 预估费用 — 计费规则与官方出处

> 更新日期：2026-09-04  
> 管理后台展示的是 **预估费用**（本地记录的用量 × 官方公开单价），**不是**各云厂商控制台的真实账单。

## 计算方式

```
预估费用 = API 响应中的用量（token / 张数）× 官方文档单价
```

各厂商均未在本项目中接入「账单查询 API」；DeepSeek Chat 的 token 来自流式响应 `usage` 字段，Embedding 来自 `/embeddings` 的 `usage.total_tokens`，生图按成功生成的图片张数计。

---

## 1. Chat — DeepSeek `deepseek-v4-flash`

| 计费项 | 空闲单价 | 高峰单价 | 单位 |
|--------|----------|----------|------|
| 输入（缓存未命中） | 1.5 | 3.0 | 元 / 百万 tokens |
| 输入（缓存命中） | 0.05 | 0.10 | 元 / 百万 tokens |
| 输出 | 4.5 | 9.0 | 元 / 百万 tokens |

- **官方文档**：[DeepSeek 模型与价格](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)
- **扣费公式**：`token 消耗量 × 模型单价`（同页「扣费规则」）
- **高峰时段**：北京时间周一至周五 9:00–12:00、14:00–18:00；其余为空闲
- **本项目公式**（展示区间，输入按缓存未命中计）：
  - `min = prompt_tokens × 1.5/1e6 + completion_tokens × 4.5/1e6`（空闲）
  - `max = prompt_tokens × 3.0/1e6 + completion_tokens × 9.0/1e6`（高峰）

---

## 2. Embedding — 阿里云百炼 `text-embedding-v2`

| 计费项 | 单价 | 单位 |
|--------|------|------|
| 文本输入 | 0.7 | 元 / 百万 tokens |

- **官方文档**：[text-embedding-v2 模型价格](https://help.aliyun.com/zh/model-studio/text-embedding-v2)（华北2 北京）
- **本项目公式**：`total_tokens × 0.7 / 1,000,000`

---

## 3. 生图 — 通义万相 `wan2.7-image-pro`

| 计费项 | 单价 | 单位 |
|--------|------|------|
| 图片生成 | **0.5** | 元 / 张 | 华北2（北京） |

- **官方文档**：[wan2.7-image-pro 模型价格](https://help.aliyun.com/zh/model-studio/wan2-7-image-pro)（与你提供的链接同一页面）
- **计费说明**：按成功生成的图片张数计费；新加坡地域为 0.562065 元/张（本项目默认按华北2）
- **控制台入口**：[百炼模型文档](https://bailian.console.aliyun.com/cn-beijing?tab=doc#/doc/?type=model&url=2840914)
- **本项目公式**：`0.5 × 成功生成张数`
- **配置注意**：`application.yml` 中模型键须写为 `"[wan2.7-image-pro]"`（含引号），否则 Spring 会把 `.` 解析成嵌套路径，导致定价加载失败、后台误显示「暂未配置」

---

## 4. 生图 — 火山 Seedream `doubao-seedream-5-0-260128`

| 计费项 | 单价 | 单位 |
|--------|------|------|
| 文生图 / 图生图（Seedream 5.0） | 0.22 | 元 / 张 |

- **官方文档**：[火山方舟 · 模型价格](https://docs.volcengine.com/docs/82379/1544106?lang=zh)
- **计费总说明**：[模型服务计费说明](https://docs.volcengine.com/docs/82379/1544681?lang=zh)
- **本项目公式**：`0.22 × 成功生成张数`

> 若改用 `doubao-seedream-5-0-pro`，Pro 为输入 0.02 元/张 + 输出 0.30 元/张，见 [AI Hub 模型页](https://ai.volcengine.com/model)。

---

## 5. 视觉识别 — 阿里云百炼 `qwen-vl-max`

| 计费项 | 单价 | 单位 |
|--------|------|------|
| 输入 | 1.6 | 元 / 百万 tokens |
| 输出 | 4.0 | 元 / 百万 tokens |

- **官方文档**：[qwen-vl-max 模型价格](https://help.aliyun.com/zh/model-studio/qwen-vl-max)（华北2 北京）
- **本项目公式**：`prompt_tokens × 1.6/1e6 + completion_tokens × 4.0/1e6`
- **用途**：抠图工作流「元素识别」（`matting_detect`），只看图输出文字，不生图

---

## 模型 ↔ 业务场景 ↔ 阿里/火山控制台对照

| 定价键 / Model Code | 业务场景（scene） | 能力 | 阿里/火山控制台 |
|---------------------|-------------------|------|-----------------|
| `deepseek-v4-flash` | `chat`、`copy` | 对话 / 文案 | DeepSeek 控制台 |
| `text-embedding-v2` | `embedding` | 知识库向量化 | 百炼 Embedding |
| `doubao-seedream-5-0-260128` | `image_gen`、`matting`、`matting_extract`、`matting_single` | 生图（主路径） | 火山方舟 Seedream |
| `wan2.7-image-pro` | 同上（Seedream 额度不足时） | 生图（兜底） | 百炼「万相」；控制台可能显示 `wanx2.1-image-pro` 等聚合名 |
| `qwen-vl-max` | `matting_detect` | 元素识别（视觉，不生图） | 百炼 `qwen-vl-max`，无「图片生成张数」列 |

**抠图三步说明：**

1. **元素识别**（`matting_detect`）→ `qwen-vl-max`，列出元素名称  
2. **分组提取**（`matting_extract`）→ Seedream / 万相，生成整组元素图  
3. **单元素提取**（`matting_single`）→ Seedream / 万相，生成单个透明元素图  

---

## 配置位置

单价与出处链接配置在 [`backend-java/src/main/resources/application.yml`](../backend-java/src/main/resources/application.yml) 的 `app.ai-pricing` 段，由 [`UsageCostCalculator`](../backend-java/src/main/java/com/workbench/backendjava/service/UsageCostCalculator.java) 读取并计算。
