"""RAG 全链路 LLM 提示词 — 通用原则 + 多类型 few-shot，单点维护。"""


def semantic_chunk_prompt(filename: str, blocks_text: str, *, block_count: int) -> str:
    return f"""你是文档切分专家。下面是一份文档「{filename}」经规则预切后的 {block_count} 个块（编号 0～{block_count - 1}）。
请输出 JSON 数组（不要其它文字），用块索引操作描述如何合并，**不要重复输出原文**：
[
  {{"op": "keep", "indices": [0], "section_hint": "technical", "summary": "一句话摘要"}},
  {{"op": "merge", "indices": [1, 2], "section_hint": "general", "summary": "一句话摘要"}}
]

规则：
- op 只能是 keep（单块）或 merge（合并相邻块）；
- indices 必须覆盖 0～{block_count - 1} 每个编号恰好一次，无重复、无遗漏；
- section_hint：procedure|policy|reference|profile|technical|general 之一；
- summary：合并后 chunk 的一句话摘要；
- 语义完整的相邻短块可 merge；同一主题/步骤/问答对应段落可 merge；
- 不要 split（超长块由系统本地处理）。

示例：操作手册「步骤+前置条件」→ merge；技术笔记「现象/根因/方案」→ 各 keep 或按逻辑 merge。

仅输出 JSON 数组。

预切块：
{blocks_text}"""


def document_tag_prompt(filename: str, preview: str, vocab_hint: str) -> str:
    return f"""你是知识库标签助手。为文档「{filename}」打标签，输出 JSON（不要其它文字）：
{{
  "document_tags": ["文档级标签3到8个"],
  "chunk_tags": [
    {{"index": 0, "tags": ["chunk标签1到3个"]}}
  ]
}}

原则：
- 标签应概括文档类型、主题、关键实体；从正文提取，勿编造；
- 优先复用已有词表；新标签不超过 8 个字；按需选用，勿凑数。

标签示例（按需选用，勿全部套用）：
- 文档类型：技术文档、操作手册、会议纪要、产品说明、学习笔记
- 主题：部署、前端、RAG、数据库、API
- 实体：项目名、产品名、版本号（须来自正文）
{vocab_hint}

文档 chunk 预览：
{preview[:8000]}"""


def query_tag_infer_prompt(question: str, vocab_hint: str) -> str:
    return f"""你是 RAG 检索标签助手。根据用户问题，从标签词表中选出最相关的 0～5 个标签，并判断是否需要穷尽列举所有相关项。
输出 JSON（不要其它文字）：
{{"tags": ["标签1"], "requires_exhaustive": true}}

原则：
- 只选词表中存在的标签；无关则返回空数组；
- requires_exhaustive：问题要求列出全部/所有/几个/哪些，或询问修复步骤/怎么解决/最终如何修复时为 true。

示例：
- 问：「部署流程有哪些步骤？」→ {{"tags": ["部署", "操作手册"], "requires_exhaustive": true}}
- 问：「PNG 上传报错最后怎么修复的？」→ {{"tags": ["前端", "API"], "requires_exhaustive": true}}
- 问：「Redis 是什么？」→ {{"tags": ["Redis"], "requires_exhaustive": false}}
- 问：与词表明显无关 → {{"tags": [], "requires_exhaustive": false}}

标签词表：{vocab_hint}

用户问题：{question}"""


def query_rewrite_prompt(question: str) -> str:
    return f"""你是 RAG 检索 Query 改写助手。根据用户问题，输出 JSON（不要其它文字）：
{{
  "main_rewrite": "补全语义、规范表达的检索问句",
  "sub_queries": ["子查询1", "子查询2"]
}}

原则：
- main_rewrite 保留原意，更适合知识库关键词/语义检索；
- sub_queries 最多 2 条，用于扩大召回；无必要则返回空数组；
- 列举/全部/哪些类问题：可生成 1～2 条帮助召回多条证据的子查询；
- 同时问「原因 + 修复/怎么解决」时：拆成 2 条 sub_queries，分别召回原因段与修复段；
- sub_queries **必须保留原问核心实体/主题**（如 PNG、具体产品名），不得泛化成「bug 修复流程」等。

改写示例：
- 原问：「超时怎么排查？」→ main_rewrite: 「服务请求超时的排查步骤与常见原因」
- 原问：「有哪些部署方式？」→ main_rewrite: 「系统支持的部署方式」；sub_queries: [「部署方案列表」, 「部署环境要求」]
- 原问：「X 和 Y 的区别」→ main_rewrite: 「X 与 Y 的差异对比」
- 原问：「XX 报错的原因是什么，最后怎么修复的？」→ main_rewrite: 「XX 报错原因与修复方案」；sub_queries: [「XX 报错的根因与现象」, 「XX 问题的修复步骤与代码改动」]

仅输出 JSON。

用户问题：{question}"""


def feedback_triage_prompt(
    *,
    reason: str | None,
    user_reason_detail: str | None,
    question: str,
    answer: str,
    refs_preview: str,
) -> str:
    detail_block = ""
    if user_reason_detail and user_reason_detail.strip():
        detail_block = f"\n用户补充说明：{user_reason_detail.strip()[:500]}"
    return f"""你是 RAG 质量分诊 Agent。用户点踩了以下问答，请分析根因并给出修复动作。
输出 JSON（不要其它文字）：
{{
  "root_step": 3,
  "reason_detail": "简述问题",
  "bad_chunk_ids": ["filename-0"],
  "good_chunk_ids_missing": ["filename-5"],
  "suggested_document_tags": {{"api-guide.md": ["API", "部署"]}},
  "suggested_actions": ["penalize:notes.md-2", "penalize_source:通用bug流程.md", "boost_source:PNG文件上传报错修复过程.md", "reindex:manual-v2.pdf", "add_tag:api-guide.md:API"]
}}

归因阶段：1查知识 2改写 3召回 4排序 5截断 6生成 7安全 8评测 9反馈
action 格式：penalize:chunk_id | boost:chunk_id | penalize_source:filename | boost_source:filename | reindex:filename | add_tag:filename:tag

分诊示例：
- 用户补充「文档有修复步骤但未答出」且 refs 仅含原因段 → root_step 5，good_chunk_ids_missing 填缺失的修复 chunk_id
- 用户补充「明明有步骤却说无法确定」且 refs 已含修复段 → root_step 6，bad_chunk_ids 可为空
- 列举不全（如只答一家公司）→ root_step 5 或 6，boost 缺失 chunk
- 用户补充「混入了无关文档/通用流程」→ penalize_source:无关文档文件名.md；若知主文档 → boost_source:主文档文件名.md

点踩原因：{reason or 'other'}{detail_block}
用户问题：{question}
助手回答：{answer[:2000]}
引用 references：{refs_preview}"""


def rag_generation_rules() -> str:
    return """规则：
- 只使用参考资料中的信息，不要编造；
- 资料不足以回答时，明确说「根据现有资料无法确定」；
- 回答要详细，不要只回答一个关键词；
- 若问题包含多个子问题（如「原因是什么」+「怎么修复」），须逐段完整回答每一部分，不得只答一半；
- 若问题要求列举、全部、哪些、所有等相关项，须穷尽参考资料中所有相关项，不得只答一部分（例：问「有哪些步骤」须列出资料中的每一步）；
- 若任一参考资料含修复步骤、函数名、代码片段或操作说明，须摘录并写入回答；不得因某条 ref 仅有外链/链接就声称「无法确定修复方案」；
- 修复/操作类问题优先输出：步骤列表、工具函数名、关键代码（摘自 ref，可用 `代码` 格式）；
- 优先使用与问题主体（文档名/小节/摘要）一致的参考资料；标题或摘要明显与问题无关的 ref（如通用 bug 流程、无关 API 文档）不得当作主体答案；
- 使用 Markdown 排版：可用 ## 小标题、- 列表、**加粗**、`代码`；
- 引用某条资料时，在句末标注角标 [1]、[2] 等，编号必须与「参考资料」里的编号一致；
- 不要输出 References 列表本身，角标写在正文里即可；
- 若存在对话历史，可结合历史理解当前问题的指代，但事实仍须来自参考资料。"""
