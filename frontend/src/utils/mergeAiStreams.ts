import type { RagReferenceVO } from '@/api/knowledge'

export interface ChatMessageView {
  id: string
  role: 'user' | 'assistant'
  content: string
  imageUrls?: string[]
  streaming?: boolean
  dbId?: number
  feedbackRating?: 'up' | 'down'
}
import {
  chatStreamKey,
  ragStreamKey,
  type AiStreamEntry,
  type RagPhase,
} from '@/stores/aiSessionStore'

export interface RagTurnView {
  id: string
  dbId?: number
  question: string
  answer: string
  references: RagReferenceVO[]
  streaming?: boolean
  phase?: RagPhase
  feedbackRating?: 'up' | 'down'
}

export function mergeChatMessagesWithStreams(
  messages: ChatMessageView[],
  conversationId: number | null,
  streams: Record<string, AiStreamEntry>,
): ChatMessageView[] {
  if (conversationId == null) return messages

  return messages.map((msg) => {
    if (msg.role !== 'assistant' || msg.dbId == null) return msg
    const stream = streams[chatStreamKey(conversationId, msg.dbId)]
    if (!stream) {
      if (!msg.content && msg.role === 'assistant') {
        return { ...msg, streaming: false }
      }
      return msg
    }
    if (stream.status === 'streaming') {
      return {
        ...msg,
        content: stream.accumulatedText || msg.content,
        streaming: true,
      }
    }
    if (stream.accumulatedText) {
      return { ...msg, content: stream.accumulatedText, streaming: false }
    }
    return { ...msg, streaming: false }
  })
}

export function mergeRagTurnsWithStreams(
  turns: RagTurnView[],
  sessionId: number | null,
  streams: Record<string, AiStreamEntry>,
): RagTurnView[] {
  if (sessionId == null) return turns

  return turns.map((turn) => {
    if (!turn.dbId) return turn
    const stream = streams[ragStreamKey(sessionId, turn.dbId)]
    if (!stream) {
      if (!turn.answer?.trim() && turn.question) {
        return { ...turn, phase: 'error' as RagPhase, streaming: false }
      }
      return turn
    }
    if (stream.status === 'streaming') {
      return {
        ...turn,
        answer: stream.accumulatedText,
        references: stream.references.length > 0 ? stream.references : turn.references,
        streaming: true,
        phase: stream.phase ?? turn.phase,
      }
    }
    if (stream.accumulatedText || stream.references.length > 0) {
      return {
        ...turn,
        answer: stream.accumulatedText || turn.answer,
        references: stream.references.length > 0 ? stream.references : turn.references,
        streaming: false,
        phase: 'done',
      }
    }
    return { ...turn, streaming: false }
  })
}

export function isChatStreaming(conversationId: number | null, streams: Record<string, AiStreamEntry>) {
  if (conversationId == null) return false
  return Object.values(streams).some(
    (s) => s.module === 'chat' && s.meta.conversationId === conversationId && s.status === 'streaming',
  )
}

export function isRagStreaming(sessionId: number | null, streams: Record<string, AiStreamEntry>) {
  if (sessionId == null) return false
  return Object.values(streams).some(
    (s) => s.module === 'rag' && s.meta.sessionId === sessionId && s.status === 'streaming',
  )
}

export function isCampaignCopyStreaming(
  draftId: number | null,
  streams: Record<string, AiStreamEntry>,
) {
  if (draftId == null) return false
  return Object.values(streams).some(
    (s) => s.module === 'campaign' && s.meta.draftId === draftId && s.status === 'streaming',
  )
}
