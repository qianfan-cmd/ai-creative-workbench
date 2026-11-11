/**
 * 知识库文档列表里只要还有文档处于「索引中」状态，
 * 定时静默刷新列表，直到所有文档索引完成。
 */
import { useEffect, useMemo, useRef } from 'react'

import type { KnowledgeDocumentVO } from '@/api/knowledge'

/** 默认 8s；在「有大文件索引」场景下减轻请求与 UI 干扰 */
export const KNOWLEDGE_INDEX_POLL_MS = 5000;

/** 尚未完成向量化的文档状态 */
const ACTIVE_INDEX_STATUSES = new Set(['pending_index', 'indexing'])

export interface UseKnowledgeIndexPollingOptions {
  intervalMs?: number
}

/**
 * 存在「索引中」文档时启动轮询；不依赖 records 引用变化，避免每次 setRecords 后连环 refresh。
 */
export function useKnowledgeIndexPolling(
  records: KnowledgeDocumentVO[],
  refresh: () => void | Promise<void>,
  options: UseKnowledgeIndexPollingOptions = {},
) {
  const { intervalMs = KNOWLEDGE_INDEX_POLL_MS } = options
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  const hasActiveIndex = useMemo(
    () =>
      records.some(
        (r) => r.indexStatus != null && ACTIVE_INDEX_STATUSES.has(r.indexStatus),
      ),
    [records],
  )

  const prevActiveRef = useRef(false)

  // 进入「有索引中」时静默拉一次；从 true→false 不刷
  useEffect(() => {
    if (hasActiveIndex && !prevActiveRef.current) {
      void refreshRef.current()
    }
    prevActiveRef.current = hasActiveIndex
  }, [hasActiveIndex])

  // 仅随 hasActiveIndex 启停定时器，不因 records 内容变化重置 interval
  useEffect(() => {
    if (!hasActiveIndex) return

    const timer = window.setInterval(() => {
      void refreshRef.current()
    }, intervalMs)

    return () => window.clearInterval(timer)
  }, [hasActiveIndex, intervalMs])
}
