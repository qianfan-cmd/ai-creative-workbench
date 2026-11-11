const SESSION_KEY = 'workbench.knowledge.uploadBatchDocumentIds'

export function loadKnowledgeUploadBatchIds(): number[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
  } catch {
    return []
  }
}

export function saveKnowledgeUploadBatchIds(ids: number[]): void {
  try {
    if (ids.length === 0) {
      sessionStorage.removeItem(SESSION_KEY)
      return
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(ids))
  } catch {
    /* sessionStorage 不可用时仅内存态 */
  }
}
