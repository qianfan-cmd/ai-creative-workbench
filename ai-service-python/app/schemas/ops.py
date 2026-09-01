"""Ops 工作流相关请求/响应结构（图文运营 Week 12）"""



from typing import Dict, List, Optional



from pydantic import BaseModel, Field





class RenderPromptRequest(BaseModel):

    """POST /ai/ops/render-prompt 请求体"""



    template: str = Field(..., min_length=1, description="含 {{var}} 的模板正文")

    variables: Dict[str, str] = Field(default_factory=dict, description="变量键值对")





class RenderPromptResponse(BaseModel):

    prompt: str = Field(..., description="渲染后的最终 prompt")

    missing: List[str] = Field(default_factory=list, description="模板中有但未传入的变量名")





class OpsHealthResponse(BaseModel):

    """GET /ai/ops/health — 各子能力是否就绪"""



    render_prompt: bool = True

    seedream_configured: bool = Field(..., description="SEEDREAM_API_KEY 是否已设置")

    dashscope_configured: bool = Field(..., description="DASHSCOPE_API_KEY 是否已设置")

    vision_configured: bool = Field(default=False, description="视觉元素识别是否可用")

    primary_provider: str = Field(default="seedream", description="优先使用的图像 Provider")





class CopyStreamRequest(BaseModel):

    """POST /ai/ops/copy/stream — Java 渲染好 prompt 后传入"""



    prompt: str = Field(..., min_length=1, description="已填充变量的完整 prompt")





class ImageCandidateDTO(BaseModel):

    url: str

    index: int





class ImageGenerateRequest(BaseModel):

    """POST /ai/ops/image-gen 与 /ai/ops/matting 共用"""



    prompt: str = Field(..., min_length=1)

    source_url: Optional[str] = Field(None, alias="sourceUrl")

    count: int = Field(default=4, ge=1, le=6)

    aspect_ratio: Optional[str] = Field(None, alias="aspectRatio")

    job_type: str = Field(default="image_gen", alias="jobType")



    model_config = {"populate_by_name": True}





class ImageGenerateResponse(BaseModel):

    provider: str

    candidates: List[ImageCandidateDTO]




class DetectElementsRequest(BaseModel):

    """POST /ai/ops/detect-elements"""

    image_url: str = Field(..., alias="imageUrl", min_length=1)

    prompt: str = Field(..., min_length=1)

    model_config = {"populate_by_name": True}




class DetectElementsResponse(BaseModel):

    groups: Dict[str, List[str]]




class ExtractElementRequest(BaseModel):

    """POST /ai/ops/extract-element — group / single 提取"""

    source_url: str = Field(..., alias="sourceUrl", min_length=1)

    prompt: str = Field(..., min_length=1)

    count: int = Field(default=2, ge=1, le=4)

    phase: str = Field(default="single", description="group | single")

    model_config = {"populate_by_name": True}


