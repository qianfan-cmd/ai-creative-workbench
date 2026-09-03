import request from '@/api/request'
import type { ApiResponse } from '@/types/api'
import { getToken } from '@/utils/token'

export type WorkflowContext = 'matting' | 'campaign'
export type WorkflowSourceType = 'upload' | 'library' | 'ai_gen'

export interface WorkflowSourceVO {
  id: number
  context: WorkflowContext
  sourceType: WorkflowSourceType
  imageUrl: string
  assetId?: number
  originalName?: string
  size?: number
  contentType?: string
  selected?: boolean
  sortOrder?: number
  prompt?: string
  aspectRatio?: string
  referenceUrls?: string[]
  generationJobId?: number
}

export async function listWorkflowSourcesApi(params: {
  context: WorkflowContext
  taskId?: number
  draftId?: number
}) {
  const res = await request.get<ApiResponse<WorkflowSourceVO[]>>('/ops/workflow-sources', { params })
  return res.data.data
}

export async function listSelectedWorkflowSourcesApi(params: {
  context: WorkflowContext
  taskId?: number
  draftId?: number
}) {
  const res = await request.get<ApiResponse<WorkflowSourceVO[]>>('/ops/workflow-sources/selected-preview', {
    params,
  })
  return res.data.data
}

export async function uploadWorkflowSourceApi(
  file: File,
  params: { context: WorkflowContext; taskId?: number; draftId?: number },
  options?: { onProgress?: (pct: number) => void },
) {
  const form = new FormData()
  form.append('file', file)
  const token = getToken()
  const qs = new URLSearchParams()
  qs.set('context', params.context)
  if (params.taskId != null) qs.set('taskId', String(params.taskId))
  if (params.draftId != null) qs.set('draftId', String(params.draftId))

  const res = await request.post<ApiResponse<WorkflowSourceVO>>(
    `/ops/workflow-sources/upload?${qs.toString()}`,
    form,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      onUploadProgress: options?.onProgress
        ? (e) => {
            if (e.total) options.onProgress!(Math.round((e.loaded / e.total) * 100))
          }
        : undefined,
    },
  )
  return res.data.data
}

export async function addWorkflowSourcesFromLibraryApi(body: {
  context: WorkflowContext
  taskId?: number
  draftId?: number
  assetIds: number[]
}) {
  const res = await request.post<ApiResponse<WorkflowSourceVO[]>>('/ops/workflow-sources/from-library', body)
  return res.data.data
}

export async function patchWorkflowSourceApi(id: number, body: { selected?: boolean }) {
  const res = await request.patch<ApiResponse<WorkflowSourceVO>>(`/ops/workflow-sources/${id}`, body)
  return res.data.data
}

export async function deleteWorkflowSourceApi(id: number) {
  await request.delete<ApiResponse<null>>(`/ops/workflow-sources/${id}`)
}

export async function generateCampaignWorkflowAiApi(body: {
  draftId: number
  prompt: string
  referenceUrls?: string[]
  count?: number
  aspectRatio?: string
}) {
  const res = await request.post<ApiResponse<WorkflowSourceVO[]>>(
    '/ops/workflow-sources/generate-ai',
    { context: 'campaign', ...body },
    { timeout: 180000 },
  )
  return res.data.data
}

export function workflowSourcesToPreviewUrls(sources: WorkflowSourceVO[], max = 9): string[] {
  return sources
    .filter((s) => s.selected && s.imageUrl)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id)
    .map((s) => s.imageUrl)
    .slice(0, max)
}

export function workflowSourceToScheme(s: WorkflowSourceVO) {
  return {
    id: String(s.id),
    imageUrl: s.imageUrl,
    assetId: s.assetId,
    prompt: s.prompt,
    aspectRatio: s.aspectRatio,
    referenceUrls: s.referenceUrls,
    selected: s.selected,
    generationJobId: s.generationJobId,
  }
}

export function uploadSourcesToAssetLike(sources: WorkflowSourceVO[]) {
  return sources
    .filter((s) => s.sourceType === 'upload')
    .map((s) => ({
      id: s.id,
      name: s.originalName ?? '上传图片',
      url: s.imageUrl,
      path: '',
      size: s.size ?? 0,
      type: s.contentType ?? 'image/png',
      createdAt: '',
      tags: [],
    }))
}
