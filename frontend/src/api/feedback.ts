import request from '@/api/request'
import type { ApiResponse } from '@/types/api'

export type AiFeedbackScene = 'rag' | 'chat' | 'image_gen'
export type AiFeedbackRefType = 'knowledge_turn' | 'message' | 'generation_job'
export type AiFeedbackRating = 'up' | 'down'
export type AiFeedbackReason = 'incomplete_list' | 'wrong_fact' | 'irrelevant' | 'other'

export interface AiFeedbackVO {
  id: number
  scene: AiFeedbackScene
  refType: AiFeedbackRefType
  refId: number
  rating: AiFeedbackRating
  reason?: string
  reasonDetail?: string
  createdAt?: string
}

export interface SubmitFeedbackPayload {
  scene: AiFeedbackScene
  refType: AiFeedbackRefType
  refId: number
  rating: AiFeedbackRating
  reason?: AiFeedbackReason
  reasonDetail?: string
}

export async function submitFeedbackApi(payload: SubmitFeedbackPayload) {
  const res = await request.post<ApiResponse<AiFeedbackVO>>('/feedback', payload)
  return res.data.data
}
