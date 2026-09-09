# Dev-log：Wave D1.5 — RAG 质量优化与闭环

> 日期：2026-09-09

---

## 1. 背景

D1 混合检索后，无关问题已能「无法确定」，但简历「两实习只答一家」暴露 **top_k 过小、无 rerank/改写、chunk 固定窗口、生成无列举约束** 等问题。

---

## 2. 方案（9 步闭环）

| Wave | 内容 |
|------|------|
| D1.5a | top_k=6、列举 Prompt、RAG_TRACE SSE |
| D1.5b | split_text_structured + section/heading metadata |
| D1.5c | Query 改写 + multi-query RRF |
| D1.5d | 本地 BGE reranker（sentence-transformers） |
| D1.5e | 同文档多 chunk / MMR-lite |
| D1.5f | Golden G-Resume、badcases、rag-eval 升级 |

---

## 3. 链路

```
改写 → 多 query hybrid(30) → threshold → dedupe → BGE rerank → select_context(6) → Prompt → LLM
```

---

## 4. 踩坑

- **re-index 必须**：D1.5b metadata 仅对新入库文档生效，旧简历需删后重传
- **Rerank 首次启动**会下载 BGE 模型（默认 `bge-reranker-base` ~1.1GB；v2-m3 ~2.3GB）；已在 `main.py` lifespan 预热，勿在首问懒加载
- **Query 改写**每问多一次 LLM 调用，可 `QUERY_REWRITE_ENABLED=0` 关闭

---

## 5. 验收

- [ ] 删旧简历 → 重传 → 问「在哪里实习过」→ 两家公司均出现
- [ ] `RAG_TRACE=1` 可见 rewritten_queries / rerank_top_scores
- [ ] 无关问题仍无法确定
- [ ] Golden G-Resume 通过

---

## 6. STAR

**S：** 知识库问答漏答简历第二段实习。**T：** 在不换 SSE 的前提下提升列举类完整度。**A：** 9 步方法论落地 D1.5 六波；闭环 trace + badcase + Golden。**R：** 可演示分阶段归因；D2 Tavily 顺延。
