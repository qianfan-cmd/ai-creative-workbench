import { Button, Input, Select } from 'antd'
import { useState } from 'react'
import styles from '@/components/ops/SourceGenerateComposer.module.css'

const COUNT_OPTIONS = [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n} 张` }))

const RATIO_OPTIONS = [
  '智能',
  '21:9',
  '16:9',
  '5:4',
  '3:2',
  '4:3',
  '1:1',
  '3:4',
  '2:3',
  '4:5',
  '9:16',
].map((r) => ({ value: r, label: r }))

export interface SourceGeneratePayload {
  prompt: string
  count: number
  aspectRatio: string
}

interface SourceGenerateComposerProps {
  loading?: boolean
  onSend: (payload: SourceGeneratePayload) => void
}

export default function SourceGenerateComposer({ loading = false, onSend }: SourceGenerateComposerProps) {
  const [prompt, setPrompt] = useState('')
  const [count, setCount] = useState(4)
  const [aspectRatio, setAspectRatio] = useState('9:16')

  const handleSend = () => {
    const text = prompt.trim()
    if (!text) return
    onSend({ prompt: text, count, aspectRatio })
  }

  return (
    <div className={styles.composer}>
      <Input.TextArea
        rows={3}
        placeholder="描述要生成的源图，例如：夏日清新风格吉祥物插画"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            handleSend()
          }
        }}
      />
      <div className={styles.toolbar}>
        <Select
          className={styles.select}
          value={count}
          options={COUNT_OPTIONS}
          onChange={setCount}
          disabled={loading}
        />
        <Select
          className={styles.select}
          value={aspectRatio}
          options={RATIO_OPTIONS}
          onChange={setAspectRatio}
          disabled={loading}
        />
        <Button type="primary" className={styles.sendBtn} loading={loading} onClick={handleSend}>
          发送生成
        </Button>
      </div>
    </div>
  )
}
