# RAG Bad Case 登记

> Wave D1.5f · 与 [`rag-eval.md`](rag-eval.md) Golden Set 配套

| ID | 现象 | 归因阶段 | 修复 Wave | 状态 |
|----|------|----------|-----------|------|
| BC-001 | 简历两实习只答一家 | Step1 chunk + Step3 召回 | D1.6/D1.7 | 已修复（需 re-index + 全链路验收） |
| BC-002 | 无关问题胡编 | Step3 召回 | D1 阈值 | 已修复 |
| BC-003 | 引用半数无关 md | Step3/4 无标签过滤 | D1.7 tag 召回 + rerank min | 已修复（待验收） |
| BC-004 | PNG 双问混入无关 doc / 只答原因 | Step3/4/5 无锚定 + Step6 | D1.8 主体锚定 + 元数据 rerank/BM25 + 文档级反馈 | 待手测 |

## 归因阶段（9 步）

1. 查知识 → 2. 查改写 → 3. 查召回 → 4. 查排序 → 5. 查截断 → 6. 查生成 → 7. 查安全 → 8. 查评测 → 9. 查反馈

## 登记模板

```
ID:
问题:
references 摘要:
answer 摘要:
RAG_TRACE（若 RAG_TRACE=1）:
归因: Step?
处理:
```

## D3 反馈 reason 枚举

- `incomplete_list` — 列举不全
- `wrong_fact` — 事实错误
- `irrelevant` — 答非所问
- `other` — 其他

**回流流程：** 用户在 RAG/Chat 点 👎 并选原因（选「其他」须填补充说明 `reason_detail`）→ `ai_feedback` 表 → 分诊 Agent → Admin `/admin/feedback` → 手动登记上表 → 驱动 Golden/chunk 调参。

## BC-004 手测清单

```
ID: BC-004
问题: PNG 文件上传报错的原因是什么，最后是怎么修复的
期望: 原因 + 修复步骤/函数名均出现；references 同文档 ≥3 段
RAG_TRACE=1 关注: anchor_sources、distinct_sources_in_final、rewritten_queries、procedure_intent
点踩闭环: reason=other + detail「混入了通用 bug 流程」→ Admin 应有 penalize_source → 新开会话同题验证
回归: G-Resume「在哪里实习过」→ 两家均出现
```
