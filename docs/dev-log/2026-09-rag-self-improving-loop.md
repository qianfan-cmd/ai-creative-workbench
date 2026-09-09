# Dev-log：RAG 可持续优化（越用越好用）

> 日期：2026-09-09

## 背景

D1.5 混合检索 + rerank 后，简历类问题仍出现「两实习只答一家、引用半数无关」。用户明确拒绝 **关键词 regex 补丁**，要求按 [`RAG优化.md`](../RAG优化.md) 从 **chunk / 标签 / 反馈闭环** 系统性解决。

## 实现

| Wave | 内容 |
|------|------|
| D1.6a | `semantic_chunker.py`：结构化预切 → LLM 语义边界 → 过短合并/过长拆分 |
| D1.6b | `knowledge_tagger.py` + `knowledge_document_tag` 表 + 文档库标签 UI |
| D1.7 | `tag_retriever.py`：LLM 推断 query 标签 + 第 4 路标签召回 + `RERANK_MIN_SCORE` |
| D3.5 | 点踩 → `feedback_triage` → 全自动 penalize/boost/reindex/add_tag |
| D3.5b | Admin 反馈页展示 `rag_feedback_action` 日志 |

## 链路

```
入库: parse → semantic_chunk → AI tag → embed → Chroma(tags metadata)
问答: infer_tags → tag+hybrid RRF → rerank(+chunk signal) → select_context
点踩: triage LLM → Java async → re-index / 信号 / 补标签
```

## 验收（待全库 re-index 后）

- [ ] G-Resume：两家实习信息 + 无关 md 不进入 references
- [ ] 点踩 `irrelevant` 后同问改善；Admin 可见 action log
- [ ] `RAG_TRACE=1`：`inferred_tags`, `requires_exhaustive`, `after_rerank_filter_count`

## SQL 迁移

依次执行：`docs/sql/knowledge_document_tag.sql`、`rag_chunk_signal.sql`、`rag_feedback_action.sql`

## STAR

**S：** RAG 点踩后问题重复出现，关键词补丁不可扩展。**T：** 建设入库语义单元 + 标签定向召回 + 反馈自愈。**A：** D1.6/D1.7/D3.5 三波；LLM 打标与分诊，chunk 信号写入 rerank。**R：** 「越用越好用」闭环可演示；D2 Tavily 顺延。
