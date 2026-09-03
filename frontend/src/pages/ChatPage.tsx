import styles from '@/pages/ChatPage.module.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { message } from 'antd'
import {
  chatStreamApi,
  listConversationsApi,
  createConversationApi,
  saveChatMessagesApi,
  updateChatAssistantApi,
  getConversationApi,
  type ConversationVO,
} from '@/api/chat'
import AiImageComposer, { type AiComposerPayload } from '@/components/ai/AiImageComposer'
import { useMainContentLayout } from '@/hooks/useMainContentLayout'
import ChatHistorySidebar from '@/components/chat/ChatHistorySidebar'
import ChatMessageRow from '@/components/chat/ChatMessageRow'
import AnswerRenderer from '@/components/knowledge/AnswerRenderer'

export type ChatRole = 'user' | 'assistant'

/** 单条聊天消息 */
export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  imageUrls?: string[]
  streaming?: boolean
  /** Phase C：服务端 message.id，持久化后填入 */
  dbId?: number
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

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [conversations, setConversations] = useState<ConversationVO[]>([])
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const messagesRef = useRef<HTMLDivElement>(null)

  const loadConversations = useCallback(async () => {
    try {
      const list = await listConversationsApi()
      setConversations(list)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载历史对话失败')
    }
  }, [])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  const ensureConversation = useCallback(async (): Promise<number> => {
    if (activeConversationId != null) return activeConversationId

    const conversation = await createConversationApi()
    setActiveConversationId(conversation.id)
    setConversations((prev) => [conversation, ...prev])
    return conversation.id
  }, [activeConversationId])

  function mapMessageFromApi(m: {
    id: number
    role: string
    content: string
    imageUrls?: string[]
  }): ChatMessage {
    return {
      id: String(m.id),
      role: m.role as ChatRole,
      content: m.content,
      imageUrls: m.imageUrls,
      dbId: m.id,
    }
  }

  const streamAssistantReply = useCallback(
    async (
      userText: string,
      imageUrls: string[] | undefined,
      assistantId: string,
      conversationId: number,
    ) => {
      setSending(true)
      setStreaming(true)
      let finalAnswer = ''

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: '', streaming: true } : m,
        ),
      )

      const controller = new AbortController()
      abortRef.current = controller

      const finishAssistant = () => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, streaming: false } : m,
          ),
        )
      }

      try {
        await chatStreamApi(
          userText,
          {
            conversationId,
            imageUrls,
            onChunk: (chunk) => {
              finalAnswer += chunk
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + chunk }
                    : m,
                ),
              )
            },
            onDone: finishAssistant,
          },
          controller.signal,
        )
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          finishAssistant()
          return finalAnswer
        }
        message.error(err instanceof Error ? err.message : '生成失败')
        finishAssistant()
      } finally {
        setSending(false)
        setStreaming(false)
        abortRef.current = null
      }
      return finalAnswer
    },
    [],
  )

  const handleComposerSend = async ({ text, attachments }: AiComposerPayload) => {
    const trimmed = text.trim()
    if ((!trimmed && attachments.length === 0) || sending) return

    const imageUrls = attachments.map((a) => a.url)
    const conversationId = await ensureConversation()

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
    }
    const assistantId = `a-${Date.now()}`
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      streaming: true,
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])

    const assistantContent = await streamAssistantReply(
      trimmed,
      imageUrls.length > 0 ? imageUrls : undefined,
      assistantId,
      conversationId,
    )

    if (assistantContent.trim()) {
      try {
        await saveChatMessagesApi(conversationId, {
          userContent: trimmed,
          assistantContent,
          userImageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        })
        await loadConversations()

        const detail = await getConversationApi(conversationId)
        setMessages(detail.messages.map(mapMessageFromApi))
      } catch (error) {
        message.error(error instanceof Error ? error.message : '保存失败')
      }
    }
  }

  const handleRegenerate = async (assistantId: string) => {
    if (streaming) return

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

    setMessages((prev) => prev.slice(0, idx + 1))
    const assistantContent = await streamAssistantReply(
      userPrompt.content,
      userPrompt.imageUrls,
      assistantId,
      activeConversationId,
    )
    if (assistantContent.trim()) {
      try {
        await updateChatAssistantApi(activeConversationId, assistantMsg.dbId, assistantContent)
      } catch (error) {
        message.error(error instanceof Error ? error.message : '更新回答失败')
      }
    }
  }

  const handleStop = () => {
    abortRef.current?.abort()
  }

  const handleCopy = async (msgId: string, content: string) => {
    if (!content.trim()) {
      message.warning('暂无内容可复制')
      return
    }
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(msgId)
      window.setTimeout(() => setCopiedId(null), 1000)
      message.success('复制成功')
    } catch (err) {
      message.error(`复制失败: ${err instanceof Error ? err.message : '未知错误'}`)
    }
  }

  const handleSelectConversation = async (conversationId: number) => {
    if (streaming || sending || conversationId === activeConversationId) return

    try {
      const detail = await getConversationApi(conversationId)
      setActiveConversationId(detail.id)
      setMessages(detail.messages.map(mapMessageFromApi))
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载对话失败')
    }
  }

  const handleNewConversation = async () => {
    if (streaming || sending) return

    try {
      const conversation = await createConversationApi()
      setActiveConversationId(conversation.id)
      setMessages([])
      await loadConversations()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '新建对话失败')
    }
  }

  const handleDeleteConversation = async (deletedId: number) => {
    const nextList = conversations.filter((c) => c.id !== deletedId)
    setConversations(nextList)
    if (activeConversationId === deletedId) {
      if (nextList.length > 0) {
        const detail = await getConversationApi(nextList[0].id)
        setActiveConversationId(detail.id)
        setMessages(detail.messages.map(mapMessageFromApi))
      } else {
        setActiveConversationId(null)
        setMessages([])
      }
    }
    await loadConversations()
  }

  useMainContentLayout({ lockScroll: true, fullBleed: true })

  useEffect(() => {
    const el = messagesRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages])

  const isEmpty = messages.length === 0

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
              {messages.map((msg) => (
                <ChatMessageRow
                  key={msg.id}
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
                  regenerateDisabled={streaming}
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
              ))}
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
