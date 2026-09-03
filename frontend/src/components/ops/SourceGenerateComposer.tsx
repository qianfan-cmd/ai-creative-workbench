import { Select } from 'antd'
import type { ReactNode } from 'react'
import { useState } from 'react'
import AiImageComposer, { type AiComposerPayload } from '@/components/ai/AiImageComposer'
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
}

export default function SourceGenerateComposer({
  loading = false,
  aspectRatio = '9:16',
  placeholder = '描述要生成的源图，Enter 发送，Shift+Enter 换行',
  onSend,
  confirmAction,
}: SourceGenerateComposerProps) {
  const [count, setCount] = useState(4)

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
