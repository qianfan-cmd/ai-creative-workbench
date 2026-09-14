import { useCallback, useState } from 'react'
import { message } from 'antd'
import { copyToClipboard } from '@/utils/copyToClipboard'

export function useCopyFeedback() {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = useCallback(async (copyKey: string, content: string) => {
    try {
      await copyToClipboard(content)
      setCopiedId(copyKey)
      window.setTimeout(() => setCopiedId(null), 1000)
      message.success('复制成功')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '复制失败')
    }
  }, [])

  return { copiedId, handleCopy }
}
