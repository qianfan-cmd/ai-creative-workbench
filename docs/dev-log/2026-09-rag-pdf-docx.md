# RAG 支持 PDF/DOCX（Wave B #5～#7）

> 2026-09 · AI Creative Workbench · 面试向开发复盘  
> Roadmap：Wave B · #5～#7

## 1. 背景与目标

**用户痛点**

- 知识库 RAG 仅支持 `.txt` / `.md`，无法索引 PDF/DOCX 等常见办公文档。
- Java 已把二进制文件传到 Python，瓶颈在 Python `UTF-8` 解码。

**目标**

1. 解析层插件化：PDF/DOCX → plain text，下游 chunk/embed/Chroma **不变**。
2. Java / 前端格式校验与 UX 对齐（PDF/DOCX 只读预览）。
3. Docker 镜像含新依赖，CD 可部署。

---

## 2. 方案选型

| 决策点 | 选型 | 理由 |
|--------|------|------|
| PDF 库 | **pypdf** | 纯 Python、无系统依赖，Docker 友好 |
| DOCX 库 | **docx2txt** | 覆盖段落、页眉/页脚、文本框；纯 Python |
| 架构 | 新建 `binary_document_extractor.py` | 与 `document_parser` 职责分离 |
| 二进制编辑 | **不支持** | 重新上传；编辑器只读展示提取文本 |
| PDF/DOCX 预览 | Java `getContent` 调 Python `/parse` | 避免 `UTF-8` 读二进制乱码 |
| 文本上限 | 500,000 字符 | 防 embed 超时 |

**边界（demo 不翻车）**

- 无 OCR（扫描版 PDF → 400 中文提示）
- 无加密 PDF
- DOCX 支持段落/页眉/页脚/文本框；纯图片扫描件仍无 OCR

---

## 3. 数据流

```
上传 → Java KnowledgeDocumentService
     → Python parse_upload_file
         .md/.txt → UTF-8
         .pdf     → pypdf
         .docx    → docx2txt
     → split_text(400, 50) → embed → Chroma
     → /ai/rag/query-stream → references 含 filename
```

---

## 4. 关键实现

| 文件 | 改动 |
|------|------|
| `binary_document_extractor.py` | PDF/DOCX 提取 + `DocumentExtractError` |
| `document_parser.py` | 后缀分支 |
| `requirements.txt` | pypdf、docx2txt（测试仍用 python-docx 生成样例） |
| `PythonAiClient.java` | `parseDocument()` + FastAPI detail 解析 |
| `KnowledgeDocumentService.java` | ALLOWED_EXT、getContent/saveContent 分支 |
| `knowledgeFormats.ts` | 前端统一常量 |
| `KnowledgePage/ListPage/EditorPage` | accept、只读 UX |

---

## 5. 踩坑

| 现象 | 解法 |
|------|------|
| PDF 当 UTF-8 读 → 乱码 | 二进制走 Python parse，禁止 `new String(bytes, UTF_8)` |
| 扫描版 PDF chunk=0 | extractor 检测文本过少，返回明确 400 |
| Python 400 到前端是 502 | `mapPythonClientError` 把 4xx detail 映射为 BusinessException 400 |

---

## 6. 验收清单

- [x] Python：`tests/test_document_parser.py`（md/docx/扩展名校验）
- [x] Java compile、前端 tsc 通过
- [x] 本地/E2E：上传 pdf/docx → chunk_count > 0 → RAG references
- [x] ECS：CD rebuild ai 镜像后公网验证

---

## 迭代 2026-09-09 · docx2txt 补丁

**现象：** 排版型 DOCX（文本框简历）python-docx 段落全空 → 400「未能提取段落文本」。  
**解法：** 改用 **docx2txt**（页眉/页脚/文本框）；`requirements.txt` + ECS rebuild 验收通过。

---

## 7. STAR

- **S/T**：知识库仅 md/txt，无法覆盖 PDF 规范文档。  
- **A**：插件化解析层 + 统一 plain-text 流水线；二进制只读；Java BFF 调 parse 预览。  
- **R**：全链路扩展 PDF/DOCX，md/txt 零改动下游；面试可讲边界（无 OCR）与分层设计。

---

## 8. 相关文件

- [`docs/project-roadmap.md` §5](../project-roadmap.md)
- [`docs/deploy.md` §6.1](../deploy.md)
