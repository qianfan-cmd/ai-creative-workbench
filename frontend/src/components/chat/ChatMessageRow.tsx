import {
  CheckOutlined,
  CopyOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import type { ReactNode } from 'react'
import styles from './ChatMessageRow.module.css'

export type ChatMessageRole = 'user' | 'assistant'

interface ChatMessageRowProps {
  role: ChatMessageRole
  children: ReactNode
  streaming?: boolean
  showActions?: boolean
  copied?: boolean
  onCopy?: () => void
  onRegenerate?: () => void
  regenerateDisabled?: boolean
  userInitial?: string
}

export default function ChatMessageRow({
  role,
  children,
  streaming = false,
  showActions = false,
  copied = false,
  onCopy,
  onRegenerate,
  regenerateDisabled = false,
  userInitial = '你',
}: ChatMessageRowProps) {
  const isUser = role === 'user'

  return (
    <div className={`${styles.row} ${isUser ? styles.row_user : styles.row_assistant}`}>
      {!isUser && (
        <div className={`${styles.avatar} ${styles.avatar_ai}`} aria-hidden="true">
          AI
        </div>
      )}

      <div className={styles.content}>
        <div className={`${styles.bubble} ${isUser ? styles.bubble_user : styles.bubble_assistant}`}>
          {children}
        </div>

        {showActions && !streaming && (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.actionBtn}
              title="复制"
              onClick={onCopy}
            >
              {copied ? <CheckOutlined /> : <CopyOutlined />}
            </button>
            {!isUser && onRegenerate && (
              <button
                type="button"
                className={styles.actionBtn}
                title="重新生成"
                onClick={onRegenerate}
                disabled={regenerateDisabled}
              >
                <ReloadOutlined />
              </button>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className={`${styles.avatar} ${styles.avatar_user}`} aria-hidden="true">
          {userInitial}
        </div>
      )}
    </div>
  )
}
