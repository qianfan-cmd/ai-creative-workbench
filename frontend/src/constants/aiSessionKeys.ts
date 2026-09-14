export const CHAT_ACTIVE_CONVERSATION_KEY = 'workbench:chat:activeConversationId'
export const KNOWLEDGE_ACTIVE_SESSION_KEY = 'workbench:knowledge:activeSessionId'
export const CAMPAIGN_ACTIVE_DRAFT_KEY = 'workbench:campaign:activeDraftId'

export function readStoredId(key: string): number | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const id = Number.parseInt(raw, 10)
    return Number.isFinite(id) && id > 0 ? id : null
  } catch {
    return null
  }
}

export function writeStoredId(key: string, id: number | null) {
  try {
    if (id == null) {
      sessionStorage.removeItem(key)
    } else {
      sessionStorage.setItem(key, String(id))
    }
  } catch {
    // ignore quota / private mode
  }
}
