import { chatStreamApi, updateChatAssistantApi } from '@/api/chat'
import {
  ragStreamApi,
  updateKnowledgeTurnApi,
  type RagReferenceVO,
} from '@/api/knowledge'
import {
  buildCampaignCopyPayload,
  generateCopyStreamApi,
  saveCampaignCopyApi,
} from '@/api/ops'
import {
  campaignStreamKey,
  chatStreamKey,
  ragStreamKey,
  useAiSessionStore,
  type AiStreamEntry,
} from '@/stores/aiSessionStore'

export interface RunChatStreamParams {
  conversationId: number
  assistantMessageId: number
  userText: string
  imageUrls?: string[]
  onComplete?: (text: string) => void | Promise<void>
}

export interface RunRagStreamParams {
  sessionId: number
  turnDbId: number
  question: string
  excludeTurnId?: number
  onComplete?: (payload: { answer: string; references: RagReferenceVO[] }) => void | Promise<void>
}

export interface RunCampaignCopyStreamParams {
  draftId: number
  mode: 'draft' | 'refine'
  styleTemplateId?: number
  hint?: string
  fallbackTitle: string
  onComplete?: (payload: { copyTitle: string; copyBody: string }) => void | Promise<void>
  onDebouncedSave?: (payload: { copyTitle: string; copyBody: string }) => void | Promise<void>
}

function initStreamEntry(partial: AiStreamEntry) {
  useAiSessionStore.getState().upsertStream(partial)
}

async function persistChatAssistant(
  conversationId: number,
  assistantMessageId: number,
  content: string,
) {
  if (!content.trim()) return
  await updateChatAssistantApi(conversationId, assistantMessageId, content)
}

async function persistRagTurn(
  sessionId: number,
  turnDbId: number,
  question: string,
  answer: string,
  references: RagReferenceVO[],
) {
  await updateKnowledgeTurnApi(sessionId, turnDbId, {
    question,
    answer,
    references,
  })
}

export async function runChatStream(params: RunChatStreamParams): Promise<string> {
  const { conversationId, assistantMessageId, userText, imageUrls, onComplete } = params
  const key = chatStreamKey(conversationId, assistantMessageId)
  const store = useAiSessionStore.getState()

  initStreamEntry({
    key,
    module: 'chat',
    status: 'streaming',
    accumulatedText: '',
    references: [],
    meta: { conversationId, assistantMessageId, userText, imageUrls },
  })

  const controller = new AbortController()
  store.registerAbortController(key, controller)

  let finalAnswer = ''

  try {
    await chatStreamApi(
      userText,
      {
        conversationId,
        imageUrls,
        onChunk: (chunk) => {
          finalAnswer += chunk
          useAiSessionStore.getState().appendStreamText(key, chunk)
        },
        onDone: () => {},
      },
      controller.signal,
    )

    store.finishStream(key, 'done')
    await persistChatAssistant(conversationId, assistantMessageId, finalAnswer)
    await onComplete?.(finalAnswer)
    return finalAnswer
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError'
    store.finishStream(key, aborted ? 'aborted' : 'error', aborted ? undefined : String(err))
    if (finalAnswer.trim()) {
      await persistChatAssistant(conversationId, assistantMessageId, finalAnswer)
    }
    if (!aborted) throw err
    await onComplete?.(finalAnswer)
    return finalAnswer
  }
}

export async function runRagStream(params: RunRagStreamParams): Promise<{
  answer: string
  references: RagReferenceVO[]
}> {
  const { sessionId, turnDbId, question, excludeTurnId, onComplete } = params
  const key = ragStreamKey(sessionId, turnDbId)
  const store = useAiSessionStore.getState()

  initStreamEntry({
    key,
    module: 'rag',
    status: 'streaming',
    accumulatedText: '',
    references: [],
    phase: 'retrieving',
    meta: { sessionId, turnDbId, question },
  })

  const controller = new AbortController()
  store.registerAbortController(key, controller)

  let finalAnswer = ''
  let finalRefs: RagReferenceVO[] = []

  try {
    await ragStreamApi(
      question,
      {
        onReferences: (refs) => {
          finalRefs = refs
          useAiSessionStore.getState().setStreamReferences(key, refs)
        },
        onChunk: (chunk) => {
          finalAnswer += chunk
          useAiSessionStore.getState().appendStreamText(key, chunk)
        },
        onDone: () => {},
      },
      { topK: 6, sessionId, excludeTurnId, signal: controller.signal },
    )

    store.finishStream(key, 'done')
    await persistRagTurn(sessionId, turnDbId, question, finalAnswer, finalRefs)
    await onComplete?.({ answer: finalAnswer, references: finalRefs })
    return { answer: finalAnswer, references: finalRefs }
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError'
    store.finishStream(key, aborted ? 'aborted' : 'error')
    if (finalAnswer.trim() || finalRefs.length > 0) {
      await persistRagTurn(sessionId, turnDbId, question, finalAnswer, finalRefs)
    }
    if (!aborted) throw err
    await onComplete?.({ answer: finalAnswer, references: finalRefs })
    return { answer: finalAnswer, references: finalRefs }
  }
}

export async function runCampaignCopyStream(params: RunCampaignCopyStreamParams): Promise<{
  copyTitle: string
  copyBody: string
}> {
  const { draftId, mode, styleTemplateId, hint, fallbackTitle, onComplete, onDebouncedSave } =
    params
  const key = campaignStreamKey(draftId)
  const store = useAiSessionStore.getState()

  initStreamEntry({
    key,
    module: 'campaign',
    status: 'streaming',
    accumulatedText: '',
    references: [],
    meta: { draftId, mode },
  })

  const controller = new AbortController()
  store.registerAbortController(key, controller)

  let accumulated = ''
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const scheduleDebouncedSave = () => {
    if (!onDebouncedSave) return
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      const payload = buildCampaignCopyPayload(accumulated, fallbackTitle)
      if (payload.copyBody.trim()) {
        void onDebouncedSave(payload)
      }
    }, 1000)
  }

  try {
    await generateCopyStreamApi(
      draftId,
      {
        mode,
        styleTemplateId: mode === 'refine' ? styleTemplateId : undefined,
        hint: mode === 'refine' ? hint : undefined,
        onChunk: (chunk) => {
          accumulated += chunk
          useAiSessionStore.getState().appendStreamText(key, chunk)
          scheduleDebouncedSave()
        },
        onDone: () => {},
      },
      controller.signal,
    )

    if (debounceTimer) clearTimeout(debounceTimer)
    store.finishStream(key, 'done')

    const payload = buildCampaignCopyPayload(accumulated, fallbackTitle)
    if (payload.copyBody.trim()) {
      await saveCampaignCopyApi(draftId, payload)
    }
    await onComplete?.(payload)
    return payload
  } catch (err) {
    if (debounceTimer) clearTimeout(debounceTimer)
    const aborted = err instanceof DOMException && err.name === 'AbortError'
    store.finishStream(key, aborted ? 'aborted' : 'error')
    if (accumulated.trim()) {
      const payload = buildCampaignCopyPayload(accumulated, fallbackTitle)
      await saveCampaignCopyApi(draftId, payload).catch(() => {})
      await onComplete?.(payload)
      return payload
    }
    if (!aborted) throw err
    return { copyTitle: fallbackTitle, copyBody: accumulated }
  }
}

export function abortStreamByKey(key: string) {
  useAiSessionStore.getState().abortStream(key)
}
