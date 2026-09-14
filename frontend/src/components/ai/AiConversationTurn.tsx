import { CheckOutlined, CopyOutlined } from '@ant-design/icons'
import type { ReactNode } from 'react'
import ChatMessageRow from '@/components/chat/ChatMessageRow'
import AnswerRenderer from '@/components/knowledge/AnswerRenderer'
import RagReferencesPanel from '@/components/knowledge/RagReferencesPanel'
import type { RagReferenceVO } from '@/api/knowledge'
import type { RagPhase } from '@/stores/aiSessionStore'
import styles from '@/components/ai/AiConversationTurn.module.css'

interface AiConversationTurnProps {
  question: string
  answer: string
  references?: RagReferenceVO[]
  streaming?: boolean
  phase?: RagPhase
  copiedQuestionKey?: string
  copiedAnswerKey?: string
  copiedId?: string | null
  retryDisabled?: boolean
  onCopy: (copyKey: string, content: string) => void
  onRetry?: () => void
  feedback?: ReactNode
}

export default function AiConversationTurn({
  question,
  answer,
  references = [],
  streaming = false,
  phase,
  copiedQuestionKey = 'question',
  copiedAnswerKey = 'answer',
  copiedId,
  retryDisabled = false,
  onCopy,
  onRetry,
  feedback,
}: AiConversationTurnProps) {
  const showAssistantActions = !streaming && Boolean(answer)

  return (
    <div className={styles.turnBlock}>
      <div>
        <ChatMessageRow role="user">{question}</ChatMessageRow>
        {question && (
          <div className={styles.userCopyActions}>
            <button
              type="button"
              className={styles.actionBtn}
              title="复制问题"
              onClick={() => onCopy(copiedQuestionKey, question)}
            >
              {copiedId === copiedQuestionKey ? <CheckOutlined /> : <CopyOutlined />}
            </button>
          </div>
        )}
      </div>

      <div className={styles.assistantWrap}>
        <ChatMessageRow
          role="assistant"
          streaming={streaming}
          showActions={showAssistantActions}
          copied={copiedId === copiedAnswerKey}
          onCopy={() => onCopy(copiedAnswerKey, answer)}
          onRegenerate={onRetry}
          regenerateDisabled={retryDisabled}
          feedback={feedback}
        >
          <AnswerRenderer answer={answer} phase={phase} streaming={streaming} />
        </ChatMessageRow>
        <RagReferencesPanel references={references} />
      </div>
    </div>
  )
}
