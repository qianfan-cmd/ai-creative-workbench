"""图文运营 Ops 接口 — render-prompt / copy stream / image-gen / matting / detect-elements。"""

import json

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas.ops import (
    CopyStreamRequest,
    DetectElementsRequest,
    DetectElementsResponse,
    ExtractElementRequest,
    ImageCandidateDTO,
    ImageGenerateRequest,
    ImageGenerateResponse,
    OpsHealthResponse,
    RenderPromptRequest,
    RenderPromptResponse,
)
from app.services.llm_service import stream_chat_with_messages
from app.services.ops.image_providers.dashscope_wanx import DashScopeWanxAdapter
from app.services.ops.image_providers.seedream import SeedreamAdapter
from app.services.ops.image_router import ImageGenerateResult, generate_images
from app.services.ops.prompt_renderer import render_prompt
from app.services.ops.vision_image_resolver import (
    VisionImageResolver,
    is_download_failure_error,
)
from app.services.ops.vision_service import detect_elements, is_vision_configured

router = APIRouter(prefix="/ai/ops", tags=["ops"])

_DEFAULT_MATTING_PROMPT = "提取画面中的主体对象，背景干净（透明或纯白），边缘清晰自然，适合作为运营素材使用。"


@router.post("/render-prompt", response_model=RenderPromptResponse)
def render_prompt_handler(req: RenderPromptRequest) -> RenderPromptResponse:
    prompt, missing = render_prompt(req.template, req.variables)
    return RenderPromptResponse(prompt=prompt, missing=missing)


@router.get("/health", response_model=OpsHealthResponse)
def health_check() -> OpsHealthResponse:
    return OpsHealthResponse(
        render_prompt=True,
        seedream_configured=SeedreamAdapter().is_configured(),
        dashscope_configured=DashScopeWanxAdapter().is_configured(),
        vision_configured=is_vision_configured(),
        primary_provider="seedream",
    )


@router.post("/copy/stream")
def copy_stream(req: CopyStreamRequest) -> StreamingResponse:
    """活动文案 SSE 流式响应"""

    def event_generator():
        try:
            messages = [{"role": "user", "content": req.prompt}]
            for chunk in stream_chat_with_messages(messages):
                payload = json.dumps(chunk, ensure_ascii=False)
                yield f"event: message\ndata: {payload}\n\n"
            yield "event: done\ndata: [DONE]\n\n"
        except ValueError as e:
            yield f"event: error\ndata: {str(e)}\n\n"
            yield "event: done\ndata: [DONE]\n\n"
        except httpx.HTTPStatusError as e:
            yield f"event: error\ndata: 上游 AI 服务错误: {e.response.status_code}\n\n"
            yield "event: done\ndata: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


def _to_response(result) -> ImageGenerateResponse:
    return ImageGenerateResponse(
        provider=result.provider,
        candidates=[ImageCandidateDTO(url=c.url, index=c.index) for c in result.candidates],
    )


@router.post("/image-gen", response_model=ImageGenerateResponse)
def image_gen_handler(req: ImageGenerateRequest) -> ImageGenerateResponse:
    """Campaign 配图 / library-ai 文生图或图生图。"""
    try:
        result = generate_images(
            job_type="image_gen",
            prompt=req.prompt,
            source_url=req.source_url,
            count=req.count,
            aspect_ratio=req.aspect_ratio,
        )
        return _to_response(result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/matting", response_model=ImageGenerateResponse)
def matting_handler(req: ImageGenerateRequest) -> ImageGenerateResponse:
    """抠图多候选 — 必须提供 sourceUrl。"""
    if not req.source_url:
        raise HTTPException(status_code=400, detail="抠图需要 sourceUrl")
    prompt = req.prompt.strip() or _DEFAULT_MATTING_PROMPT
    try:
        result = generate_images(
            job_type="matting",
            prompt=prompt,
            source_url=req.source_url,
            count=req.count,
            aspect_ratio=req.aspect_ratio,
        )
        return _to_response(result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/detect-elements", response_model=DetectElementsResponse)
def detect_elements_handler(req: DetectElementsRequest) -> DetectElementsResponse:
    """视觉模型识别图片中的分组元素名称。"""
    try:
        groups, strategy = detect_elements(
            region_prompt=req.prompt,
            image_url=req.image_url,
            image_base64=req.image_base64,
        )
        return DetectElementsResponse(groups=groups, resolve_strategy=strategy)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/extract-element", response_model=ImageGenerateResponse)
def extract_element_handler(req: ExtractElementRequest) -> ImageGenerateResponse:
    """按 group / single prompt 从源图提取元素候选。"""
    try:
        result = _extract_element_generate(req)
        return _to_response(result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


def _extract_element_generate(req: ExtractElementRequest) -> ImageGenerateResult:
    """解析图源（公网 URL / inline base64 / 本地拉取）后调用 Seedream。"""
    resolved = VisionImageResolver.resolve(
        image_url=req.source_url,
        image_base64=req.image_base64,
    )
    try:
        return generate_images(
            job_type="matting",
            prompt=req.prompt,
            source_url=resolved.payload_url,
            count=req.count,
            aspect_ratio=None,
        )
    except ValueError as e:
        err_msg = str(e)
        if (
            resolved.strategy_used == "L1_public_url"
            and req.source_url
            and is_download_failure_error(err_msg)
        ):
            fallback = VisionImageResolver.resolve_fallback_from_url(req.source_url)
            return generate_images(
                job_type="matting",
                prompt=req.prompt,
                source_url=fallback.payload_url,
                count=req.count,
                aspect_ratio=None,
            )
        raise
