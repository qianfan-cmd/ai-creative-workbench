import styles from '@/pages/ChatPage.module.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { message } from 'antd'
import {
  createConversationApi,
  getConversationApi,
  listConversationsApi,
  saveChatMessagesApi,
  type ConversationVO,
} from '@/api/chat'
import AiImageComposer, { type AiComposerPayload } from '@/components/ai/AiImageComposer'
import { useMainContentLayout } from '@/hooks/useMainContentLayout'
import { useCopyFeedback } from '@/hooks/useCopyFeedback'
import ChatHistorySidebar from '@/components/chat/ChatHistorySidebar'
import ChatMessageRow from '@/components/chat/ChatMessageRow'
import FeedbackButtons from '@/components/ai/FeedbackButtons'
import AnswerRenderer from '@/components/knowledge/AnswerRenderer'
import VirtualChatMessageList from '@/components/chat/VirtualChatMessageList'
import { CHAT_ACTIVE_CONVERSATION_KEY, readStoredId } from '@/constants/aiSessionKeys'
import { abortStreamByKey, runChatStream } from '@/services/aiStreamRunner'
import { useAiSessionStore } from '@/stores/aiSessionStore'
import { showApiError } from '@/utils/apiError'
import { isChatStreaming, mergeChatMessagesWithStreams } from '@/utils/mergeAiStreams'

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  imageUrls?: string[]
  streaming?: boolean
  dbId?: number
  feedbackRating?: 'up' | 'down'
}

function findUserPromptForAssistant(messages: ChatMessage[], assistantId: string) {
  const idx = messages.findIndex((m) => m.id === assistantId)
  if (idx <= 0) return null
  for (let i = idx - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      return {
        content: messages[i].content,
        imageUrls: messages[i].imageUrls,
      }
    }
  }
  return null
}

function isNearBottom(el: HTMLElement, threshold = 120) {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold
}

function scrollMessagesToBottom(el: HTMLElement) {
  el.scrollTop = el.scrollHeight
}

function mapMessageFromApi(m: {
  id: number
  role: string
  content: string
  imageUrls?: string[]
  userFeedbackRating?: 'up' | 'down'
}): ChatMessage {
  return {
    id: String(m.id),
    role: m.role as ChatRole,
    content: m.content,
    imageUrls: m.imageUrls,
    dbId: m.id,
    feedbackRating: m.userFeedbackRating,
  }
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const { copiedId, handleCopy } = useCopyFeedback()

  const [conversations, setConversations] = useState<ConversationVO[]>([])
  const activeConversationId = useAiSessionStore((s) => s.activeChatConversationId)
  const setActiveChatConversationId = useAiSessionStore((s) => s.setActiveChatConversationId)
  const streams = useAiSessionStore((s) => s.streams)

  const messagesRef = useRef<HTMLDivElement>(null)
  const forceScrollRef = useRef(false)
  const stickToBottomRef = useRef(true)
  const initialRestoreRef = useRef(false)

  const streaming = isChatStreaming(activeConversationId, streams)

  const displayMessages = useMemo(
    () => mergeChatMessagesWithStreams(messages, activeConversationId, streams),
    [messages, activeConversationId, streams],
  )

  const loadConversations = useCallback(async () => {
    try {
      const list = await listConversationsApi()
      setConversations(list)
    } catch (error) {
      showApiError(error, '加载历史对话失败')
    }
  }, [])

  const loadConversationDetail = useCallback(async (conversationId: number) => {
    const detail = await getConversationApi(conversationId)
    setActiveChatConversationId(detail.id)
    forceScrollRef.current = true
    stickToBottomRef.current = true
    setMessages(detail.messages.map(mapMessageFromApi))
    return detail
  }, [setActiveChatConversationId])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (initialRestoreRef.current) return
    initialRestoreRef.current = true
    void (async () => {
      const storedId =
        readStoredId(CHAT_ACTIVE_CONVERSATION_KEY) ??
        useAiSessionStore.getState().activeChatConversationId
      if (!storedId) return
      try {
        await loadConversationDetail(storedId)
      } catch {
        setActiveChatConversationId(null)
      }
    })()
  }, [loadConversationDetail, setActiveChatConversationId])

  const ensureConversation = useCallback(async (): Promise<number> => {
    if (activeConversationId != null) return activeConversationId

    const conversation = await createConversationApi()
    setActiveChatConversationId(conversation.id)
    setConversations((prev) => [conversation, ...prev])
    return conversation.id
  }, [activeConversationId, setActiveChatConversationId])

  const handleComposerSend = async ({ text, attachments }: AiComposerPayload) => {
    const trimmed = text.trim()
    if ((!trimmed && attachments.length === 0) || sending || streaming) return

    const imageUrls = attachments.map((a) => a.url)
    setSending(true)

    try {
      const conversationId = await ensureConversation()
      setActiveChatConversationId(conversationId)

      const pair = await saveChatMessagesApi(conversationId, {
        userContent: trimmed,
        assistantContent: '',
        userImageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      })

      const userMsg: ChatMessage = {
        id: String(pair.userMessageId),
        dbId: pair.userMessageId,
        role: 'user',
        content: trimmed,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      }
      const assistantMsg: ChatMessage = {
        id: String(pair.assistantMessageId),
        dbId: pair.assistantMessageId,
        role: 'assistant',
        content: '',
        streaming: true,
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      forceScrollRef.current = true
      stickToBottomRef.current = true
      await loadConversations()

      void runChatStream({
        conversationId,
        assistantMessageId: pair.assistantMessageId,
        userText: trimmed,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        onComplete: async () => {
          await loadConversations()
          try {
            const detail = await getConversationApi(conversationId)
            setMessages(detail.messages.map(mapMessageFromApi))
          } catch {
            // keep local + store merge
          }
        },
      }).catch((error) => showApiError(error, '生成失败'))
    } catch (error) {
      showApiError(error, '发送失败')
    } finally {
      setSending(false)
    }
  }

  const handleRegenerate = async (assistantId: string) => {
    if (streaming || sending) return

    const idx = messages.findIndex((m) => m.id === assistantId)
    if (idx === -1) return

    const assistantMsg = messages[idx]
    const userPrompt = findUserPromptForAssistant(messages, assistantId)
    if (!userPrompt) {
      message.warning('找不到对应的用户问题')
      return
    }

    if (activeConversationId == null) {
      message.warning('当前没有激活的会话')
      return
    }

    if (assistantMsg.dbId == null) {
      message.warning('消息未持久化，无法同步到数据库')
      return
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId ? { ...m, content: '', streaming: true } : m,
      ),
    )
    forceScrollRef.current = true
    stickToBottomRef.current = true

    void runChatStream({
      conversationId: activeConversationId,
      assistantMessageId: assistantMsg.dbId,
      userText: userPrompt.content,
      imageUrls: userPrompt.imageUrls,
      onComplete: async () => {
        try {
          const detail = await getConversationApi(activeConversationId)
          setMessages(detail.messages.map(mapMessageFromApi))
        } catch {
          // ignore
        }
      },
    }).catch((error) => showApiError(error, '重新生成失败'))
  }

  const handleStop = () => {
    if (activeConversationId == null) return
    const activeStream = Object.values(streams).find(
      (s) =>
        s.module === 'chat' &&
        s.meta.conversationId === activeConversationId &&
        s.status === 'streaming',
    )
    if (activeStream) {
      abortStreamByKey(activeStream.key)
    }
  }

  const handleSelectConversation = async (conversationId: number) => {
    if (streaming || sending || conversationId === activeConversationId) return

    try {
      await loadConversationDetail(conversationId)
    } catch (error) {
      showApiError(error, '加载对话失败')
    }
  }

  const handleNewConversation = async () => {
    if (streaming || sending) return

    try {
      const conversation = await createConversationApi()
      setActiveChatConversationId(conversation.id)
      setMessages([])
      await loadConversations()
    } catch (error) {
      showApiError(error, '新建对话失败')
    }
  }

  const handleDeleteConversation = async (deletedId: number) => {
    const nextList = conversations.filter((c) => c.id !== deletedId)
    setConversations(nextList)
    if (activeConversationId === deletedId) {
      if (nextList.length > 0) {
        try {
          await loadConversationDetail(nextList[0].id)
        } catch {
          setActiveChatConversationId(null)
          setMessages([])
        }
      } else {
        setActiveChatConversationId(null)
        setMessages([])
      }
    }
    await loadConversations()
  }

  useMainContentLayout({ lockScroll: true, fullBleed: true })

  const isEmpty = displayMessages.length === 0

  useEffect(() => {
    const el = messagesRef.current
    if (!el || isEmpty) return

    const onScroll = () => {
      stickToBottomRef.current = isNearBottom(el)
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [isEmpty])

  useEffect(() => {
    const el = messagesRef.current
    if (!el) return

    if (forceScrollRef.current || (stickToBottomRef.current && isNearBottom(el))) {
      requestAnimationFrame(() => scrollMessagesToBottom(el))
      forceScrollRef.current = false
    }
  }, [displayMessages])

  const composer = (
    <AiImageComposer
      loading={sending && !streaming}
      streaming={streaming}
      onStop={handleStop}
      maxAttachments={4}
      placeholder="输入消息，Enter 发送，Shift+Enter 换行；可拖拽/粘贴/素材库附图"
      onSend={(payload) => void handleComposerSend(payload)}
    />
  )

  return (
    <div className={styles.panel}>
      <ChatHistorySidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={handleSelectConversation}
        onNew={() => void handleNewConversation()}
        onRefresh={loadConversations}
        onDeleted={(id) => void handleDeleteConversation(id)}
        disabled={streaming || sending}
      />

      <div className={styles.main}>
        {isEmpty ? (
          <>
            <div className={styles.center}>
              <h2 className={styles.greeting}>今天有什么新想法？🙂</h2>
            </div>
            <div className={styles.composerWrap}>
              <div className={styles.composerBox}>{composer}</div>
            </div>
          </>
        ) : (
          <>
            <div className={styles.messages} ref={messagesRef}>
              <VirtualChatMessageList
                items={displayMessages}
                scrollRef={messagesRef}
                disableVirtualization={streaming}
                listResetKey={activeConversationId ?? 'new'}
                getItemKey={(msg) => msg.id}
                renderItem={(msg) => (
                  <ChatMessageRow
                    role={msg.role}
                    streaming={msg.streaming}
                    showActions={Boolean(msg.content) && !msg.streaming}
                    copied={copiedId === msg.id}
                    onCopy={() => void handleCopy(msg.id, msg.content)}
                    onRegenerate={
                      msg.role === 'assistant'
                        ? () => void handleRegenerate(msg.id)
                        : undefined
                    }
                    regenerateDisabled={streaming || sending}
                    feedback={
                      msg.role === 'assistant' ? (
                        <FeedbackButtons
                          scene="chat"
                          refType="message"
                          refId={msg.dbId}
                          initialRating={msg.feedbackRating ?? null}
                        />
                      ) : undefined
                    }
                  >
                    {msg.role === 'assistant' ? (
                      <AnswerRenderer answer={msg.content} streaming={msg.streaming} />
                    ) : (
                      <>
                        {msg.imageUrls && msg.imageUrls.length > 0 && (
                          <div className={styles.userImages}>
                            {msg.imageUrls.map((url) => (
                              <img key={url} src={url} alt="" className={styles.userImageThumb} />
                            ))}
                          </div>
                        )}
                        {msg.content}
                      </>
                    )}
                  </ChatMessageRow>
                )}
              />
            </div>
            <div className={styles.composer}>
              <div className={styles.composerBoxActive}>{composer}</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
