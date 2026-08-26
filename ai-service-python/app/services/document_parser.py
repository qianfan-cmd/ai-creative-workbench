"""
文档解析服务
职责：
  - 接收 POST /ai/document/parse 请求
  - 用 Pydantic 校验 JSON  body
  - 调用 services/llm_service.parse_document
  - 把结果包装成 DocumentParseResponse 返回，或把异常转成合适的 HTTP 状态码
"""

from fastapi import HTTPException, UploadFile

ALLOWED_EXTENSIONS = {".md", ".txt", ".markdown"}

def parse_upload_file(file: UploadFile) -> tuple[str, str]: # 返回类型注解：元组[字符串, 字符串]，返回两个字符串
    """
    读取上传文件并返回 (filename, content)。
    参数:
        file: FastAPI 收到的上传文件对象（含文件名、二进制内容）
    返回:
        (filename, content) 元组 — Python 里一次返回两个值
    异常:
        HTTPException 400：后缀不支持或内容为空
    """
    filename = file.filename or "unknown"

    # 取后缀并转小写
    dot = filename.rfind(".")
    ext = filename[dot:].lower() if dot != -1 else ""

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code = 400,
            detail=f"不支持的文件类型: {ext}，目前仅支持 {ALLOWED_EXTENSIONS}",
        )

     # await file.read()：异步读取全部字节（UploadFile 在 async 路由里要用 await）
    raw_bytes = file.file.read()  # 同步 read；若在 async def 里用 await file.read()

    if not raw_bytes:
        raise HTTPException(status_code = 400, detail = "文件内容为空")

    #decode: 字节 -》 字符
    try:
        content = raw_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code = 400, detail = "文件内容编码错误")

    content = content.strip()
    if not content:
        raise HTTPException(status_code = 400, detail = "解析后文件内容为空")

    return filename, content