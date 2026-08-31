import request from "@/api/request"
import type { ApiResponse } from "@/types/api"
import { getToken } from "@/utils/token"

/** 与后端 CampaignDraftVO 对齐 */
export interface CampaignDraftVO {
    id: number
    title: string
    activity: Record<string, string>
    copyTitle?: string | null
    copyBody?: string | null
    status: string
    coverAssetId?: number | null
    coverUrl?: string | null
    imageAssetIds?: number[]
    updatedAt?: string
}

export interface ImageCandidateVO {
    url: string
    index: number
}

export interface GenerationJobVO {
    id: number
    jobType: string
    status: string
    providerUsed?: string
    candidates: ImageCandidateVO[]
    errorMessage?: string
    createdAt?: string
}

export interface MattingTaskVO {
    id: number
    title: string
    stage: number
    status: string
    sourceAssetId?: number | null
    sourceAssetUrl?: string | null
    configJson?: string | null
    selectedCandidate?: string | null
    updatedAt?: string
}
  /** 左栏表单 — 与 CampaignDraftCreateRequest 字段一致 */
export interface CampaignActivityForm {
    theme: string
    timeRange?: string
    audience?: string
    benefits?: string
    visualStyle?: string
    aspectRatio?: string
    forbiddenWords?: string
}
export interface PromptTemplateVO {
    id: number
    name: string
    scene: string
}
export interface GenerateCopyOptions {
    mode: 'draft' | 'refine'
    styleTemplateId?: number
    hint?: string // 文案优化时的补充说明
    onChunk: (chunk: string) => void
    onDone: () => void
}

/** 创建草稿 */
export async function createCampaignDraft(form: CampaignActivityForm) {
    const res = await request.post<ApiResponse<CampaignDraftVO>>('/ops/campaign/draft', form);
    return res.data.data;
}

export async function getCampaignDraftApi(id: number) {
    const res = await request.get<ApiResponse<CampaignDraftVO>>(`/ops/campaign/${id}`)
    return res.data.data
}

/** 保存左栏活动表单 */
  export async function updateCampaignDraftApi(id: number, form: CampaignActivityForm) {
    const res = await request.put<ApiResponse<CampaignDraftVO>>(`/ops/campaign/${id}`, form)
    return res.data.data
}

/** SSE 结束后保存文案 — 后端为 PUT /api/ops/campaign/{id}/copy */
export async function saveCampaignCopyApi(
    id: number,
    payload: { copyTitle: string; copyBody: string },
) {
    const res = await request.put<ApiResponse<CampaignDraftVO>>(`/ops/campaign/${id}/copy`, payload)
    return res.data.data
}

/**
 * 拉取风格优化模板 - 前端过滤 copy_style_*
 * 用户下拉看到的是 name， 不是prompt原文
 */
export async function getStyleTemplateApi() {
    const res = await request.get<ApiResponse<PromptTemplateVO[]>>('/prompts');
    return res.data.data.filter((t) => t.scene.startsWith('copy_style_'));
}

/**
 * 活动文案 SSE
 */
export async function generateCopyStreamApi(
    draftId: number,
    options: GenerateCopyOptions,
    signal?: AbortSignal,
) {
    const token = getToken();

    const res = await fetch(`/api/ops/campaign/${draftId}/generate-copy`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
            mode: options.mode,
            ...(options.styleTemplateId != null ? { styleTemplateId: options.styleTemplateId } : {}),
            ...(options.hint ? { hint: options.hint } : {})
        }),
        signal,
    })

    if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message || `请求失败 (${res.status})`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('浏览器不支持流式响应');

    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        /** decode(buffer, options) buffer 是已解码的字符串，options 是解码选项 */
        buffer += decoder.decode(value, { stream: true});
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('event:')) {
                currentEvent = line.slice(6).trim();
                continue;
            }

            if (line.startsWith('data:')) {
                const data = line.slice(5).trim();

                if (currentEvent === 'done' || data === '[DONE]') {
                    options.onDone();
                } else if (currentEvent === 'error') {
                    throw new Error(data);
                } else if (currentEvent === 'message') {
                    let chunk = data;
                    try {
                        chunk = JSON.parse(data) as string
                    } catch (err) {
                        console.error('解析 SSE 消息失败:', err);
                    }
                    options.onChunk(chunk)
                }
                continue;
            }

            if (line === '') currentEvent = '';
        }
    }

    options.onDone()
}

/**
 * seed 模板要求 LLM 输出 JSON：{"title":"...","body":"..."}
 * 解析成功则用于 PUT /copy；失败则降级为整段正文或正则提取。
 */
export function parseCampaignCopyFromLlm(raw: string): {
  copyTitle: string
  copyBody: string
} | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const jsonText = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    const obj = JSON.parse(jsonText) as { title?: string; body?: string }
    if (obj.title?.trim() && obj.body?.trim()) {
      return { copyTitle: obj.title.trim(), copyBody: obj.body.trim() }
    }
  } catch {
    // 继续尝试正则提取（模型偶发未闭合 JSON）
  }

  const titleMatch = jsonText.match(/"title"\s*:\s*"((?:\\.|[^"\\])*)"/)
  const bodyMatch = jsonText.match(/"body"\s*:\s*"((?:\\.|[^"\\])*)"/s)
  if (titleMatch && bodyMatch) {
    const unescape = (s: string) =>
      s.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    const copyTitle = unescape(titleMatch[1]).trim()
    const copyBody = unescape(bodyMatch[1]).trim()
    if (copyTitle && copyBody) {
      return { copyTitle, copyBody }
    }
  }

  return null
}

export interface MattingElementsVO {
  regions: MattingRegionVO[]
  detectStatus?: string
  detectError?: string
  candidateCount?: number
}

export interface MattingRegionVO {
  regionId: string
  regionLabel: string
  imageUrl?: string
  groups: MattingGroupVO[]
}

export interface MattingGroupVO {
  groupName: string
  elements: MattingElementRowVO[]
}

export interface MattingElementRowVO {
  id: string
  regionId: string
  groupName: string
  elementName: string
  checked: boolean
  createType?: string
}

export interface MattingExtractStatusVO {
  extractStatus?: string
  extractError?: string
  candidateCount?: number
  elements: MattingElementExtractVO[]
}

export interface MattingElementExtractVO {
  elementId: string
  elementName: string
  groupName: string
  status?: string
  errorMessage?: string
  images: MattingImageSlotVO[]
  selectedSlotIndex?: number | null
}

export interface MattingImageSlotVO {
  slotIndex?: number
  url?: string
  selected?: boolean
  status?: string
}

export interface MattingCropRegionItem {
  id: string
  xPct: number
  yPct: number
  wPct: number
  hPct: number
  subAssetId?: number
}

/** GET crop-regions：从 config_json 恢复框选 UI（对齐美术机台 crop/list） */
export interface MattingCropRegionsVO {
  useOriginal?: boolean
  regions?: MattingCropRegionItem[]
}

/** GET crop-regions：只读，从 config_json 恢复框选 UI（进入步骤②时调用一次） */
export async function getMattingCropRegionsApi(id: number) {
  const res = await request.get<ApiResponse<MattingCropRegionsVO>>(`/ops/matting/tasks/${id}/crop-regions`)
  return res.data.data
}

export async function generateOpsImageApi(body: { prompt: string; count?: number; sourceUrl?: string }) {
  const res = await request.post<ApiResponse<GenerationJobVO>>('/ops/image-gen', body, { timeout: 180000 })
  return res.data.data
}

export async function saveMattingCropRegionsApi(
  id: number,
  body: { regions?: MattingCropRegionItem[]; useOriginal?: boolean; /** 草稿 PUT：仅保存坐标；正式保存勿带 draft */ draft?: boolean },
) {
  const res = await request.put<ApiResponse<MattingTaskVO>>(`/ops/matting/tasks/${id}/crop-regions`, body)
  return res.data.data
}

export async function confirmMattingCropApi(id: number) {
  const res = await request.post<ApiResponse<MattingTaskVO>>(`/ops/matting/tasks/${id}/crop/confirm`, {}, { timeout: 180000 })
  return res.data.data
}

export async function getMattingElementsApi(id: number) {
  const res = await request.get<ApiResponse<MattingElementsVO>>(`/ops/matting/tasks/${id}/elements`)
  return res.data.data
}

export async function patchMattingElementsApi(
  id: number,
  elements: { id: string; elementName?: string; checked?: boolean; deleted?: boolean }[],
) {
  const res = await request.patch<ApiResponse<MattingElementsVO>>(`/ops/matting/tasks/${id}/elements`, { elements })
  return res.data.data
}

export async function reDetectMattingRegionApi(id: number, regionId: string) {
  const res = await request.post<ApiResponse<MattingTaskVO>>(
    `/ops/matting/tasks/${id}/elements/re-detect?regionId=${encodeURIComponent(regionId)}`,
    {},
    { timeout: 180000 },
  )
  return res.data.data
}

export async function confirmMattingExtractApi(id: number, candidateCount: number) {
  const res = await request.post<ApiResponse<MattingTaskVO>>(
    `/ops/matting/tasks/${id}/extract/confirm`,
    { candidateCount },
  )
  return res.data.data
}

export async function getMattingExtractStatusApi(id: number) {
  const res = await request.get<ApiResponse<MattingExtractStatusVO>>(`/ops/matting/tasks/${id}/extract/status`)
  return res.data.data
}

export async function saveMattingElementsApi(
  id: number,
  items: { elementId: string; candidateUrl: string; name?: string }[],
) {
  const res = await request.post<ApiResponse<{ id: number; url: string; name: string }[]>>(
    `/ops/matting/tasks/${id}/elements/save`,
    { items },
  )
  return res.data.data
}

export async function getMattingPromptTemplatesApi() {
    const res = await request.get<ApiResponse<PromptTemplateVO[]>>('/prompts')
    return res.data.data.filter((t) => t.scene === 'matting')
}

export async function listMattingTasksApi() {
    const res = await request.get<ApiResponse<MattingTaskVO[]>>('/ops/matting/tasks')
    return res.data.data
}

export async function createMattingTaskApi(title: string) {
    const res = await request.post<ApiResponse<MattingTaskVO>>('/ops/matting/tasks', { title })
    return res.data.data
}

export async function getMattingTaskApi(id: number) {
    const res = await request.get<ApiResponse<MattingTaskVO>>(`/ops/matting/tasks/${id}`)
    return res.data.data
}

export async function patchMattingTaskApi(id: number, body: Partial<MattingTaskVO> & { configJson?: string }) {
    const res = await request.patch<ApiResponse<MattingTaskVO>>(`/ops/matting/tasks/${id}`, body)
    return res.data.data
}

export async function generateMattingApi(id: number, body?: { prompt?: string; count?: number }) {
    const res = await request.post<ApiResponse<GenerationJobVO>>(
        `/ops/matting/tasks/${id}/generate`,
        body ?? {},
        { timeout: 180000 },
    )
    return res.data.data
}

export async function saveMattingToAssetsApi(id: number, candidateUrl: string, name?: string) {
    const res = await request.post<ApiResponse<{ id: number; url: string; name: string }>>(
        `/ops/matting/tasks/${id}/save`,
        { candidateUrl, name },
    )
    return res.data.data
}

export async function getMattingHistoryApi(id: number) {
    const res = await request.get<ApiResponse<GenerationJobVO[]>>(`/ops/matting/tasks/${id}/history`)
    return res.data.data
}

export async function generateCampaignImagesApi(
    draftId: number,
    body?: { sourceAssetId?: number; promptOverride?: string; count?: number },
) {
    const res = await request.post<ApiResponse<GenerationJobVO>>(
        `/ops/campaign/${draftId}/generate-images`,
        body ?? {},
        { timeout: 180000 },
    )
    return res.data.data
}

export async function saveCampaignImagesApi(
    draftId: number,
    body: { coverAssetId?: number; imageAssetIds?: number[] },
) {
    const res = await request.put<ApiResponse<CampaignDraftVO>>(`/ops/campaign/${draftId}/images`, body)
    return res.data.data
}

export async function exportCampaignDraftApi(draftId: number) {
    const token = getToken()
    const res = await fetch(`/api/ops/campaign/${draftId}/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error('导出失败')
    return res.blob()
}