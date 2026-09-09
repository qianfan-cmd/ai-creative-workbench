import request from '@/api/request'
import { API_TIMEOUT_HEAVY } from '@/api/timeouts'

import type { ApiResponse } from '@/types/api'



export interface RagFeedbackActionItem {

  id: number

  feedbackId?: number

  turnId?: number

  triageStep?: number

  actionType: string

  detailJson?: string

  status: string

  createdAt: string

}



export interface AiFeedbackDownItem {

  id: number

  userId: number

  username: string

  scene: string

  refType: string

  refId: number

  reason?: string

  reasonDetail?: string

  summary: string

  createdAt: string

  ragActions?: RagFeedbackActionItem[]

}



export interface AiFeedbackStats {

  upCount: number

  downCount: number

  ragUp: number

  ragDown: number

  chatUp: number

  chatDown: number

  recentDowns: AiFeedbackDownItem[]

  recentRagActions?: RagFeedbackActionItem[]

}



export async function getAdminFeedbackStatsApi(recentLimit = 20) {

  const res = await request.get<ApiResponse<AiFeedbackStats>>('/admin/feedback/stats', {

    params: { recentLimit },

  })

  return res.data.data

}



export interface RagSourceSignalItem {

  source: string

  penalty: number

  boost: number

  updatedAt: string

}



export type RagSourceSignalClearField = 'penalty' | 'boost' | 'all'



export interface KnowledgeReindexFailure {

  id: number

  filename: string

  reason: string

}



export interface KnowledgeReindexAllResult {

  total: number

  succeeded: number

  failed: KnowledgeReindexFailure[]

}



export async function listSourceSignalsApi() {

  const res = await request.get<ApiResponse<RagSourceSignalItem[]>>('/admin/rag/source-signals')

  return res.data.data

}



export async function clearSourceSignalApi(source: string, field: RagSourceSignalClearField) {

  await request.post('/admin/rag/source-signals/clear', { source, field })

}



export async function reindexAllKnowledgeApi() {

  const res = await request.post<ApiResponse<KnowledgeReindexAllResult>>(
    '/admin/knowledge/reindex-all',
    {},
    { timeout: API_TIMEOUT_HEAVY },
  )

  return res.data.data

}


