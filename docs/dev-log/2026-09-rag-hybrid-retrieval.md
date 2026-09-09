# Dev-log：Wave D1 — LangChain 混合检索

> 日期：2026-09-09 · Phase 3 Wave D1

---

## 1. 背景

RAG 原先为 Chroma 单向量 `top_k=3`，专有名词/错误码易漏召回，弱相关无阈值过滤。JD 要求 LangChain 与 RAG 调优经验，Wave D1 在**不替换生成/Prompt/SSE** 前提下升级检索链。

---

## 2. 选型

| 决策 | 理由 |
|------|------|
| LangChain 仅检索 | 自定义 `ChromaDenseRetriever(BaseRetriever)`；BM25 用 `rank_bm25`（避免 langchain-community 与 chromadb 依赖冲突） |
| 手写 RRF | 可控权重；不引入 EnsembleRetriever 额外抽象 |
| BM25 lazy rebuild | index/delete 后 `invalidate_bm25_cache()`，下次检索重建 |
| `DISTANCE_THRESHOLD` | 过滤弱 dense；BM25 命中可 override 超阈值 dense |

---

## 3. 实现

```
hybrid_search(question)
  → ChromaDenseRetriever.invoke (top 20)
  → BM25Retriever.invoke (top 20)
  → RRF(BM25_WEIGHT, DENSE_WEIGHT, RRF_K=60)
  → threshold filter → top_k
```

**新文件：**

- `app/services/retrieval/config.py`
- `app/services/retrieval/bm25_index.py`
- `app/services/retrieval/langchain_retriever.py`

**改动：** `vector_store.py`（`list_all_chunks`、`id`、BM25 invalidate）、`rag_service.py`、`schemas/rag.py`、`requirements.txt`

---

## 4. 踩坑

- **循环 import：** `vector_store` ↔ `bm25_index` → lazy import `_invalidate_bm25_cache()`
- **阈值标定：** 默认 `1.35` 需用真实文档实测；过小会空结果，过大弱相关进 Prompt

---

## 5. 验收

- [ ] 专有名词问题 references 含目标文档
- [ ] 弱无关问题 references 为空或更少（D2 联网兜底）
- [ ] SSE references 向后兼容
- [ ] `pytest tests/test_hybrid_retrieval.py` 通过

---

## 6. STAR（面试）

**S：** 知识库问答仅向量 top3，简历/技术文档里产品型号常检索不到。  
**T：** 在不重写 SSE/ citation Prompt 的前提下提升召回与精度。  
**A：** LangChain BM25 + Chroma dense + RRF；retrieve 20 → threshold → top 3；BM25 与 Chroma 入库同步。  
**R：** 混合检索可演示 `retrieval_source`；为 Wave D2 Tavily 兜底铺路。
