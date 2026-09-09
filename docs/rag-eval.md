# RAG 策略与评测说明

> Wave C + **D1 + D1.5** · 与 [`architecture.md`](architecture.md) §3.2 配套。  
> Bad Case：[`rag-badcases.md`](rag-badcases.md) · 复盘：[`dev-log/2026-09-rag-quality-d1_5.md`](dev-log/2026-09-rag-quality-d1_5.md)

---

## 1. 流水线参数

| 参数 | 值 | 位置 | 说明 |
|------|-----|------|------|
| **chunk** | 结构化 + 400/50 fallback | `text_splitter.py` | 空行/标题优先，metadata `section`/`heading` |
| **top_k** | 默认 **6**，最大 10 | `schemas/rag.py` | 进 Prompt 片段数 |
| **retrieve_candidates** | 30（env） | `retrieval/config.py` | 广召回 |
| **distance_threshold** | 1.35 | `retrieval/config.py` | 弱 dense 过滤 |
| **query_rewrite** | 默认开 | `query_rewriter.py` | 主改写 + 子查询 |
| **rerank** | BGE local | `reranker.py` | 默认 `BAAI/bge-reranker-base`（~1.1GB）；env 可改 v2-m3 |
| **semantic_chunk** | LLM + 规则 | `semantic_chunker.py` | `SEMANTIC_CHUNK_ENABLED=1` |
| **AI 打标** | 入库 LLM | `knowledge_tagger.py` | 文档/chunk tags → Chroma + MySQL |
| **tag 召回** | LLM 推断 + 过滤 | `tag_retriever.py` | 第 4 路召回；`requires_exhaustive` 替代 regex |
| **RERANK_MIN_SCORE** | -1.0 | `config.py` | 通用低分过滤 |
| **feedback 自愈** | 点踩 async | `feedback_auto_fix.py` | re-index / penalize / add_tag |
| **max_chunks_per_source** | 2 / 列举 4 | `context_selector.py` | 同文档多证据 |
| **RAG_TRACE** | env `RAG_TRACE=1` | SSE `event: trace` | 分阶段诊断 |
| **RERANK_MODEL** | 默认 `bge-reranker-base` | `config.py` | uvicorn lifespan 预热；SSE 首包 `event: status` 保活 |

**re-index 说明（D1.5b）：** 已有文档需**删除后重新上传**，否则无 `section`/`heading` metadata。

### 1.1 入库路径

```
POST /ai/documents/index
  → parse_upload_file
  → split_text_structured（标题/空行 → 超长 fallback 400/50）
  → embed_texts
  → Chroma（metadata: source, index, section, heading, document_id）
```

### 1.2 问答路径（Wave D1.5）

```
POST /ai/rag/query-stream
  → rewrite_query（可选）
  → multi-query hybrid_search（dense+BM25+RRF × N queries）
  → threshold → dedupe → BGE rerank → select_context(top 6)
  → Prompt（含列举穷尽规则）
  → stream_chat_with_llm
  → SSE: trace? → references → message
```

---

## 2. 工业 RAG 9 步方法论（闭环）

| 步骤 | 本项目实现 | 评测/反馈 |
|------|------------|-----------|
| 1 查知识 | 上传 + 结构化 chunk | Golden + re-index |
| 2 查改写 | `query_rewriter.py` | trace.rewritten_queries |
| 3 查召回 | hybrid + multi-query | trace.candidate_count |
| 4 查排序 | RRF + BGE rerank | trace.rerank_top_scores |
| 5 查截断 | select_context / top_k | trace.final_count |
| 6 查生成 | 列举型 Prompt | answer 完整度 |
| 7 查安全 | — | 生产演进 |
| 8 查评测 | Golden + 分阶段列 | 本表 §5 |
| 9 查反馈 | D3 预埋 reason | badcases 回流 |

**闭环：** 线上问答 → 点踩 → badcase 分诊 → 改 chunk/rewrite/rerank/prompt → Golden 回归。

---

## 3. Golden Set

| # | 类型 | 问题 | 期望 | rewrite | recall@6 | rerank@6 | 完整度 | 归因 |
|---|------|------|------|---------|----------|----------|--------|------|
| **G-Resume** | pdf | 在哪里实习过 / 列举所有实习 | **两家公司均出现** | | | | | |
| G1 | md | 专有名词 XXX | 含该 md | | | | | |
| G2 | md | 某章节讲了什么 | 相关段落 | | | | | |
| G3 | pdf | 教育/项目 | 含 PDF 名 | | | | | |
| G5 | md | 无关常识 | 空/无法确定 | | | | | |
| G6 | md | 错误码/型号 | bm25/hybrid | | | | | |
| G9 | 空库 | 任意 | references [] | | | | | |

手测时填后四列；失败时查 [`rag-badcases.md`](rag-badcases.md)。

---

## 4. 验收用例（手动）

（T1～T11 同 Wave B/C，略）

**D1.5 专项：**

| # | 步骤 | 期望 |
|---|------|------|
| D15-1 | 删旧简历 → 重传 → 问实习 | 两家实习均答出 |
| D15-2 | `RAG_TRACE=1` 提问 | SSE 有 trace 事件 |
| D15-3 | 无关问题 | 仍「无法确定」 |

---

## 5. 优化手段备忘（原 RAG优化.md 摘要）

- **Query 改写：** 主改写 + 子查询，扩大召回  
- **多路召回：** BM25 + 向量 + multi-query RRF（GraphRAG/Tag 留生产演进）  
- **Rerank：** 本地 BGE，解决「召回了但排后」  
- **Chunk：** 结构化语义单元；勿用纯固定窗口切简历  
- **知识冲突：** 旧文档下线、版本治理 — Phase 3+  
- **反馈：** 点踩 → `ai_feedback` → Admin `/admin/feedback` → 回流 Golden（Wave D3 ✅）

---

## 6. 相关文件

| 文件 | 职责 |
|------|------|
| `retrieval/langchain_retriever.py` | 混合检索主入口 |
| `retrieval/query_rewriter.py` | Query 改写 |
| `retrieval/reranker.py` | BGE rerank |
| `retrieval/context_selector.py` | 证据选取 |
| `retrieval/rag_trace.py` | 分阶段 trace |
| `text_splitter.py` | 结构化 chunk |
| `rag_service.py` | Prompt + 流式 |
| `tests/test_d15_modules.py` | D1.5 单测 |

复盘：[`dev-log/2026-09-rag-hybrid-retrieval.md`](dev-log/2026-09-rag-hybrid-retrieval.md) · [`dev-log/2026-09-rag-quality-d1_5.md`](dev-log/2026-09-rag-quality-d1_5.md)
