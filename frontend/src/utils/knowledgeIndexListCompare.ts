import type { KnowledgeDocumentVO } from '@/api/knowledge'

/** 轮询时只关心会随索引变化的字段，避免无效 setState */
export type KnowledgeIndexRowSnapshot = Pick<
  KnowledgeDocumentVO,
  'id' | 'indexStatus' | 'chunkCount' | 'charCount' | 'lastJobId'
>

export function toIndexSnapshots(records: KnowledgeDocumentVO[]): KnowledgeIndexRowSnapshot[] {
  return records.map((r) => ({
    id: r.id,
    indexStatus: r.indexStatus,
    chunkCount: r.chunkCount,
    charCount: r.charCount,
    lastJobId: r.lastJobId,
  }))
}

function snapshotKey(row: KnowledgeIndexRowSnapshot): string {
  return [
    row.id,
    row.indexStatus ?? '',
    row.chunkCount ?? '',
    row.charCount ?? '',
    row.lastJobId ?? '',
  ].join('|')
}

/** 当前页索引快照 + total 是否都与上次一致 */
export function isKnowledgeListIndexUnchanged(
  prev: KnowledgeIndexRowSnapshot[],
  next: KnowledgeDocumentVO[],
  prevTotal: number,
  nextTotal: number,
): boolean {
  if (prevTotal !== nextTotal) return false
  if (prev.length !== next.length) return false
  const nextSnaps = toIndexSnapshots(next)
  for (let i = 0; i < prev.length; i++) {
    if (snapshotKey(prev[i]) !== snapshotKey(nextSnaps[i])) return false
  }
  return true
}
