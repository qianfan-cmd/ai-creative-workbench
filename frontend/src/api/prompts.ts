import request from '@/api/request'
import type { ApiResponse } from '@/types/api'

export interface PromptTemplateVO {
  id: number
  userId?: number | null
  name: string
  scene: string
  content: string
  createdAt?: string
  updatedAt?: string
}

export interface PromptTemplatePayload {
  name: string
  scene: string
  content: string
}

export async function listPromptsApi(scene?: string) {
  const res = await request.get<ApiResponse<PromptTemplateVO[]>>('/prompts', {
    params: scene ? { scene } : undefined,
  })
  return res.data.data
}

export async function getPromptApi(id: number) {
  const res = await request.get<ApiResponse<PromptTemplateVO>>(`/prompts/${id}`)
  return res.data.data
}

export async function createPromptApi(payload: PromptTemplatePayload) {
  const res = await request.post<ApiResponse<PromptTemplateVO>>('/prompts', payload)
  return res.data.data
}

export async function updatePromptApi(id: number, payload: PromptTemplatePayload) {
  const res = await request.put<ApiResponse<PromptTemplateVO>>(`/prompts/${id}`, payload)
  return res.data.data
}

export async function deletePromptApi(id: number) {
  await request.delete<ApiResponse<null>>(`/prompts/${id}`)
}

/** 系统内置模板（不可编辑/删除） */
export function isSystemPrompt(template: PromptTemplateVO) {
  return template.userId == null
}

/** scene 分组展示文案（Tag 用） */
export function getPromptSceneLabel(scene: string): string {
  if (scene === 'copy_draft') return '文案初稿'
  if (scene.startsWith('copy_style_')) return '文案风格'
  if (scene.startsWith('campaign_visual_')) return '视觉风格'
  if (scene === 'image_gen') return '配图生成'
  if (scene.startsWith('matting')) return '抠图'
  return '其它'
}

const SCENE_DISPLAY_NAMES: Record<string, string> = {
  copy_draft: '文案初稿',
  copy_style_playful: '活泼推送',
  copy_style_formal: '正式公告',
  copy_style_push: '强转化推送',
  copy_style_custom: '自定义文案风格',
  campaign_visual_summer: '夏日清新',
  campaign_visual_esports: '电竞热血',
  campaign_visual_minimal: '简约正式',
  campaign_visual_custom: '自定义视觉风格',
  image_gen: '配图生成',
  matting: '抠图',
}

/** 用户可见的模板类型名称（隐藏 copy_style_* 等内部 code） */
export function getSceneDisplayName(scene: string): string {
  if (SCENE_DISPLAY_NAMES[scene]) return SCENE_DISPLAY_NAMES[scene]
  if (scene.startsWith('copy_style_')) return '文案风格'
  if (scene.startsWith('campaign_visual_')) return '视觉风格'
  if (scene.startsWith('matting')) return '抠图'
  return getPromptSceneLabel(scene)
}
