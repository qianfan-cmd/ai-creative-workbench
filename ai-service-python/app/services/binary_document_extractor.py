"""
从 PDF / DOCX 二进制提取纯文本。

设计说明（Wave B #5）：
  - RAG 下游（split → embed → Chroma）只认「纯文本」，与 md/txt 走同一条流水线。
  - 本模块只做「二进制 → str」，按后缀由 document_parser 调用。
  - 不支持：加密 PDF、扫描版 PDF（无 OCR）、纯图片 DOCX（无 OCR）。
"""

from __future__ import annotations

import io

MAX_EXTRACTED_CHARS = 500_000


class DocumentExtractError(Exception):
    """解析失败时抛出，由 document_parser 转成 HTTP 400。"""

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


def extract_pdf_text(raw_bytes: bytes) -> str:
    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(raw_bytes))
    except Exception as exc:  # noqa: BLE001
        raise DocumentExtractError(f"PDF 文件无法打开：{exc}") from exc

    if reader.is_encrypted:
        raise DocumentExtractError("不支持加密的 PDF 文件，请先解密后再上传")

    page_count = len(reader.pages)
    if page_count == 0:
        raise DocumentExtractError("PDF 没有可读取的页面")

    parts: list[str] = []
    for page in reader.pages:
        page_text = page.extract_text() or ""
        if page_text.strip():
            parts.append(page_text.strip())

    content = "\n\n".join(parts).strip()
    if not content:
        raise DocumentExtractError(
            "PDF 未能提取到文本，可能是扫描版或空文件（本系统不支持 OCR）"
        )

    if page_count >= 1 and len(content) < 30:
        raise DocumentExtractError(
            "PDF 文本过少，可能是扫描版图片 PDF（本系统不支持 OCR）"
        )

    return _truncate(content)


def extract_docx_text(raw_bytes: bytes) -> str:
    import docx2txt

    try:
        content = docx2txt.process(io.BytesIO(raw_bytes))
    except Exception as exc:  # noqa: BLE001
        raise DocumentExtractError(f"DOCX 文件无法打开：{exc}") from exc

    content = (content or "").strip()
    if not content:
        raise DocumentExtractError(
            "DOCX 未能提取到文本，可能是空文档或仅含图片（本系统不支持 OCR）"
        )

    return _truncate(content)


def _truncate(content: str) -> str:
    if len(content) > MAX_EXTRACTED_CHARS:
        return content[:MAX_EXTRACTED_CHARS]
    return content
