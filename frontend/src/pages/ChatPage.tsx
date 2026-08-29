import styles from '@/pages/ChatPage.module.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Input, message } from 'antd'
import {
  SendOutlined,
  PauseCircleOutlined,
} from '@ant-design/icons'
import {
  chatStreamApi,
  listConversationsApi,
  createConversationApi,
  saveChatMessagesApi,
  updateChatAssistantApi,
  getConversationApi,
  type ConversationVO,
} from '@/api/chat'
import layoutStyles from '@/layouts/MainLayout.module.css'
import ChatHistorySidebar from '@/components/chat/ChatHistorySidebar'
import ChatMessageRow from '@/components/chat/ChatMessageRow'
import AnswerRenderer from '@/components/knowledge/AnswerRenderer'

export type ChatRole = 'user' | 'assistant'

/** 单条聊天消息 */
export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  streaming?: boolean
  /** Phase C：服务端 message.id，持久化后填入 */
  dbId?: number
}

function findUserPromptForAssistant(messages: ChatMessage[], assistantId: string) {
  const idx = messages.findIndex((m) => m.id === assistantId)
  if (idx <= 0) return null
  for (let i = idx - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content
  }
  return null
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  /** 侧栏历史列表（Phase B 只读展示） */
  const [conversations, setConversations] = useState<ConversationVO[]>([])

  // 当前激活会话
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const messagesRef = useRef<HTMLDivElement>(null)

/** 拉取侧栏历史；保存消息 / 新建会话时调用 */
const loadConversations = useCallback(async () => {
  try {
    const list = await listConversationsApi()
    setConversations(list)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载历史对话失败')
  }
}, [])

  /** 挂载时拉取历史侧栏（只读） */
  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  /** 确保有 activeConversationId；首次提问时自动 POST 建会话 */
  const ensureConversation = useCallback(async (): Promise<number> => {
    // 已有激活对话 -》 直接返回，避免重复建
    if (activeConversationId != null) return activeConversationId;

    const conversation = await createConversationApi()
    setActiveConversationId(conversation.id)
    // 新对话插到侧栏顶部，标题默认新对话
    setConversations((prev) => [conversation, ...prev])
    return conversation.id
  }, [activeConversationId])

/** 把服务端 message 转成 ChatPage 用的 ChatMessage */
function mapMessageFromApi(m: { id: number; role: string; content: string }): ChatMessage {
  return {
    id: String(m.id),
    role: m.role as ChatRole,
    content: m.content,
    dbId: m.id, // 服务端主键
  }
}

  /**
   * 流式生成 Assistant 回复（单轮：不传 conversationId）
   */
  const streamAssistantReply = useCallback(async (userText: string, assistantId: string, conversationId: number) => {
    setSending(true)
    setStreaming(true)
    let finalAnswer = '';

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
          onChunk: (chunk) => {
            finalAnswer += chunk; // 局部变量同步积累，避免state异步导致保存时拿不到回答
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
        return finalAnswer;
      }
      message.error(err instanceof Error ? err.message : '生成失败')
      finishAssistant()
    } finally {
      setSending(false)
      setStreaming(false)
      abortRef.current = null
    }
    return finalAnswer;
  }, [])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return

    // 先确保有会话id
    const conversationId = await ensureConversation()

    setInput('')

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
    }
    const assistantId = `a-${Date.now()}`
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      streaming: true,
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])

    const assistantContent = await streamAssistantReply(text, assistantId, conversationId)

    // 有内容才写库
    if (assistantContent.trim()) {
      try {
        await saveChatMessagesApi(conversationId, {
          userContent: text,
          assistantContent,
        })
        await loadConversations() // 首问候侧栏标题从新对话变成问题摘要

        // 从服务器拉完整线程，同步 dbId
        const detail = await getConversationApi(conversationId);
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

    const assistantMsg = messages[idx];
    const userText = findUserPromptForAssistant(messages, assistantId)
    if (!userText) {
      message.warning('找不到对应的用户问题')
      return
    }

    if (activeConversationId == null) {
      message.warning('当前没有激活的会话')
      return;
    }

    if (assistantMsg.dbId == null) {
      message.warning('消息未持久化，无法同步到数据库')
      return;
    }

    setMessages((prev) => prev.slice(0, idx + 1))
    const assistantContent = await streamAssistantReply(userText, assistantId, activeConversationId)
    if (assistantContent.trim()) {
      try {
        await updateChatAssistantApi(activeConversationId, assistantMsg.dbId, assistantContent)
      } catch (error) {
        message.error(error instanceof Error ? error.message : '更新回答失败')
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (streaming) return
      void handleSend()
    }
  }

  const handleStop = () => {
    abortRef.current?.abort()
  }

  const handlePrimaryAction = () => {
    if (streaming) handleStop()
    else void handleSend()
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

  /** 从侧栏选中对话 */
  const handleSelectConversation = async (conversationId: number) => {
    // 流式中禁止切换，避免 state 错乱
    if (streaming || sending || conversationId === activeConversationId) return;

    try {
      const detail = await getConversationApi(conversationId)
      setActiveConversationId(detail.id)
      setMessages(detail.messages.map(mapMessageFromApi))
      setInput('')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载对话失败')
    }
  }

  /** 新建对话 */
  const handleNewConversation = async () => {
    if (streaming || sending) return;

    try {
      const conversation = await createConversationApi()
      setActiveConversationId(conversation.id)
      setMessages([])
      setInput('')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '新建对话失败')
    }
  }

  useEffect(() => {
    const main = document.getElementById('main-content')
    if (!main) return
    main.classList.add(layoutStyles.content_lockScroll)
    return () => main.classList.remove(layoutStyles.content_lockScroll)
  }, [])

  useEffect(() => {
    const el = messagesRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages])

  const isEmpty = messages.length === 0

  const composerInput = (
    <Input.TextArea
      value={input}
      onChange={(e) => setInput(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="输入消息，Enter 发送，Shift+Enter 换行"
      autoSize={{ minRows: 1, maxRows: 6 }}
      disabled={sending}
    />
  )

  const primaryButton = (
    <Button
      type="primary"
      className={isEmpty ? styles.sendBtnRound : undefined}
      icon={streaming ? <PauseCircleOutlined /> : <SendOutlined />}
      onClick={handlePrimaryAction}
      disabled={!streaming && !input.trim()}
    >
      {streaming ? '停止生成' : '发送'}
    </Button>
  )

  return (
    <div className={styles.panel}>
      <ChatHistorySidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={handleSelectConversation}
        onNew={() => void handleNewConversation()}
        disabled={streaming || sending}
      />

      <div className={styles.main}>
        {isEmpty ? (
          <>
            <div className={styles.center}>
              <h2 className={styles.greeting}>今天有什么新想法？🙂</h2>
            </div>
            <div className={styles.composerWrap}>
              <div className={styles.composerPill}>
                {composerInput}
                {primaryButton}
              </div>
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
                    msg.content
                  )}
                </ChatMessageRow>
              ))}
            </div>
            <div className={styles.composer}>
              {composerInput}
              <div className={styles.composerActions}>{primaryButton}</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
