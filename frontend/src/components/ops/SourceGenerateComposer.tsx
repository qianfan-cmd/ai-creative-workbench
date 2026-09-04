import { Select } from 'antd'
import type { ReactNode } from 'react'
import { useCallback, useState } from 'react'
import AiImageComposer, { type AiComposerAttachment, type AiComposerPayload } from '@/components/ai/AiImageComposer'
import { uploadWorkflowSourceApi, type WorkflowContext } from '@/api/workflowSource'
import styles from '@/components/ops/SourceGenerateComposer.module.css'

export interface SourceGeneratePayload {
  prompt: string
  count: number
  aspectRatio: string
  referenceUrls?: string[]
}

const COUNT_OPTIONS = [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n} 张` }))

interface SourceGenerateComposerProps {
  loading?: boolean
  aspectRatio?: string
  placeholder?: string
  onSend: (payload: SourceGeneratePayload) => void
  confirmAction?: ReactNode
  workflowContext: {
    context: WorkflowContext
    taskId?: number
    draftId?: number
  }
}

export default function SourceGenerateComposer({
  loading = false,
  aspectRatio = '9:16',
  placeholder = '描述要生成的源图，Enter 发送，Shift+Enter 换行',
  onSend,
  confirmAction,
  workflowContext,
}: SourceGenerateComposerProps) {
  const [count, setCount] = useState(4)

  const handleUploadAttachment = useCallback(
    async (file: File): Promise<AiComposerAttachment> => {
      const row = await uploadWorkflowSourceApi(
        file,
        {
          context: workflowContext.context,
          taskId: workflowContext.taskId,
          draftId: workflowContext.draftId,
        },
        { ephemeralReference: true },
      )
      return {
        url: row.imageUrl,
        name: row.originalName ?? file.name,
      }
    },
    [workflowContext],
  )

  const handleSend = ({ text, attachments }: AiComposerPayload) => {
    onSend({
      prompt: text,
      count,
      aspectRatio,
      referenceUrls: attachments.map((a) => a.url),
    })
  }

  return (
    <AiImageComposer
      loading={loading}
      placeholder={placeholder}
      onSend={handleSend}
      onUploadAttachment={handleUploadAttachment}
      confirmAction={confirmAction}
      toolbarExtra={
        <Select
          size="small"
          className={styles.countSelect}
          value={count}
          options={COUNT_OPTIONS}
          onChange={setCount}
          disabled={loading}
          popupMatchSelectWidth={false}
        />
      }
    />
  )
}
