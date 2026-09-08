# RAG 策略与评测说明

> Wave C · 与 [`architecture.md`](architecture.md) §3.2 配套，Phase 2 后补充 PDF/DOCX 案例。

---

## 1. 流水线参数

| 参数 | 值 | 位置 | 说明 |
|------|-----|------|------|
| **chunk_size** | 400 字符 | `text_splitter.py` / `document.py` router | 中文段落信息量与 embed 窗口折中 |
| **overlap** | 50 字符 | 同上 | 减少句边界被截断 |
| **top_k** | 默认 3，最大 10 | `schemas/rag.py` | 检索片段数；过大易超 context |
| **max extracted chars** | 500,000 | `binary_document_extractor.py` | 防超大 PDF embed 超时 |
| **history 截断** | 单轮 answer 500 字 | `rag_service.py` | 多轮上下文不占满 prompt |

### 1.1 入库路径

```
POST /ai/documents/index
  → parse_upload_file（按后缀）
  → split_text(content, chunk_size=400, overlap=50)
  → embed_texts（batch=10）
  → Chroma upsert（metadata: source, document_id, index）
```

### 1.2 问答路径

```
POST /ai/rag/query-stream
  → embed_text(question)
  → search_similar(vector, top_k)
  → 拼接 Prompt（严格依据参考资料 + 行内 [1][2] 角标）
  → stream_chat_with_llm
  → SSE: answer chunks + references
```

---

## 2. 支持格式与边界

| 格式 | 解析方式 | 可编辑 | 边界 |
|------|----------|--------|------|
| `.md` / `.txt` | UTF-8 | 是 | 非 UTF-8 → 400 |
| `.pdf` | pypdf | 否（只读预览） | 加密 / 扫描版 → 400，提示无 OCR |
| `.docx` | docx2txt | 否 | 纯图片 → 400；文本框模板已支持 |

**设计原则：** 解析层插件化 → 下游只认 **plain text**，新增格式不改 chunk/embed 逻辑。

---

## 3. 验收用例（手动）

### 3.1 基础（md/txt）

| # | 步骤 | 期望 |
|---|------|------|
| T1 | 上传 `note.md` 含专有名词 | chunk_count > 0 |
| T2 | 问「文档里提到的 XXX」 | answer 含相关内容；references 含 `note.md` |
| T3 | 编辑 md 保存 | 旧 chunk 删除，新 chunk 入库 |

### 3.2 PDF

| # | 步骤 | 期望 |
|---|------|------|
| T4 | 上传可选文字 PDF（如简历 PDF） | 预览有提取文本；chunk_count > 0 |
| T5 | RAG 问简历中的教育/项目 | references 含 PDF 文件名 |
| T6 | 上传扫描版 PDF | 400 中文提示「不支持 OCR」 |

### 3.3 DOCX

| # | 步骤 | 期望 |
|---|------|------|
| T7 | 上传普通段落 DOCX | 正常索引 |
| T8 | 上传排版型 DOCX（文本框简历） | docx2txt 提取成功；chunk_count > 0 |
| T9 | 编辑器打开 DOCX | 只读 Alert；左侧提取文本、右侧预览 |

### 3.4 回归

| # | 步骤 | 期望 |
|---|------|------|
| T10 | 空文件 / 不支持扩展名 | 400 明确错误 |
| T11 | Chat 与 RAG 并行 | 互不影响 |

**公网 Demo：** http://8.148.238.164:8088 — Wave B ECS 已验收 ✅

---

## 4. Bad Case 与处理

| 现象 | 根因 | 系统行为 | 后续可选 |
|------|------|----------|----------|
| PDF 预览乱码 | 二进制当 UTF-8 读 | 已修复：Java 调 Python parse | — |
| DOCX「未能提取段落」 | python-docx 不读文本框 | 已修复：docx2txt | — |
| 扫描版 PDF chunk=0 | 无文字层 | 400 + 中文说明 | OCR（Phase 3+） |
| 问答胡编 | 检索未命中 | Prompt 约束 + 空 hits 时弱回答 | 调 top_k / chunk_size |
| references 重复 | 模板 DOCX 重复块 | 可接受；可后处理 dedupe | 低优先级 |
| embed 超时 | 超大文档 | 500k 字符截断 | 分页入库 |

---

## 5. 评测指标（Demo 级）

当前为 **手工验收**，未上自动化 benchmark。面试可说明：

| 维度 | 当前做法 | 生产演进 |
|------|----------|----------|
| **召回** | 目视 references 是否相关 | 标注集 + hit@k |
| **忠实度** | 是否只依据资料回答 | LLM-as-judge / 人工抽检 |
| **延迟** | 首 token SSE 体感 | 记录 P95 embed + LLM |
| **成本** | `ai_call_log` token | 按用户/功能聚合 |

---

## 6. Prompt 要点（摘要）

来自 `rag_service.py`：

- 严格根据「参考资料」回答，资料不足则说明。  
- 使用 Markdown；行内引用 `[1]`、`[2]` 与 references 列表对齐。  
- 注入有限对话 history（每轮 answer 截断 500 字）。

---

## 7. 相关文件

| 文件 | 职责 |
|------|------|
| `app/services/text_splitter.py` | 滑动窗口分块 |
| `app/services/document_parser.py` | 后缀路由 |
| `app/services/binary_document_extractor.py` | PDF/DOCX |
| `app/services/embedding_service.py` | Embedding API |
| `app/services/vector_store.py` | Chroma CRUD / search |
| `app/services/rag_service.py` | 检索 + Prompt + 流式 |
| `tests/test_document_parser.py` | 解析单元测试 |

复盘：[`dev-log/2026-09-rag-pdf-docx.md`](dev-log/2026-09-rag-pdf-docx.md)
