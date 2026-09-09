# Dev-log：Admin 文档信号 + Embedding 含 Filename

> 日期：2026-09-10 · Wave D1.8 / D3.5c

---

## 1. 背景与目标

**痛点**

- 点踩分诊写入 `penalize_source` / `boost_source` 后，Admin 只能看动作日志，**无法查看/撤销**文档级信号。
- 入库 embedding 仅编码 chunk 正文，dense 检索对「PNG」等**文件名词**弱；BM25/rerank 已用 metadata 增强，dense 仍落后。
- embedding 策略变更不影响已存 Chroma 向量，需 **Admin 一键全库 re-index**。

**目标**

1. Admin 查看/撤销 penalty / boost / 全部清除。
2. `build_embed_text(filename, heading, summary, content)` 与 rerank 格式对齐；Chroma `documents` 仍存纯 content。
3. 全库 reindex API + 前端按钮；长任务超时加长。

---

## 2. 方案选型

| 决策 | 理由 |
|------|------|
| embed 与 documents 分离 | references/UI 不被 filename 前缀污染 |
| 复用 `build_embed_text` 于 rerank | 入库与排序 metadata 格式一致 |
| `reindexDocumentInternal` 绕过 ownership | Admin 全库重建需索引任意用户文档 |
| 前端 `API_TIMEOUT_HEAVY=600000` | 全库 reindex 同步循环，避免 15s axios 超时 |

---

## 3. 关键实现

```
入库: semantic_chunk → build_embed_text → embed → add_chunks(documents=纯content)
问答 rerank: rerank_text_for_hit → build_embed_text(metadata)
Admin: GET /admin/rag/source-signals → POST clear {penalty|boost|all}
       POST /admin/knowledge/reindex-all → reindexDocumentInternal × N
```

**新/改文件**

- Python：`embed_text_builder.py`、`indexing_pipeline.py`、`source_anchor.py`
- Java：`RagSourceSignalService`、`AdminRagSignalController`、`KnowledgeDocumentService.reindexAllDocumentsAdmin`
- 前端：`AdminFeedbackPage` 信号表 + 重建向量；`api/timeouts.ts`

---

## 4. 踩坑

| 现象 | 根因 | 解法 |
|------|------|------|
| 批量删除 10 条超时 | axios 默认 15s | `API_TIMEOUT_BATCH=180s` |
| 全库 reindex 超时 | 同上 | `API_TIMEOUT_HEAVY=600s` |
| Admin reindex 其他用户文档 | `getOwnedDocument` 校验登录用户 | `reindexDocumentInternal(doc)` 用 doc.userId |

---

## 5. 验收清单

- [ ] 执行 `docs/sql/rag_source_signal.sql`
- [ ] 部署 Python → Java → Admin 点「重建全库向量」
- [ ] 点踩后 Admin 可见 penalty；撤销后新会话 rerank 不再整文档降权（≤30s 缓存）
- [ ] reindex 后问「PNG」dense 可命中对应文档；references 仍显示纯正文
- [ ] `pytest tests/test_embed_text_builder.py` 通过

---

## 6. STAR（面试）

**S：** RAG 点踩降权后无法运营撤销；文件名关键词 dense 召回差。  
**T：** 建立 Admin 可运营的文档信号管理，并升级 embedding 输入。  
**A：** `rag_source_signal` 表 + Admin CRUD；embed  enriched / store raw；全库 reindex + 超时分级。  
**R：** 反馈闭环可演示「写入→撤销」；filename 进入 dense 向量（需 reindex 一次生效）。
