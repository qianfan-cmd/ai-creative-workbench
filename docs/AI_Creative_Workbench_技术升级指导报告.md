# AI Creative Workbench 技术升级指导报告

**副标题：面向前端 / 全栈实习求职的工程化改造、差异化创新与实施路线**  
**版本：1.0｜日期：2026 年 10 月 9 日｜适用对象：个人开发者 / 校招实习项目**

> 核心建议：不要继续堆“又接入一个模型、又加一个聊天页面”的功能。先修复可验证的多用户数据隔离风险，再把现有 RAG 做成可复现的质量评测系统，并补齐跨 Java / Python / LLM 的可观测性和可恢复的异步索引。这样可以让项目从“功能完整的 AI Demo”升级为“能证明质量、安全、成本与可靠性的 AI 工程系统”。

## 本报告怎么使用

这份报告以公开仓库 `qianfan-cmd/ai-creative-workbench` 的 README、架构文档和可访问的关键源码为依据，目标不是要求一次性重写，而是给出可拆成 Issue / Pull Request 的小步计划。仓库已有的功能会明确标注为“已有基础”；没有在本次审阅中完整确认的实现会写成“需要进一步验证”，不将建议中的功能描述为已经完成。

建议实施顺序：**P0 数据安全 → P1 RAG 评测实验室 → P2 可观测与成本 → P3 异步索引可靠性 → 可选的创作资产溯源**。前四项构成主线；最后一项是贴合产品特点的加分方向。

### 快速导航

- **现状与优先级：** 第一至第三节。
- **核心技术方案：** 第四至第八节，包含数据隔离、RAG 评测、AI 可观测、异步索引和创作溯源。
- **工程验收：** 第九至第十一节，包含测试门禁、六周计划和量化验收标准。
- **求职表达与执行：** 第十二至第十四节，包含面试讲法、AI 编码助手协作模板与交付清单。
- **核对依据：** 第十五节列出源码与行业参考链接。

## 一、执行摘要

### 1.1 项目当前已经有什么

仓库已经不是只有登录页和一个对话框的初级项目。README 与架构文档表明，当前包括：

- React + TypeScript 前端、Spring Boot Java 业务后端、FastAPI Python AI 服务、MySQL 业务数据库、Chroma 向量库和 Docker Compose 部署。
- 知识库文档上传、解析、分块、Embedding、引用回答、Markdown 文档编辑和索引更新。
- Dense 向量、BM25 关键词、标签召回、多 Query RRF、阈值过滤、Reranker 和上下文选择等检索环节。
- Chat / RAG / Campaign 的流式响应；素材库、活动文案、抠图工作台；AI 调用用量和管理员侧统计。
- GitHub Actions 构建与部署工作流，以及 Redis / RabbitMQ 的可选 Compose Profile。

因此，**不要把“使用 RAG、SSE、Redis、Docker、接入多个模型”本身当成创新点**。这些更适合作为技术基础；真正的差异化来自你如何验证它们工作得更好、更安全、更稳定。

### 1.2 当前最值得优先处理的工程问题

静态审阅 `ai-service-python/app/services/vector_store.py` 与 `indexing_pipeline.py` 后，有几项应优先验证 / 修复的问题：

1. **共享向量集合没有在检索路径上强制用户过滤。** 集合名称为 `knowledge_chunks`；`search_similar()` 查询时未传入 `where` 过滤；`list_all_chunks()` 会读取全量语料；标签召回和 BM25 依赖这类全量数据。代码注释也明确写出当前 collection 是全局共享、未按 `user_id` 隔离。索引写入 `user_id` 元数据，不等于检索已经隔离。
2. **文件名被当成索引身份的一部分。** Chunk ID 采用 `filename-index`，入库前通过 `delete_by_source(filename)` 清旧向量。不同用户上传同名文件时，可能产生 ID 冲突或误删；文件名应该是显示属性，不应当是全局唯一身份。
3. **重建索引先删旧数据，再调用 Embedding。** 这意味着在旧索引删除后，如果 Embedding / 写入失败，可能暂时或持续丢失可用的旧索引。需要引入版本化构建和原子切换。
4. **需要把配置安全边界写清楚。** 当前开发 Compose 文件存在固定的 MySQL 初始化密码并把数据库端口映射到宿主机；即便只用于本机，也应在生产覆盖配置中明确禁用或限制端口、使用独立强密码，并让文档与配置保持一致。
5. **有反馈和用量统计，但还需要可重复的质量回归机制。** 点赞 / 点踩和 Token 汇总很有用，但无法单独回答“检索策略改完后是否确实更准”。需要固定题集、指标、实验配置和历史结果。
6. **耗时索引需要可靠的任务生命周期。** Python 的索引流水线是一条串行处理链。产品层应当具备任务 ID、阶段进度、失败原因、重试和幂等语义，避免把长任务完全绑定在上传 HTTP 请求上。

上述第 1、2 项是安全边界问题，建议在公开演示、邀请他人注册或积累真实用户文档前优先修复。它们并不证明已经发生过数据泄露；但足以构成需要通过测试关闭的风险。

### 1.3 推荐项目定位

建议把项目升级后的主打定位定为：

> **面向团队知识与创意资产的 AI Workbench：拥有租户/用户级数据隔离、可复现 RAG 评测、端到端 AI 可观测、可靠索引任务与生成内容溯源能力。**

这个定位比“一个 AI 知识库”更有工程深度，也比“Agent + MCP + 向量库大杂烩”更容易解释业务价值。

## 二、现状盘点：保留什么、补什么、不做什么

- **React / TS 前端、Java / Python 后端分工**
  - 当前状态（基于仓库材料）：已有
  - 下一步建议：保留边界，避免无必要地重写
- **文档解析、分块、Embedding、Chroma**
  - 当前状态（基于仓库材料）：已有
  - 下一步建议：补身份隔离、版本化索引、任务可靠性
- **Dense + BM25 + Tag + RRF + Reranker**
  - 当前状态（基于仓库材料）：已有源码路径
  - 下一步建议：做离线对照实验，不要把重复实现当创新
- **Chat / RAG / Campaign 流式输出**
  - 当前状态（基于仓库材料）：已有
  - 下一步建议：补请求关联 ID、异常观测和断线恢复策略
- **点赞 / 点踩、Admin 用量统计**
  - 当前状态（基于仓库材料）：README 已说明
  - 下一步建议：继续使用为反馈信号；与客观评测集分开
- **Docker Compose / GitHub Actions**
  - 当前状态（基于仓库材料）：已有
  - 下一步建议：把测试、依赖扫描、回归门禁纳入现有流水线
- **Redis / RabbitMQ**
  - 当前状态（基于仓库材料）：Compose 可选服务
  - 下一步建议：先明确实际调用点；只有确实需要时再接入业务
- **RAG 评测题集与版本对照报告**
  - 当前状态（基于仓库材料）：本次查阅的公开文档未看到完整闭环
  - 下一步建议：作为首个差异化功能实现
- **跨 Java / Python / LLM 的统一 Trace**
  - 当前状态（基于仓库材料）：现有材料不足以确认已有完整链路
  - 下一步建议：增加 trace_id、阶段耗时与模型用量记录
- **用户 / 租户维度向量检索隔离**
  - 当前状态（基于仓库材料）：当前向量存储代码存在明显缺口
  - 下一步建议：P0，优先完成并写安全回归测试
- **内容生成来源 / 版本 / 素材关系图**
  - 当前状态（基于仓库材料）：可作为新增产品能力
  - 下一步建议：主线稳定后再做，避免早期范围过大


### 不建议现在做的事

- 不为“技术栈好看”而将现有系统改造成大量微服务；当前服务边界已经足以展示完整链路。
- 不把 Agent / MCP 当作主线。仓库架构文档明确把它们留作后续阶段；在可靠性、权限、评测没有打牢前增加自主工具调用，会扩大安全与调试范围。
- 不宣称“准确率提升 30%”“成本降低 50%”等没有实测支撑的结果。先建立基线，再报告真实数据。
- 不一次性让代码生成工具跨前端、Java、Python、Compose 大规模重构。每个阶段用小 PR、测试和回滚点控制风险。

## 三、优先级与投入产出

- **P0**
  - 项目：用户/租户数据隔离、稳定 ID、原子重建
  - 预估投入：1–1.5 周
  - 工程收益：极高
  - 求职展示价值：高：安全、数据建模、测试
  - 交付标准：跨用户检索与删除测试通过；失败重建不丢旧索引
- **P1**
  - 项目：RAG Quality Lab：数据集、指标、配置版本、报告
  - 预估投入：1.5–2 周
  - 工程收益：极高
  - 求职展示价值：极高：AI 工程、实验设计、检索算法
  - 交付标准：可一条命令重跑固定评测，并比较两套配置
- **P2**
  - 项目：Trace、耗时分解、模型 Token / 成本、错误归因
  - 预估投入：1 周
  - 工程收益：高
  - 求职展示价值：高：跨服务排障、可观测
  - 交付标准：一个请求可关联 Java / Python / LLM 阶段和指标
- **P3**
  - 项目：文档索引异步任务、幂等、重试、死信 / 恢复
  - 预估投入：1–1.5 周
  - 工程收益：高
  - 求职展示价值：高：消息队列、分布式一致性
  - 交付标准：上传快速返回任务 ID，任务可重试且不重复写脏数据
- **P4（可选）**
  - 项目：生成内容与资产的血缘 / 版本追溯
  - 预估投入：1–2 周
  - 工程收益：中高
  - 求职展示价值：高：产品化创新
  - 交付标准：可从活动成稿追溯模型、Prompt 版本、源素材和修改版本
- **收尾**
  - 项目：CI、演示数据、文档、压测、简历叙事
  - 预估投入：0.5–1 周
  - 工程收益：高
  - 求职展示价值：极高
  - 交付标准：新人可复现；测量结果可信；演示不依赖偶然状态


估算适合个人开发者分阶段执行；若 Java、RabbitMQ 或 RAG 相关概念还不熟悉，应预留更多学习与调试时间。优先交付 P0 + P1，比同时开启五条主线更好。

## 四、P0：先把用户与知识数据隔离做正确

### 4.1 问题具体在哪里

当前 `vector_store.py` 里：

- `COLLECTION_NAME = "knowledge_chunks"` 是共享集合。
- `search_similar()` 只提供 query embedding、top-k 和返回字段，没有按用户 / 租户过滤。
- `list_all_chunks()` 取出全量 Chroma 语料；BM25 和标签检索的基础数据来自它。
- `list_documents()` 通过全量 metadata 聚合文档，并在注释中明确写出未按 user_id 隔离。
- `delete_by_source(source)` 按文件名删除全部匹配 Chunk。

`indexing_pipeline.py` 会在元数据存在时写入 `document_id` 和 `user_id`，但 ID 仍是 `f"{filename}-{i}"`，并且在生成 Embedding 之前就调用 `delete_by_source(filename)`。因此安全修复必须覆盖 Dense、BM25、Tag、列表、删除和重建所有路径，不能只给 Chroma 的向量查询加一个过滤条件。

### 4.2 目标数据模型

为每个 Chunk 保存可用来做授权过滤的可信元数据：

```text
chunk_id          = "doc:{document_id}:ver:{index_version}:chunk:{chunk_index}"
tenant_id         = 从可信登录上下文 / 后端授权上下文得出
owner_user_id     = 上传文档的用户 ID
document_id       = 数据库中稳定的文档主键
index_version     = 当前文档索引版本
chunk_index       = 当前版本内的块序号
source_name       = 仅供展示的文件名
```

不要用文件名作为身份；同名文件可以存在。若目前产品只有个人空间，先把 `owner_user_id` 的全链路授权做正确；若以后支持团队空间，再增加 `tenant_id` / ACL，避免现在为了未来需求做过度设计。

### 4.3 检索作用域必须从可信后端传入

建议引入统一的检索作用域对象（字段可根据当前业务模型调整）：

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class RetrievalScope:
    user_id: int
    tenant_id: str | None = None
    allowed_document_ids: tuple[int, ...] = ()
```

关键原则：`user_id` 不应直接信任浏览器传来的普通请求字段。应由 Java 从已通过鉴权的用户上下文中取得，并通过受保护的内部服务请求传给 Python；Python 侧也应验证调用来自可信服务。不要让一个用户通过修改请求 JSON 就切换到另一个用户的范围。

向量检索伪代码：

```python
def search_similar(query_embedding, scope, top_k=5):
    collection = get_collection()
    where = {"user_id": scope.user_id}
    # 如果启用团队空间，必须同时施加 tenant / ACL 规则。
    return collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        where=where,
        include=["documents", "metadatas", "distances"],
    )
```

这是设计示意，需按项目安装的 Chroma 版本和实际 ACL 规则完善 `where` 表达式。尤其要确保空的 `allowed_document_ids` 不会被错误解释为“不过滤、返回所有文档”。

### 4.4 所有检索通道都要带同一个 scope

- **Dense / Chroma**
  - 必须改动：查询时带上可信 user / tenant / 文档 ACL 过滤条件
- **BM25**
  - 必须改动：只从当前用户授权范围构建语料与检索；不能用全局 `list_all_chunks()` 结果给所有用户查询
- **Tag 召回**
  - 必须改动：标签词表、候选 Chunk 和排名都必须在当前授权范围内计算
- **RRF 融合**
  - 必须改动：只允许融合已通过同一授权过滤的候选，不允许某一路召回绕过权限
- **Reranker / context selector**
  - 必须改动：只能处理授权候选；最终证据组装前再进行一次权限断言
- **文档列表 / Chunk 预览**
  - 必须改动：按文档归属过滤；不能按全库文件名聚合后返回
- **删除 / 重建**
  - 必须改动：按 `document_id` + 授权主体删除，不能只按 filename 删除
- **BM25 缓存**
  - 必须改动：缓存键包含 user/tenant scope 和语料版本，避免用户之间共享错误的结果或缓存


如果团队空间需要共享文档，权限判定最好抽象成 `authorized_document_ids` 或独立 ACL 服务；不要简单地将 `user_id` 过滤替换成“忽略 user_id”。

### 4.5 原子化索引更新：先构建，再切换

当前顺序是“删旧向量 → Embedding → 写新向量”。建议变成：

1. 在 MySQL 创建一个新的 `index_version`，状态为 `BUILDING`。
2. 解析文档、分块、Embedding，将 Chunk 写入这个新的版本空间。
3. 验证 Chunk 数量、Embedding 数量和元数据完整性。
4. 全部成功后，在 MySQL 事务里将该版本设为 `ACTIVE`，旧版本设为 `RETIRED`。
5. 异步清理旧版本；若构建失败，标记失败并保留当前 `ACTIVE` 版本。

这解决的是“重建过程不能让用户看到半套数据或丢失旧数据”的问题。Chroma 和 MySQL 之间通常没有统一的跨库原子事务，因此使用**版本化 + 状态机 + 补偿清理**比假设两边能一起回滚更合理。

### 4.6 P0 必须通过的自动化测试

- 用户 A 上传 `产品方案.pdf`，用户 B 上传同名文件：两边 Chunk ID 不冲突，内容不覆盖。
- A 的检索问句不返回 B 的专属内容；Dense、BM25、Tag 三路均验证。
- A 猜测 B 的 `document_id` 进行预览、更新、删除，必须拒绝或返回统一的资源不存在结果。
- 删除 A 的文档不改变 B 的同名文档或向量数量。
- 在 Embedding 阶段模拟超时 / 异常：旧 ACTIVE 索引仍可检索，新版本标记失败。
- 伪造浏览器请求体里的 `user_id` 不能改变授权范围。
- 最终 references 中的文档也要通过授权校验，不能只对正文检索做过滤。

## 五、P1：建设 RAG Quality Lab（最推荐的差异化创新）

### 5.1 为什么它比“增加一个 AI 功能”更有价值

当前系统已有较复杂的检索组件，但“代码实现了多路检索”不等于“能证明多路检索比基线更好”。如果没有固定的数据集与可重复指标，很容易陷入凭少量手动问题调参的问题。

RAG Quality Lab 的目标是：

- 固定一组可审阅的测试问题和标准证据。
- 对比 Dense-only、BM25-only、当前 Hybrid、Hybrid + Reranker 等配置。
- 输出检索与回答指标、耗时、Token / 费用估算及失败案例。
- 保存配置版本和代码版本，避免隔周重跑得到无法解释的结果。
- 将评测变成 CI 或合并前的回归门禁，而不是开发者每次手动试几个问题。

Ragas 文档列出的常见 RAG 指标包括 Context Precision、Context Recall、Response Relevancy 和 Faithfulness 等，可作为后续生成质量评估的参考；首期应先做可确定、无需额外 LLM 判分的检索指标，避免评测本身昂贵且不稳定。[R7]

### 5.2 最小可用的数据集

先从 **50 条人工核验问题**起步，覆盖：事实查找、跨段综合、术语问题、步骤 / 流程、歧义问题、知识库无答案问题、容易召回相似但错误段落的问题。后续扩大到 100–200 条，并固定版本。

建议 JSONL 结构：

```json
{
  "case_id": "redis-001",
  "question": "缓存未命中时，系统应该如何处理？",
  "answerable": true,
  "relevant_document_ids": ["doc-42"],
  "relevant_chunk_ids": ["doc:42:ver:3:chunk:2"],
  "expected_facts": ["查询 MySQL", "按需要回填缓存"],
  "expected_citation_sources": ["doc-42"],
  "category": "procedure",
  "difficulty": "medium"
}
```

示例只用于说明字段，不是仓库的真实问答数据。注意：Chunk 位置可能随重切分变化，所以应在数据集中保存数据版本；若更换分块策略，要重新核验 gold Chunk 或改用可复核的文档 ID / 文本锚点标注。

数据集至少要有：问题、是否可回答、相关证据标注、类别、难度和数据集版本。`expected_facts` 用于人工或 LLM 判分，不要把一条由模型生成的答案直接当成绝对正确的标准答案。

### 5.3 分层指标

**第一层：检索质量（首期必须有，适合确定性计算）**

- Recall@K：标注为相关的证据中，有多少被检索出来。
- Precision@K：返回的 K 个候选中，有多少是相关证据。
- MRR：第一个相关证据排名越靠前，分数越高。
- nDCG@K：同时考虑多个相关证据与它们的排序位置。
- Empty-hit / Wrong-source rate：没有命中，或主要命中错误文档的案例占比。

**第二层：引用质量**

- Citation Presence：可回答的答案是否包含引用。
- Citation Hit Rate：被引用的源文档是否属于标注的相关来源。
- Citation Precision：引用是否真的支撑相邻回答内容，需要通过规则、人工审阅或 LLM Judge 校验，不能只统计“有没有角标”。

**第三层：回答质量（第二阶段引入）**

- Faithfulness / Groundedness：答案中的事实是否能从提供的证据中得到支持。
- Answer Relevancy：回答是否解决了原问题。
- Correctness / Key Fact Coverage：是否覆盖人工标注的关键事实。
- Abstention Quality：知识库无答案时，系统是否适当拒答或说明证据不足。

**第四层：工程指标**

- P50 / P95 总耗时、首 Token 时间（TTFT）、检索与 Rerank 各阶段耗时。
- 输入 / 输出 Token、模型调用次数、失败率、重试次数和估算费用。

RAGAS 之类的 LLM-as-a-judge 指标可能需要额外模型调用，且评估器本身也会有偏差。报告应把“确定性指标”“LLM 自动评估”“人工抽检”分开显示，避免用单一总分掩盖问题。[R7]

### 5.4 实验设计：一次只验证一个假设

第一轮建议用相同题集、相同模型配置，做以下基线：

- **E0**
  - 检索配置：Dense-only
  - 要回答的问题：当前向量检索的基础表现是什么？
- **E1**
  - 检索配置：BM25-only
  - 要回答的问题：关键词检索对术语、编号、专有名词有什么帮助？
- **E2**
  - 检索配置：Dense + BM25 + RRF
  - 要回答的问题：混合召回是否提高 Recall@K / MRR？
- **E3**
  - 检索配置：E2 + Tag
  - 要回答的问题：标签定向召回是否带来增益，还是带来噪声？
- **E4**
  - 检索配置：E3 + Reranker
  - 要回答的问题：Reranker 是否提升前几条证据的精度，代价是多少？
- **E5**
  - 检索配置：仅调整 Top-K / 阈值
  - 要回答的问题：质量与延迟、上下文噪声的权衡如何？


不要一次同时改 Chunk 长度、Embedding 模型、Query Rewrite、RRF 权重、Top-K 和 Reranker，然后只看最终总分。那样无法知道究竟哪个改动产生效果。

### 5.5 目录与执行方式

推荐先把离线评测放在 Python AI 服务工程内，不要一开始就增加线上接口或生产数据库表：

```text
ai-service-python/
  evals/
    datasets/
      rag_smoke_v1.jsonl
      rag_quality_v1.jsonl
    configs/
      dense_baseline.yaml
      hybrid_current.yaml
      hybrid_rerank.yaml
    metrics/
      retrieval_metrics.py
      citation_metrics.py
    run_eval.py
    report.py
  eval-results/                 # 结果可归档到 CI artifact；不要提交敏感原文
```

建议命令：

```bash
# 不调用真实模型 API 的基础单元测试
pytest -q

# 在配置了安全测试环境后运行检索评测
python -m evals.run_eval --dataset evals/datasets/rag_smoke_v1.jsonl \
  --config evals/configs/hybrid_current.yaml --output eval-results/run-001.json

# 只有显式传入 live / provider 配置时才执行真实 LLM Judge
python -m evals.run_eval --dataset evals/datasets/rag_quality_v1.jsonl \
  --config evals/configs/hybrid_rerank.yaml --live --output eval-results/run-002.json
```

命令为建议接口，落地时可以按项目包路径调整。默认路径要可离线运行；真实模型评测应显式开启，防止 CI 不小心消耗 API 额度。

### 5.6 实验报告应记录哪些信息

每次 `run` 至少记录：

- `run_id`、时间、Git commit SHA、dataset version。
- Retrieval config version、Prompt version、Embedding 模型版本、LLM 模型名与参数。
- K 值、候选数量、阈值、RRF 权重、Reranker 是否启用。
- 各项指标、耗时、Token、估算费用、失败样本 ID。
- 对最差案例的展示：问题、相关证据、实际召回、最终引用、回答、失败分类。

报告应该让读者能回答：“为什么 E4 比 E2 好 / 差？哪些问题获得改善？哪些问题退化？多花了多少时间与成本？”

### 5.7 前端产品化顺序

优先做 CLI 与 JSON / Markdown 报告；验证稳定后再做管理员侧的 Evaluation 页面：

1. 选择 Dataset 版本与 Retrieval Config。
2. 启动一次评测并显示运行状态。
3. 显示指标对比与最差案例。
4. 点进案例，查看检索各路候选、RRF 得分、Rerank 得分、最终引用和答案。
5. 将通过的配置标记为 `candidate`，通过人工 review / CI 门禁后才建议成为默认配置。

为了最小化风险，首期可以不支持在线修改生产检索参数，只读展示离线实验结果即可。

## 六、P2：AI 全链路可观测与成本治理

### 6.1 从“显示 Token”升级到“能定位为什么慢、贵、错”

项目已经有 AI 调用用量日志与管理员统计的产品基础。下一步要把一次用户请求跨越的多个服务关联起来，而不是只记录一次模型调用的总耗时。

一次 RAG 请求至少要能分解成：

```text
browser request
  └─ Java API / authorization
      ├─ load conversation / DB
      └─ Python RAG request
          ├─ query tag inference
          ├─ query rewrite
          ├─ embedding
          ├─ dense retrieval
          ├─ BM25 retrieval
          ├─ tag retrieval
          ├─ RRF / filtering
          ├─ reranker
          ├─ prompt assembly
          └─ LLM streaming
      └─ persist answer / usage
```

这张链路图中的阶段应在真实执行时生成 trace/span 记录，某些阶段如果没有执行（例如关闭 Reranker）就不要伪造耗时。

### 6.2 最小化落地方案

**第一步：关联请求。** Java 接收请求时创建或验证 `trace_id` / `request_id`，转发给 Python。Python 的日志与 AI 调用记录必须带同一个 ID。不要允许用户传入的任意 ID 冒充内部追踪上下文而影响安全审计。

**第二步：结构化日志。** 至少包含 `trace_id`、`user_id`（日志中可用内部 ID）、`workflow`、`stage`、`duration_ms`、`status`、`error_code`。默认不要把完整 Prompt、用户上传文档、JWT 或 API Key 写入日志。

**第三步：关键指标。** 首期至少记录：

- 请求总耗时与 TTFT（流式首 Token 时间）。
- 每阶段耗时；RAG 的候选数、最终 Chunk 数、是否无命中。
- Model / Embedding / Reranker 调用次数、输入输出 Token、重试次数、错误类型。
- 费用估算、按场景 / 模型 / 时间的汇总。

**第四步：标准化。** 有了基础关联后，再接 OpenTelemetry SDK / Collector，以及 Jaeger 或 Grafana Tempo 等 Trace 后端；Prometheus / Grafana 可以负责聚合指标与告警。OpenTelemetry 在 GenAI 可观测方面正在标准化模型调用、Token 用量与耗时等语义；实施时应核对所用 SDK 的支持状态与隐私配置。[R8]

### 6.3 可扩展的 AI 调用日志字段

当前如已存在 `ai_call_log`，尽量用向后兼容的数据库迁移增加字段，不要随意重建表：

```text
trace_id              VARCHAR(...)
workflow              VARCHAR(...)       -- chat / rag / campaign / image
stage                  VARCHAR(...)       -- retrieval / rerank / generation...
provider               VARCHAR(...)
model_name             VARCHAR(...)
prompt_version         VARCHAR(...)
embedding_model        VARCHAR(...)
input_tokens            BIGINT
output_tokens           BIGINT
ttft_ms                 BIGINT
latency_ms              BIGINT
retry_count             INT
retrieved_chunk_count  INT
estimated_cost          DECIMAL(...)
status                  VARCHAR(...)
error_code              VARCHAR(...)
created_at              TIMESTAMP
```

不要记录模型原始思维链或不必要的完整敏感输入。若要保存 prompt / completion 用于诊断，必须采取脱敏、采样、访问控制、保留期限和显式开关；默认只保存元数据和安全摘要。

### 6.4 成本不是随便乘一个数字

从模型供应商取得的价格、输入输出 Token 价格、缓存 Token 价格和生效时间应配置化并带版本。系统中显示的 `estimated_cost` 必须标注为“估算”，除非已与供应商实际账单核对。费用计算应根据 `provider + model + token_type + effective_date` 选择价格表，不能把价格硬编码到页面组件里。

### 6.5 建议的告警规则

初期先做阈值告警而非复杂异常检测：

- 某模型连续失败达到阈值：标记 provider degraded，返回可理解的错误并允许重试。
- 某场景 P95 延迟相比近 7 天基线明显上升：从 Trace 定位到检索、Reranker 或 LLM 阶段。
- 单用户 / 单时间窗口 Token 过量：限流或要求确认。
- RAG 无命中率、引用缺失率突然增加：提示可能是索引失败、检索参数变更或模型变更。

## 七、P3：将文档索引升级为可恢复的异步任务

### 7.1 为什么需要任务化

文档索引需要解析文件、语义切分、打标签、请求 Embedding、写向量索引。它比普通的“上传一个文件并保存一条记录”耗时更长，也容易受到外部模型限流、网络超时、PDF 解析错误等问题影响。

上传接口应尽快确认“文件已接收，索引任务已创建”，之后独立完成索引。不要让浏览器连接是否保持打开，决定索引任务是否能继续。

### 7.2 推荐任务架构

```text
React 上传
   ↓
Java 校验用户 / 文件 / 配额
   ↓
持久化原始文件 + MySQL 文档记录 + index_job / outbox 记录
   ↓
RabbitMQ durable queue
   ↓
Python worker 消费任务（按并发限制执行）
   ↓
解析 → 切分 → 打标 → Embedding → staging index
   ↓
校验结果 → 激活新 index_version
   ↓
MySQL 更新 job 状态与文档状态
   ↓
前端通过轮询或 SSE 获取进度
```

仓库当前已经在 Compose 中提供可选 RabbitMQ，因此可以先将其用于有持久化需求的文档索引工作队列。Redis 可留给限流、短期状态缓存或热点结果等用途；不要为了“用了 Redis”而把相同任务重复实现两套队列。

### 7.3 Job 状态机

```text
QUEUED → RUNNING → SUCCEEDED
             ├──→ RETRY_WAIT → RUNNING
             └──→ FAILED（超过重试 / 不可恢复错误）
```

建议任务记录字段：

```text
job_id, document_id, owner_user_id, file_sha256,
index_config_version, status, stage, progress,
attempt_count, max_attempts, last_error_code,
created_at, started_at, updated_at, finished_at
```

提供的进度如 `PARSE / CHUNK / EMBED / PERSIST / ACTIVATE` 应表示真实阶段，而不是随时间线性增长的假进度。

### 7.4 重复投递与幂等

消息队列一般不能让开发者简单假定每条消息只会被消费一次。因此，消费者需要幂等：

- 用 `document_id + file_sha256 + index_config_version` 形成任务去重键。
- 状态从 `QUEUED` 到 `RUNNING` 的更新必须具备并发保护。
- 写入向量用确定的 `document_id + index_version + chunk_index` 作为 ID；重复消息写入同版本时应使用明确的 upsert / 覆盖策略。
- 只有在新版本完整可用后才激活；失败不影响旧版本。
- 对暂时性错误采用指数退避与抖动；超过上限进入失败队列或 DLQ，保留错误摘要供管理员处理。
- ACK 只能在任务状态和可恢复结果已被可靠记录后执行。需要更强的 DB + MQ 一致性时，使用 Transactional Outbox，而不是在数据库提交前直接发消息后假设两边天然原子。

### 7.5 API 设计建议

初版可以在现有接口上增加任务语义，避免随意另造第二套上传流程：

- `POST /api/knowledge/documents/upload`：返回 `documentId` 与 `indexJobId`，不等待完整向量入库。
- `GET /api/knowledge/index-jobs/{jobId}`：返回状态、进度、失败原因摘要。
- `POST /api/knowledge/index-jobs/{jobId}/retry`：仅管理员或有权限的文档所有者可触发。
- `POST /api/knowledge/documents/{id}/reindex`：按当前或指定索引配置创建新版本任务。

错误详情不应回传 API Key、供应商原始敏感响应或完整内部堆栈。

### 7.6 P3 验收

- 上传接口在测试文件规模下快速返回 Job ID，索引继续在后台执行。
- 重复投递同一任务不产生重复 Chunk 或错误文档状态。
- worker 处理到一半被杀死，任务可以重试或被巡检任务恢复。
- Embedding 限流后采用退避；多次失败可见且能人工重试。
- 队列积压时有待处理数、运行数、失败数与最长等待时间。
- 新旧版本切换期间，查询始终只读取活动版本。
- 不把新旧两版 Chunk 同时暴露为有效知识。

## 八、P4 可选产品创新：创作产物血缘与版本可追溯

如果 P0–P3 的主线已稳定，可把项目特色进一步贴近“Creative Workbench”，而不是停留在通用知识问答。

### 8.1 产品想法

一个活动帖最终可能用到：用户原始图片、抠图后的透明素材、Prompt 模板、活动参数、模型生成的标题 / 正文、人工编辑后的终稿。现在这些对象如果只保存最终文件和最终文本，未来就难以回答“这张图片从哪来、用了哪个 Prompt、这版文案是怎么得到的”。

增加“创作配方 / 资产血缘”后，用户可以从成稿反查：源素材 → 抠图任务 → 生成模型 / 参数 → Prompt 模板版本 → 人工编辑版本 → 最终 Campaign。这个方向和素材库、抠图、Campaign 的现有业务天然相连。

### 8.2 数据模型建议

```text
generation_run
  id, owner_user_id, workflow_type, provider, model_name,
  prompt_template_id, prompt_template_version, parameters_json,
  input_asset_ids, input_document_ids, status,
  input_tokens, output_tokens, estimated_cost, trace_id, created_at

asset_derivation
  id, parent_asset_id, child_asset_id, generation_run_id,
  relation_type, created_at

campaign_revision
  id, campaign_id, revision_no, content_json,
  generation_run_id, edited_by_user_id, created_at
```

以上是建议的新增模型；实施前应检查现有 Campaign / Asset 表结构，用增量迁移映射，而不是复制创建重复概念的表。避免把完整提示词中的敏感信息无差别地保存进长期日志。

### 8.3 能演示什么

- 选中一张活动帖配图，可以看到它来自哪个素材或抠图结果。
- 点击“文案来源”，查看模板版本、模型名、生成时间、活动输入摘要和修改历史。
- 对两个修订版本做差异对比，支持恢复旧版本。
- 重跑相同创作配方时，能保留一次新的 `generation_run` 记录并比较成本 / 耗时；不能承诺外部模型每次都会返回完全相同的文本或图像。

这项功能更偏产品创新，建议放在主线之后。它可以让项目从“功能聚合”进一步形成一套围绕内容生命周期的真实工作流。

## 九、测试、CI 与工程交付规范

仓库已有 GitHub Actions 构建与部署基础；下一步重点应是把质量门禁加进现有流水线，不是简单地再写一份 CI。[R2]

### 9.1 测试分层

- **Python 单元测试**
  - 覆盖范围：过滤条件、ID 构造、RRF、指标公式、任务状态机
  - 必须关注：不调用真实 LLM；使用 mock / fixture
- **Python 集成测试**
  - 覆盖范围：Chroma 隔离、版本激活、重建失败恢复
  - 必须关注：使用临时向量库，不污染开发库
- **Java 单元 / MVC 测试**
  - 覆盖范围：权限、Job API、异常映射、发消息失败
  - 必须关注：用 MockMvc / 测试数据库或容器
- **前端测试**
  - 覆盖范围：上传状态、进度、错误和取消展示
  - 必须关注：不把 API 逻辑耦合进 UI；验证加载与空状态
- **E2E 烟测**
  - 覆盖范围：登录 → 上传 → 索引完成 → 提问 → 展示引用
  - 必须关注：使用脱敏固定测试数据和测试模型配置
- **RAG 离线评测**
  - 覆盖范围：评测集、实验配置、最差案例
  - 必须关注：数据集 / 配置有版本，报告可重复生成
- **安全回归**
  - 覆盖范围：越权读取、越权删除、同名文件、提示注入样本
  - 必须关注：对每个漏洞保留永不删除的回归测试


### 9.2 CI 建议门禁

1. 格式 / lint / 类型检查通过。
2. Java 单测、Python 单测、前端相关测试通过。
3. Docker 镜像构建成功。
4. 安全关键回归通过，尤其是跨用户隔离测试。
5. 快速 RAG Smoke Dataset 指标没有超过允许阈值的退化。
6. 真实 LLM Judge 不默认放入每次 CI；它可以按夜间计划或手动工作流运行，以避免成本、外部可用性和非确定性导致主 CI 不稳定。

### 9.3 文档和发布需要一起交付

每个功能 PR 最少更新：

- 架构图 / 数据流中发生变化的部分。
- 数据库迁移和本地开发步骤。
- 测试命令及真实测试结果。
- 新环境变量说明，明确必需 / 可选、默认值和敏感性。
- 失败恢复、回滚和已知限制。
- Demo 脚本或截图（如影响用户界面）。

## 十、六周实施计划

这里按个人开发者、每周约 20–25 小时估算。若学习 Java、MQ 或测试工具还需要更多时间，把 P4 延后，不要牺牲 P0 安全和 P1 评测。

### 第 1 周：复现基线与安全方案（20–25 小时）

**目标：** 明确每个知识库读写入口，先用测试把数据隔离问题复现出来。

- 2–3 小时：记录当前分支 commit、安装依赖、备份开发数据库和 Chroma volume。
- 4–6 小时：梳理 Java 文档授权路径 → Python index / query / list / delete 路由 → Chroma 与 BM25 / Tag 依赖。
- 4–6 小时：设计 `RetrievalScope`、稳定 Chunk ID 和索引版本状态机。
- 4–6 小时：写跨用户、同名文件、越权删除的 failing tests。
- 2–3 小时：建 Git 分支 `fix/rag-tenant-isolation`，更新技术设计说明。

**周末验收：** 能演示测试如何复现风险；有明确的改动点清单，不直接在生产数据上试验。

### 第 2 周：完成 P0 安全和索引完整性（20–25 小时）

- 改写 Chroma Dense 查询，传递授权范围。
- 为 BM25 / Tag / 文档枚举与删除逻辑增加相同作用域。
- 统一 Chunk ID 为文档主键 + 版本 + Chunk 序号。
- 用 staging `index_version` 改造重建流程，失败时保留旧版本。
- 核对 Java 认证后的用户 ID 如何安全传给 Python；将 Python AI 接口限定为内部调用或增加服务鉴权。
- 运行测试并在两个测试用户之间演示互相不可见、不可删。

**周末验收：** P0 测试自动化；README / 架构文档不再模糊宣称“有 user_id 就等于隔离”。

### 第 3 周：RAG Quality Lab 最小闭环（20–25 小时）

- 人工整理首批 50 条问题，标注可回答性、来源文档、相关证据、关键事实和类别。
- 编写 Recall@K、Precision@K、MRR / nDCG 等纯 Python 指标，并为每项指标写边界测试。
- 先只跑检索链路，输出每题的召回列表与结果摘要。
- 建立 Dense-only 与当前 Hybrid 两套配置的统一接口；保持数据集和其他参数一致。
- 生成 JSON / Markdown 实验报告，包含失败案例而不是只输出平均分。

**周末验收：** 一条命令能跑完 Smoke Dataset；无真实 API Key 时仍能运行单元测试；所有指标都有定义与样例。

### 第 4 周：加入生成评测与实验比较（20–25 小时）

- 进一步加入引用命中率、可回答 / 不可回答样本分层统计。
- 在显式开启 live 模式后，才调用真实 LLM；将 LLM-as-a-judge 结果与人工抽检分开记录。
- 比较 Hybrid、Hybrid + Reranker 等配置；记录耗时与 Token 的代价。
- 保存 Git SHA、数据集版本、Prompt / Retrieval 配置版本。
- 如果时间允许，实现只读的 Admin Evaluation 页面；否则先用 Markdown / HTML 报告完成闭环。

**周末验收：** 至少一份可信的实验报告，能说明某个配置在哪类问题上改进、在哪类问题上退化。不要预先保证结果一定正向。

### 第 5 周：全链路 Trace 与成本治理（20–25 小时）

- 统一 `trace_id`，贯通 Java → Python → 模型调用。
- 增加检索、Embedding、Reranker、LLM 等阶段的结构化耗时日志。
- 按供应商 / 模型 / 生效时间配置价格表并计算估算费用。
- 增加失败原因、重试次数、无命中、TTFT / P50 / P95 统计。
- 对日志做脱敏；明确哪些 prompt 内容可以采样保存，默认不记录完整敏感正文。
- 先让日志能够本地排查，再决定是否引入完整 OpenTelemetry Collector + Trace UI。

**周末验收：** 输入一个 `trace_id` 能定位一条完整请求，回答“慢在什么阶段、调用哪个模型、用了多少 Token、是否重试”。

### 第 6 周：异步索引 + 交付收尾（20–25 小时）

- 添加 index job / outbox 持久化状态。
- 使用 RabbitMQ 作为文档索引任务队列，增加消费者、并发限制和重试策略。
- 上传接口快速返回任务 ID；前端显示真实进度和失败详情摘要。
- 完成重复消费、worker 中断、Embedding 限流、失败重试测试。
- 将关键回归与 Smoke Eval 加入现有 GitHub Actions。
- 更新 README、架构图、部署文档、演示脚本和简历表述。

**周末验收：** 全链路演示一次“上传 → 任务排队 → 索引 → 提问 → 引用 → 查看 Trace / 评测结果”；失败场景也能演示如何恢复。

### 第 7–8 周（可选）：创作血缘、可视化报告与性能压测

- 加入 Campaign Revision、Generation Run、Asset Derivation 的关联数据。
- 前端展示素材和文案的来源链路与版本对比。
- 用固定文档集做并发 / 延迟测试，记录吞吐、错误率、队列等待和 P95。
- 依据测量结果再做缓存、批处理或并发优化。

## 十一、量化验收标准：先定门槛，再用数据证明

下表是**建议的初始工程验收目标**，不是对当前项目效果的描述。实际阈值应在第一轮基线结果出来后确认。

- **安全隔离**
  - 验收目标：自动化跨用户读 / 删攻击用例全部通过；Dense / BM25 / Tag 无越权候选
  - 证据：Python 集成测试 + Java 权限测试
- **同名文件**
  - 验收目标：两个用户同名文档不冲突、不互相删除
  - 证据：集成测试，校验两个文档各自召回
- **重建可靠性**
  - 验收目标：模拟解析 / Embedding / 写入失败时，当前 ACTIVE 版本仍可查询
  - 证据：故障注入测试
- **可重复评测**
  - 验收目标：同一 Dataset + Config 能产生结构一致的结果文件；记录 Git SHA
  - 证据：CLI 运行记录 / CI Artifact
- **检索质量**
  - 验收目标：每次变更可比较 Recall@K、MRR、引用命中与失败类别；门禁阈值按基线制定
  - 证据：对照报告，禁止只展示总分
- **可观测性**
  - 验收目标：95% 以上的测试请求能够通过 Trace ID 串起 Java 与 Python 日志
  - 证据：自动化冒烟测试（目标值）
- **成本治理**
  - 验收目标：Token 与估算成本能按 workflow / model 汇总；价格表带版本与日期
  - 证据：Admin 报表 + 计算单测
- **异步索引**
  - 验收目标：重复任务不重复生成活动版本；失败任务可查、可重试；新旧版本切换正确
  - 证据：消费者集成与故障注入测试
- **发布质量**
  - 验收目标：关键测试与 Smoke Eval 在 PR / CI 中运行；新环境可根据文档复现
  - 证据：CI 运行记录、部署 Runbook


如果一个改动提升 Recall@5，却让 P95 延迟与费用大幅增加，应在报告里呈现 trade-off，而不是只挑好看的指标。工程价值来自可解释的选择，而不是每个指标都被写成“显著提升”。

## 十二、简历表达与面试讲法

### 12.1 项目亮点顺序

面试官不一定熟悉所有 AI 组件，建议按“问题 → 设计 → 数据证明 → 工程化”的顺序讲。

**第一亮点：RAG 数据隔离与索引一致性**

可讲的问题：多用户共享向量集合导致单独保存 `user_id` 元数据并不够；检索、BM25、标签召回、删除都必须应用统一授权范围。然后解释稳定 ID、索引版本和失败恢复如何避免同名冲突、误删及部分重建。

**第二亮点：可复现的 RAG Quality Lab**

可讲的问题：复杂检索系统不能靠几条手工问题调参。你设计固定标注数据集，比较 Dense / BM25 / Hybrid / Reranker，并同时观测召回质量、引用和耗时 / Token，形成可追踪的配置实验报告。

**第三亮点：端到端 AI 可观测 + 异步索引**

可讲的问题：LLM 请求跨越多个服务，单一 API 总耗时无法解释瓶颈；通过统一 Trace、阶段耗时和任务状态，将定位问题的过程工程化。

### 12.2 面试口述稿（完成后再使用）

> 我在 AI Creative Workbench 原有知识库基础上，重点解决的不是再接入一个模型，而是 RAG 系统在多人使用和持续迭代时的工程问题。我先发现共享 Chroma 集合的检索与删除路径并没有统一使用用户作用域，因此为 Dense、BM25、标签召回和文档操作设计了统一授权边界，并通过文档 ID 与索引版本构造稳定 Chunk ID，避免同名文件冲突和重建失败导致旧索引丢失。之后我构建固定的 RAG 评测集，对比多路检索、RRF 和 Reranker 的效果，同时记录引用命中、耗时与 Token 成本。最后通过 Trace ID 串联 Java、Python 和模型调用，并把文档索引改成可查询、可重试的后台任务。每个优化都有自动化测试与可复现报告，而不是只凭演示效果判断成功。

这段话只有在相关功能真实落地并有测试 / 数据支撑后才能写进简历。若部分能力尚未完成，请把动词改为“设计 / 实现中”，不要暗示已在生产环境验证。

### 12.3 简历量化模板（禁止预填虚构数字）

- 将 RAG 评测集从 **[N]** 条扩展为 **[N]** 条人工核验样本；在 **[同一数据集 / 同一模型配置]** 下，将 Recall@5 从 **[基线]** 提升 / 变为 **[实测值]**，同时报告 P95 延迟与 Token 成本变化。
- 为共享向量检索实现用户 / 租户级授权过滤，覆盖 Dense、BM25、标签召回及删除路径；新增 **[N]** 个越权访问回归测试，全部通过。
- 建立 Java → Python → LLM Trace，记录 TTFT、分阶段耗时、Token 与成本估算，将故障定位从 **[实测基线]** 改进到 **[实测结果]**（没有实际测量就不要写耗时改善）。
- 将文档索引任务化，支持幂等重试与索引版本切换；故障注入测试覆盖 **[N]** 类失败场景。

## 十三、与 AI 编码助手协作的实施方式

不要一次把整份报告扔给编码助手并要求它“一次实现所有内容”。建议按一个分支、一个目标、一个验收标准推进。

### 13.1 第一轮：只审计，不改代码

建议直接给编码助手的任务：

```text
请审计当前仓库的知识库授权与 Chroma 索引流程，暂时不要修改代码。

重点阅读：
- ai-service-python/app/services/vector_store.py
- ai-service-python/app/services/indexing_pipeline.py
- ai-service-python/app/services/retrieval/ 下的 Dense / BM25 / Tag / RRF 路径
- ai-service-python/app/routers/document.py 与 rag 路由
- backend-java 对应的知识库 Controller / Service / 用户鉴权路径

输出：
1. 每个接口的调用链和真实输入输出；
2. 用户身份从 JWT 到 Python 的传递方式；
3. 所有读取、检索、列表、预览、删除、重建路径的过滤条件；
4. 可能越权的路径和复现步骤；
5. 最小改动文件列表和测试方案。
请区分已证实问题与推测，不要先大规模重构。
```

### 13.2 第二轮：先写会失败的安全测试

```text
基于已确认的风险，先只新增自动化测试，不修改业务实现。
至少覆盖：跨用户检索隔离（Dense / BM25 / Tag）、同名文件 ID 冲突、跨用户删除、Embedding 失败后旧索引保留、请求体伪造 user_id。
测试应使用临时 Chroma / 测试数据库 / mock provider，不调用真实 LLM API。
先运行测试并报告失败项，再开始下一步实现。
```

### 13.3 第三轮：按最小改动实现 P0

```text
只实现已确认的 P0 数据隔离与索引版本问题。
要求：
- 授权 scope 必须来自可信服务端上下文，不信任浏览器 body 的 user_id；
- 所有 Dense / BM25 / Tag / list / preview / delete 路径一致过滤；
- Chunk ID 使用 document_id + index_version + chunk_index，不使用文件名作为主身份；
- 重建采用 staging version，成功后激活，失败不删除旧 ACTIVE 版本；
- 保持现有 API 尽可能向后兼容；
- 完成对应测试并运行现有测试集；
- 总结修改文件、迁移步骤、测试命令、未解决风险。
不要顺便重构无关页面或更换技术栈。
```

随后再分别创建 `feat/rag-eval-lab`、`feat/ai-observability`、`feat/indexing-jobs` 分支。每次合并之前检查 diff、数据库迁移、错误处理、测试和文档更新。

## 十四、最终交付清单

### 核心交付（必须）

- [ ] 数据隔离设计说明与数据流图
- [ ] 稳定 Chunk ID + 索引版本化
- [ ] Dense / BM25 / Tag / list / delete 权限测试
- [ ] Embedding / 重建失败的故障注入测试
- [ ] 50 条人工核验 RAG Eval Dataset（有版本、无敏感数据）
- [ ] 可运行的检索离线评测 CLI
- [ ] 一份基线报告 + 至少一组参数 / 检索策略对照报告
- [ ] Java / Python 请求关联 ID 与阶段耗时
- [ ] 异步 Job 状态、重试、幂等和任务进度
- [ ] CI 关键回归门禁
- [ ] 更新 README、架构文档、运行说明和演示脚本

### 可选加分交付

- [ ] LLM-as-a-judge + 人工抽检工作流
- [ ] 管理员侧评测对比 UI
- [ ] OpenTelemetry Trace UI / Grafana 指标面板
- [ ] 素材 / 抠图 / Campaign 的创作血缘与版本对比
- [ ] 有负载说明的简单压测报告

## 十五、参考资料与核对范围

以下资料用于确认当前仓库已有能力、关键风险和评测 / 可观测的行业实践。代码结论以当前公开 `main` 分支可访问的文件为依据；在实施前仍应 checkout 到你的本地目标 commit，再逐项核对，避免本地分支与远程仓库不一致。

- **[R1] Repository README** — 产品现有功能、技术栈、反馈与管理后台能力。https://github.com/qianfan-cmd/ai-creative-workbench/blob/main/README.md
- **[R2] Architecture document** — 服务职责、Chat / RAG 链路、部署与已有工程实现。https://github.com/qianfan-cmd/ai-creative-workbench/blob/main/docs/architecture.md
- **[R3] vector_store.py** — 共享 Chroma collection、Dense 查询、全量 Chunk / 标签枚举和按文件名删除。https://github.com/qianfan-cmd/ai-creative-workbench/blob/main/ai-service-python/app/services/vector_store.py
- **[R4] indexing_pipeline.py** — 分块、打标、删除旧向量、Embedding 与 Chunk ID / metadata 构造顺序。https://github.com/qianfan-cmd/ai-creative-workbench/blob/main/ai-service-python/app/services/indexing_pipeline.py
- **[R5] docker-compose.yml** — 本地服务、端口映射、数据库开发配置及可选中间件。https://github.com/qianfan-cmd/ai-creative-workbench/blob/main/docker-compose.yml
- **[R6] OWASP GenAI Security Project, LLM08:2025 Vector and Embedding Weaknesses** — RAG 多租户中的访问控制、向量数据泄露和数据投毒风险。https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/
- **[R7] Ragas: Available Metrics** — RAG 的 Context Precision / Recall、Faithfulness、Response Relevancy 等评估指标。https://docs.ragas.io/en/latest/concepts/metrics/available_metrics/
- **[R8] OpenTelemetry: Inside the LLM Call — GenAI Observability (2026-05-14)** — GenAI 调用、Token 用量和耗时的可观测实践。https://opentelemetry.io/blog/2026/genai-observability/

---

**结语：** 最能让面试官眼前一亮的，不是技术名词最多的架构，而是你能准确指出一个真实问题、解释它为什么发生、设计最小且可靠的修复、用自动化测试防止回归，并用可重复的数据证明改动的取舍。这个项目已经有很好的功能底座；接下来应该把时间投入到“可验证的工程质量”上。