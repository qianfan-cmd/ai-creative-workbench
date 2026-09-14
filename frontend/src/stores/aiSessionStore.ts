import { create } from 'zustand'
import type { RagReferenceVO } from '@/api/knowledge'
import {
  CAMPAIGN_ACTIVE_DRAFT_KEY,
  CHAT_ACTIVE_CONVERSATION_KEY,
  KNOWLEDGE_ACTIVE_SESSION_KEY,
  readStoredId,
  writeStoredId,
} from '@/constants/aiSessionKeys'

export type AiStreamModule = 'chat' | 'rag' | 'campaign'
export type AiStreamStatus = 'streaming' | 'done' | 'error' | 'aborted'

export type RagPhase = 'retrieving' | 'generating' | 'done' | 'error'

export interface AiStreamEntry {
  key: string
  module: AiStreamModule
  status: AiStreamStatus
  accumulatedText: string
  references: RagReferenceVO[]
  phase?: RagPhase
  errorMessage?: string
  meta: Record<string, unknown>
}

interface AiSessionState {
  activeChatConversationId: number | null
  activeKnowledgeSessionId: number | null
  activeCampaignDraftId: number | null
  streams: Record<string, AiStreamEntry>
  abortControllers: Record<string, AbortController>

  setActiveChatConversationId: (id: number | null) => void
  setActiveKnowledgeSessionId: (id: number | null) => void
  setActiveCampaignDraftId: (id: number | null) => void

  upsertStream: (entry: AiStreamEntry) => void
  patchStream: (key: string, patch: Partial<AiStreamEntry>) => void
  appendStreamText: (key: string, chunk: string) => void
  setStreamReferences: (key: string, references: RagReferenceVO[]) => void
  setStreamPhase: (key: string, phase: RagPhase) => void
  finishStream: (key: string, status: AiStreamStatus, errorMessage?: string) => void
  registerAbortController: (key: string, controller: AbortController) => void
  abortStream: (key: string) => void
  removeStream: (key: string) => void
  getStream: (key: string) => AiStreamEntry | undefined
  getStreamsForModule: (module: AiStreamModule, scopeId: number) => AiStreamEntry[]
}

export function chatStreamKey(conversationId: number, assistantMessageId: number) {
  return `chat:${conversationId}:${assistantMessageId}`
}

export function ragStreamKey(sessionId: number, turnDbId: number) {
  return `rag:${sessionId}:${turnDbId}`
}

export function campaignStreamKey(draftId: number) {
  return `campaign:${draftId}:copy`
}

export const useAiSessionStore = create<AiSessionState>((set, get) => ({
  activeChatConversationId: readStoredId(CHAT_ACTIVE_CONVERSATION_KEY),
  activeKnowledgeSessionId: readStoredId(KNOWLEDGE_ACTIVE_SESSION_KEY),
  activeCampaignDraftId: readStoredId(CAMPAIGN_ACTIVE_DRAFT_KEY),
  streams: {},
  abortControllers: {},

  setActiveChatConversationId: (id) => {
    writeStoredId(CHAT_ACTIVE_CONVERSATION_KEY, id)
    set({ activeChatConversationId: id })
  },

  setActiveKnowledgeSessionId: (id) => {
    writeStoredId(KNOWLEDGE_ACTIVE_SESSION_KEY, id)
    set({ activeKnowledgeSessionId: id })
  },

  setActiveCampaignDraftId: (id) => {
    writeStoredId(CAMPAIGN_ACTIVE_DRAFT_KEY, id)
    set({ activeCampaignDraftId: id })
  },

  upsertStream: (entry) =>
    set((state) => ({
      streams: { ...state.streams, [entry.key]: entry },
    })),

  patchStream: (key, patch) =>
    set((state) => {
      const current = state.streams[key]
      if (!current) return state
      return {
        streams: {
          ...state.streams,
          [key]: { ...current, ...patch },
        },
      }
    }),

  appendStreamText: (key, chunk) =>
    set((state) => {
      const current = state.streams[key]
      if (!current) return state
      return {
        streams: {
          ...state.streams,
          [key]: {
            ...current,
            accumulatedText: current.accumulatedText + chunk,
            phase: current.module === 'rag' ? 'generating' : current.phase,
          },
        },
      }
    }),

  setStreamReferences: (key, references) =>
    set((state) => {
      const current = state.streams[key]
      if (!current) return state
      return {
        streams: {
          ...state.streams,
          [key]: {
            ...current,
            references,
            phase: current.module === 'rag' ? 'generating' : current.phase,
          },
        },
      }
    }),

  setStreamPhase: (key, phase) =>
    set((state) => {
      const current = state.streams[key]
      if (!current) return state
      return {
        streams: {
          ...state.streams,
          [key]: { ...current, phase },
        },
      }
    }),

  finishStream: (key, status, errorMessage) =>
    set((state) => {
      const current = state.streams[key]
      if (!current) return state
      const nextControllers = { ...state.abortControllers }
      delete nextControllers[key]
      return {
        abortControllers: nextControllers,
        streams: {
          ...state.streams,
          [key]: {
            ...current,
            status,
            errorMessage,
            phase: current.module === 'rag' ? (status === 'streaming' ? current.phase : 'done') : current.phase,
          },
        },
      }
    }),

  registerAbortController: (key, controller) =>
    set((state) => ({
      abortControllers: { ...state.abortControllers, [key]: controller },
    })),

  abortStream: (key) => {
    const controller = get().abortControllers[key]
    controller?.abort()
  },

  removeStream: (key) =>
    set((state) => {
      const nextStreams = { ...state.streams }
      const nextControllers = { ...state.abortControllers }
      delete nextStreams[key]
      delete nextControllers[key]
      return { streams: nextStreams, abortControllers: nextControllers }
    }),

  getStream: (key) => get().streams[key],

  getStreamsForModule: (module, scopeId) =>
    Object.values(get().streams).filter((s) => {
      if (s.module !== module) return false
      if (module === 'chat') return s.meta.conversationId === scopeId
      if (module === 'rag') return s.meta.sessionId === scopeId
      if (module === 'campaign') return s.meta.draftId === scopeId
      return false
    }),
}))
