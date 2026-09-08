"""
文档解析服务
职责：
  - 接收上传文件（POST /ai/documents/parse | /chunk | /index）
  - 按后缀分支：文本类 UTF-8 解码；PDF/DOCX 走 binary_document_extractor
  - 返回 (filename, plain_text) 供 split → embed → Chroma
"""

from fastapi import HTTPException, UploadFile

from app.services.binary_document_extractor import (
    DocumentExtractError,
    extract_docx_text,
    extract_pdf_text,
)

TEXT_EXTENSIONS = {".md", ".txt", ".markdown"}
BINARY_EXTENSIONS = {".pdf", ".docx"}
ALLOWED_EXTENSIONS = TEXT_EXTENSIONS | BINARY_EXTENSIONS


def parse_upload_file(file: UploadFile) -> tuple[str, str]:
    """
    读取上传文件并返回 (filename, content)。
    """
    filename = file.filename or "unknown"

    dot = filename.rfind(".")
    ext = filename[dot:].lower() if dot != -1 else ""

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"不支持的文件类型: {ext}，"
                f"目前支持 {sorted(ALLOWED_EXTENSIONS)}"
            ),
        )

    raw_bytes = file.file.read()

    if not raw_bytes:
        raise HTTPException(status_code=400, detail="文件内容为空")

    try:
        if ext in TEXT_EXTENSIONS:
            content = _parse_text_bytes(raw_bytes)
        elif ext == ".pdf":
            content = extract_pdf_text(raw_bytes)
        elif ext == ".docx":
            content = extract_docx_text(raw_bytes)
        else:
            raise HTTPException(status_code=400, detail=f"未实现的解析类型: {ext}")
    except DocumentExtractError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc

    content = content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="解析后文件内容为空")

    return filename, content


def _parse_text_bytes(raw_bytes: bytes) -> str:
    try:
        return raw_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail="文件内容编码错误，文本类请使用 UTF-8",
        ) from exc
