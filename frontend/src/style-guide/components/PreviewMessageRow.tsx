import { CopyOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ReactNode } from 'react'
import styles from './PreviewMessageRow.module.css'

export type MessageRole = 'user' | 'assistant'

interface PreviewMessageRowProps {
  role: MessageRole
  children: ReactNode
  streaming?: boolean
  showActions?: boolean
  userInitial?: string
}

export default function PreviewMessageRow({
  role,
  children,
  streaming = false,
  showActions = false,
  userInitial = '你',
}: PreviewMessageRowProps) {
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
          {streaming && <span className={styles.cursor} aria-hidden="true" />}
        </div>

        {showActions && !streaming && (
          <div className={styles.actions}>
            <button type="button" className={styles.actionBtn} title="复制">
              <CopyOutlined />
            </button>
            {!isUser && (
              <button type="button" className={styles.actionBtn} title="重新生成">
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
