import request from "@/api/request";
import { API_TIMEOUT_BATCH, API_TIMEOUT_HEAVY } from '@/api/timeouts'
import type { TagVO } from '@/api/tags'
import type { ApiResponse, PageResult } from "@/types/api";
import { getToken } from "@/utils/token"

/** 上传入库结果 */
export interface KnowledgeIndexUploadVO {
    filename: string
    charCount: number
    chunkCount: number
    indexedCount: number
}

export interface KnowledgeUploadFailureVO {
    filename: string
    reason: string
}

export interface KnowledgeBatchUploadVO {
    total: number
    succeeded: KnowledgeIndexUploadVO[]
    failed: KnowledgeUploadFailureVO[]
}

export interface KnowledgeDeleteFailureVO {
    id: number
    reason: string
}

export interface KnowledgeBatchDeleteVO {
    total: number
    deletedIds: number[]
    failures: KnowledgeDeleteFailureVO[]
}

export const KNOWLEDGE_MAX_BATCH_UPLOAD = 20
/** 前端分片：每批请求最多文件数，避免单次 HTTP 等待整批入库超时 */
export const KNOWLEDGE_UPLOAD_CHUNK_SIZE = 5

/** 引用片段 */
export interface RagReferenceVO {
    content: string
    source?: string
    index?: number
}

/** RAG 问答结果 */
export interface RagQueryVO {
    answer: string
    references: RagReferenceVO[]
}

/** 已索引文档（文档库） */
export interface KnowledgeDocumentVO {
    id: number
    filename: string
    fileType?: string
    fileSize?: number
    charCount?: number
    chunkCount: number
    createdAt?: string
    hasOriginalFile?: boolean
    tags?: TagVO[]
}

export interface ListKnowledgeDocumentsParams {
    page?: number
    size?: number
    keyword?: string
    sort?: 'asc' | 'desc'
}

export interface KnowledgeDocumentContentVO {
    id: number
    filename: string
    fileType?: string
    content: string
}

/** 历史会话侧栏项 */
export interface KnowledgeSessionVO {
    id: number
    title: string
    pinned?: boolean
    updatedAt?: string
}

/** 持久化后的 turn（含服务端 id） */
export interface KnowledgeTurnVO {
    id: number
    question: string
    answer: string
    references: RagReferenceVO[]
    userFeedbackRating?: 'up' | 'down'
}

export interface KnowledgeSessionDetailVO {
    id: number
    title: string
    turns: KnowledgeTurnVO[]
}

/**
 * 分页获取文档库列表
 */
export async function listKnowledgeDocumentsPageApi(params: ListKnowledgeDocumentsParams = {}) {
    const res = await request.get<ApiResponse<PageResult<KnowledgeDocumentVO>>>('/knowledge/documents', {
        params,
    })
    return res.data.data
}

/**
 * 侧栏最近文档（轻量列表）
 */
export async function listRecentKnowledgeDocumentsApi(limit = 50) {
    const res = await request.get<ApiResponse<KnowledgeDocumentVO[]>>('/knowledge/documents/recent', {
        params: { limit },
    })
    return res.data.data
}

export async function patchKnowledgeDocumentApi(id: number, payload: { filename: string }) {
    const res = await request.patch<ApiResponse<KnowledgeDocumentVO>>(
        `/knowledge/documents/${id}`,
        payload,
        { timeout: API_TIMEOUT_HEAVY },
    )
    return res.data.data
}

export async function deleteKnowledgeDocumentApi(id: number) {
    await request.delete<ApiResponse<null>>(`/knowledge/documents/${id}`, {
        timeout: API_TIMEOUT_BATCH,
    })
}

export async function getKnowledgeDocumentTagsApi(id: number) {
    const res = await request.get<ApiResponse<TagVO[]>>(`/knowledge/documents/${id}/tags`)
    return res.data.data
}

export async function updateKnowledgeDocumentTagsApi(id: number, tagIds: number[]) {
    const res = await request.put<ApiResponse<TagVO[]>>(`/knowledge/documents/${id}/tags`, { tagIds })
    return res.data.data
}

export async function getKnowledgeDocumentContentApi(id: number) {
    const res = await request.get<ApiResponse<KnowledgeDocumentContentVO>>(
        `/knowledge/documents/${id}/content`,
    )
    return res.data.data
}

export async function saveKnowledgeDocumentContentApi(id: number, content: string) {
    const res = await request.put<ApiResponse<KnowledgeDocumentVO>>(
        `/knowledge/documents/${id}/content`,
        { content },
        { timeout: API_TIMEOUT_HEAVY },
    )
    return res.data.data
}

/** 历史会话列表 */
export async function listKnowledgeSessionsApi() {
    const res = await request.get<ApiResponse<KnowledgeSessionVO[]>>('/knowledge/sessions')
    return res.data.data
}

export async function createKnowledgeSessionApi() {
    const res = await request.post<ApiResponse<KnowledgeSessionVO>>('/knowledge/sessions')
    return res.data.data
}

export async function getKnowledgeSessionApi(sessionId: number) {
    const res = await request.get<ApiResponse<KnowledgeSessionDetailVO>>(
        `/knowledge/sessions/${sessionId}`,
    )
    return res.data.data
}

export async function deleteKnowledgeSessionApi(sessionId: number) {
    await request.delete<ApiResponse<null>>(`/knowledge/sessions/${sessionId}`)
}

export async function patchKnowledgeSessionApi(
    sessionId: number,
    payload: { title?: string; pinned?: boolean },
) {
    const res = await request.patch<ApiResponse<KnowledgeSessionVO>>(
        `/knowledge/sessions/${sessionId}`,
        payload,
    )
    return res.data.data
}

export async function saveKnowledgeTurnApi(
    sessionId: number,
    payload: { question: string; answer: string; references: RagReferenceVO[] },
) {
    const res = await request.post<ApiResponse<KnowledgeTurnVO>>(
        `/knowledge/sessions/${sessionId}/turns`,
        payload,
    )
    return res.data.data
}

export async function updateKnowledgeTurnApi(
    sessionId: number,
    turnId: number,
    payload: { question: string; answer: string; references: RagReferenceVO[] },
) {
    const res = await request.put<ApiResponse<KnowledgeTurnVO>>(
        `/knowledge/sessions/${sessionId}/turns/${turnId}`,
        payload,
    )
    return res.data.data
}

/**
 * 批量上传文档：POST /knowledge/documents/upload，服务端并发入库并写 Chroma。
 * 前端大文件列表应分片（见 KNOWLEDGE_UPLOAD_CHUNK_SIZE）避免 HTTP 超时。
 */
export async function uploadKnowledgeDocumentsApi(files: File[]) {
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))

    const res = await request.post<ApiResponse<KnowledgeBatchUploadVO>>(
        '/knowledge/documents/upload',
        formData,
        {
            // 勿手动设 Content-Type，让浏览器自动带 multipart boundary
            timeout: API_TIMEOUT_HEAVY,
        },
    )
    return res.data.data
}

/** 批量删除文档：逐条删 MySQL + 向量 + 磁盘，部分失败仍返回 failures 列表。 */
export async function batchDeleteKnowledgeDocumentsApi(ids: number[]) {
    const res = await request.post<ApiResponse<KnowledgeBatchDeleteVO>>(
        '/knowledge/documents/batch-delete',
        { ids },
        { timeout: API_TIMEOUT_BATCH },
    )
    return res.data.data
}

export interface RagStreamHandlers {
    onReferences: (references: RagReferenceVO[]) => void;
    onChunk: (chunk: string) => void;
    onDone: () => void;
}

export interface RagStreamOptions {
    topK?: number
    /** 同会话 id — Java 从 knowledge_turn 加载 prior Q/A */
    sessionId?: number
    /** 重新生成时排除的 turn dbId */
    excludeTurnId?: number
    signal?: AbortSignal
}

/** RAG 流式问答：fetch SSE /api/rag/query/stream，先 references 再 answer 增量。 */
export async function ragStreamApi(
    question: string,
    handlers: RagStreamHandlers,
    options: RagStreamOptions = {},
  ) {
    const { topK = 6, sessionId, excludeTurnId, signal } = options
    const token = getToken()

    const body: Record<string, unknown> = { question, topK }
    if (sessionId != null) body.sessionId = sessionId
    if (excludeTurnId != null) body.excludeTurnId = excludeTurnId

    const res = await fetch('/api/rag/query/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => null)
      throw new Error(errBody?.message || `请求失败 (${res.status})`)
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('浏览器不支持流式响应')

    const decoder = new TextDecoder()
    let buffer = ''
    let currentEvent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim()
          continue
        }

        if (line.startsWith('data:')) {
          const data = line.slice(5).trim()

          if (currentEvent === 'done' || data === '[DONE]') {
            handlers.onDone()
          } else if (currentEvent === 'references') {
            handlers.onReferences(JSON.parse(data) as RagReferenceVO[])
          } else if (currentEvent === 'error') {
            throw new Error(data)
          } else if (currentEvent === 'message') {
            // Python 用 json.dumps 包装 chunk，还原含换行的 Markdown
            let chunk = data
            try {
              chunk = JSON.parse(data) as string
            } catch {
              // 兼容旧格式裸文本（Python 未重启时）
            }
            handlers.onChunk(chunk)
          }
          continue
        }

        if (line === '') currentEvent = ''
      }
    }
    
    handlers.onDone()
  }