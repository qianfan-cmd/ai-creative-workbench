# Dev-log：Wave D3 — AI 反馈闭环

> 日期：2026-09-09

---

## 1. 背景

D1.5 建立了 RAG 质量链路与 Golden/bad case 文档，但缺少**用户侧信号**闭环。D3 在 RAG/Chat 回答上收集 👍/👎，Admin 看分布与点踩样本，支撑「效果评估与持续优化」叙事（非伪在线学习）。

---

## 2. 实现

| 层 | 产出 |
|----|------|
| DB | `ai_feedback` 表，`uk_feedback_user_ref` 唯一约束 |
| Java | `AiFeedbackService.submit` upsert；`getStats` 聚合 + 最近 down |
| API | `POST /api/feedback`；`GET /api/admin/feedback/stats` |
| 前端 | `FeedbackButtons`（点踩弹 reason）；Knowledge/Chat 挂载；`AdminFeedbackPage` |

**Upsert 语义：** 同一用户 + 同一 ref 重复提交 → 更新 rating/reason，不新增行。

**所有权校验：** `knowledge_turn` 校验 session 归属；`message` 仅 assistant 且 conversation 归属当前用户。

---

## 3. 面试 STAR 要点

- **S：** 简历列举不全等 bad case 仅靠人工复现成本高  
- **T：** 建立可运营的反馈采集与 bad case 候选池  
- **A：** 统一 `ai_feedback` 表 + upsert API + Admin 统计页 + reason 与 `rag-badcases` 对齐  
- **R：** 点踩 → Admin 列表 → 手动回流 Golden/chunk 调参；未来可接 rerank 训练

---

## 4. 验收清单

1. 执行 `docs/sql/ai_feedback.sql`（Docker：`Get-Content docs/sql/ai_feedback.sql | docker exec -i workbench-mysql mysql -uroot -pworkbench workbench`）
2. 重启 Java backend（新 Controller/Service）
3. RAG 问一题 → 等 turn 持久化（有 dbId）→ 👎 选「列举不全」
4. Admin 登录 → 侧栏「AI 反馈 Feedback」→ 看 up/down 与最近点踩
5. 同一 turn 再点 👍 → 计数不重复增加（upsert）

---

## 5. 未做（P2）

- Matting/Campaign `generation_job` 反馈（D3-7）
