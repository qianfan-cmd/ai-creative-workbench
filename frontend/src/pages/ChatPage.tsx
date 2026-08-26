import styles from '@/pages/ChatPage.module.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Input, message } from 'antd'
import {
  SendOutlined,
  PauseCircleOutlined,
  CopyOutlined,
  CheckOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { chatStreamApi } from '@/api/chat'
import layoutStyles from '@/layouts/MainLayout.module.css'

export type ChatRole = 'user' | 'assistant'

/** 单条聊天消息的数据结构 */
export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  /** true 时在气泡末尾显示流式光标动画（生成中） */
  streaming?: boolean
}

/**
 * 为「重新生成」查找对应的用户问题
 *
 * 规则：从目标 assistant 消息往前找，最近一条 role === 'user' 的消息
 *
 * @param messages 当前完整对话列表
 * @param assistantId 要重新生成的那条 assistant 消息 id
 * @returns 用户问题文本；找不到则 null
 */
function findUserPromptForAssistant(messages: ChatMessage[], assistantId: string) {
  const idx = messages.findIndex((m) => m.id === assistantId)
  // idx <= 0 表示不存在，或前面没有任何消息
  if (idx <= 0) return null

  for (let i = idx - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content
  }
  return null
}

export default function ChatPage() {
  // ─── 状态 ───────────────────────────────────────────────

  /** 对话历史（唯一数据源，UI 由 messages.map 渲染） */
  const [messages, setMessages] = useState<ChatMessage[]>([])

  /** 输入框当前文字（受控组件 value） */
  const [input, setInput] = useState('')

  /**
   * 是否处于「请求进行中」
   */
  const [sending, setSending] = useState(false)

  /**
   * 是否处于「流式输出中」
   */
  const [streaming, setStreaming] = useState(false)

  /** 复制消息的 id*/
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // ─── Refs ───────────────────────────────────────────────

  /**
   * AbortController: 浏览器原生控制器，用于中止 fetch / SSE 请求。
   * 传给 chatStreamApi 的 signal；用户点「停止生成」时调用 abort()。
   */
  const abortRef = useRef<AbortController | null>(null)

  /** 消息列表滚动容器 DOM，用于 scrollTop = scrollHeight 滚到底 */
  const messagesRef = useRef<HTMLDivElement>(null)

  // ─── 核心：流式生成 Assistant 回复 ─────────────────────

  /**
   * 对指定 assistant 消息发起 SSE 流式请求（发送 & 重新生成共用）
   *
   * 调用链：
   *   streamAssistantReply
   *     → chatStreamApi (fetch POST /api/chat/stream)
   *     → onChunk 逐字追加到 messages[assistantId].content
   *     → onDone / finally 关闭 streaming 状态
   *
   * @param userText 发给后端的用户问题（入参）
   * @param assistantId 要写入回复的那条 assistant 消息 id（出参写入 messages）
   */
  const streamAssistantReply = useCallback(async (userText: string, assistantId: string) => {
    setSending(true)
    setStreaming(true)

    // 清空该条 assistant 旧内容，进入「生成中」态（显示光标）
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId ? { ...m, content: '', streaming: true } : m,
      ),
    )

    const controller = new AbortController()
    abortRef.current = controller

    /** 处理流式响应完成：关闭 streaming 光标，标记该条消息已结束 */
    const finishAssistant = () => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, streaming: false } : m,
        ),
      )
    }

    /** 处理流式响应 */
    try {
      await chatStreamApi(
        userText,
        {
          // 每收到一个 SSE data 块，追加到对应 assistant 的 content
          onChunk: (chunk) => {
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
      // 用户主动停止：AbortController.abort() 会抛出 AbortError，保留已生成内容即可
      if (err instanceof DOMException && err.name === 'AbortError') {
        finishAssistant()
        return
      }
      message.error(err instanceof Error ? err.message : '生成失败')
      finishAssistant()
    } finally {
      setSending(false)
      setStreaming(false)
      abortRef.current = null
    }
  }, [])

  // ─── 事件处理 ───────────────────────────────────────────

  /**
   * 发送新消息
   *
   * 流程：
   * 1. 追加 user 消息 + 空 assistant 占位（streaming: true）
   * 2. 调用 streamAssistantReply 拉 SSE
   */
  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return

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
    await streamAssistantReply(text, assistantId)
  }

  /**
   * 重新生成：不新增消息，用原 user 问题覆盖当前 assistant 回复
   */
  const handleRegenerate = async (assistantId: string) => {
    if (streaming) return

    const idx = messages.findIndex((m) => m.id === assistantId)
    if (idx === -1) return

    const userText = findUserPromptForAssistant(messages, assistantId)
    if (!userText) {
      message.warning('找不到对应的用户问题')
      return
    }

    setMessages((prev) => prev.slice(0, idx + 1));

    await streamAssistantReply(userText, assistantId)
  }

  /** Enter 发送，Shift+Enter 换行；流式生成中 Enter 不触发发送 */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (streaming) return
      void handleSend()
    }
  }

  /**
   * 停止生成
   * abort() 会在异步操作完成之前中止它；可选传入 reason 字符串（此处未传）
   */
  const handleStop = () => {
    abortRef.current?.abort()
  }

  /**
   * 主按钮统一入口（Cursor 式）：
   * - 空闲 → 发送
   * - 流式中 → 停止
   */
  const handlePrimaryAction = () => {
    if (streaming) handleStop()
    else void handleSend()
  }

  /** 复制气泡内容到剪贴板；成功后 copiedId 驱动图标 Copy → Check */
  const handleCopy = async (msgId: string, content: string) => {
    if (!content.trim()) {
      message.warning('暂无内容可复制')
      return
    }
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(msgId)
      window.setTimeout(() => setCopiedId(null), 1000) // 1 秒后重置复制状态
      message.success('复制成功')
    } catch (err) {
      message.error(`复制失败: ${err instanceof Error ? err.message : '未知错误'}`)
    }
  }

  // ─── 副作用 ─────────────────────────────────────────────

  /**
   * 进入 Chat 页：锁定 MainLayout 外层滚动（#main-content overflow: hidden）
   * 仅 .messages 区域内滚，避免整页被顶走
   */
  useEffect(() => {
    const main = document.getElementById('main-content')
    if (!main) return
    main.classList.add(layoutStyles.content_lockScroll)
    return () => main.classList.remove(layoutStyles.content_lockScroll)
  }, [])

  /** 监听 messages 变化后滚动到最底部（含流式逐字更新） */
  useEffect(() => {
    const el = messagesRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages])

  // ─── 渲染 ───────────────────────────────────────────────

  return (
    <div className={styles.panel}>
      {/* 消息列表区：flex:1 + overflow-y:auto，唯一纵向滚动容器 */}
      <div className={styles.messages} ref={messagesRef}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.message} ${
              msg.role === 'user' ? styles.message_user : styles.message_assistant
            }`}
          >
            {/* 气泡正文；streaming 时在末尾渲染闪烁光标 */}
            <div className={styles.bubble}>
              {msg.content}
              {msg.streaming && (
                <span className={styles.cursor} aria-hidden="true" />
              )}
            </div>

            {/* 操作栏：有内容且非生成中才显示（生成中空内容时不出现复制） */}
            {msg.content && !msg.streaming && (
              <div className={styles.messageActions}>
                <button
                  type="button"
                  className={styles.actionBtn}
                  title="复制"
                  onClick={() => handleCopy(msg.id, msg.content)}
                >
                  {copiedId === msg.id ? <CheckOutlined /> : <CopyOutlined />}
                </button>
                {/* 仅 assistant 显示重新生成 */}
                {msg.role === 'assistant' && (
                  <button
                    type="button"
                    className={styles.actionBtn}
                    title="重新生成"
                    onClick={() => void handleRegenerate(msg.id)}
                    disabled={streaming}
                  >
                    <ReloadOutlined />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 底部输入区：flex-shrink:0，始终贴在 panel 底部 */}
      <div className={styles.composer}>
        <Input.TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息...，Enter 发送，Shift+Enter 换行"
          autoSize={{ minRows: 1, maxRows: 6 }}
          disabled={sending}
        />
        <div className={styles.composerActions}>
          {/*
            主按钮不要用 loading={sending}：
            loading 时按钮不可点，流式阶段无法点「停止」
            disabled：仅在没有输入且非 streaming 时禁用
          */}
          <Button
            type="primary"
            icon={streaming ? <PauseCircleOutlined /> : <SendOutlined />}
            onClick={handlePrimaryAction}
            disabled={!streaming && !input.trim()}
          >
            {streaming ? '停止生成' : '发送'}
          </Button>
        </div>
      </div>
    </div>
  )
}
