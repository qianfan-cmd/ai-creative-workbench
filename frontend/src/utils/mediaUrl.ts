/** 归一化媒体 URL：本地绝对地址 → Vite proxy 相对路径 */
export function normalizeMediaUrl(url: string | null | undefined): string {
  if (!url) return ''
  const trimmed = url.trim()
  if (!trimmed) return ''

  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const parsed = new URL(trimmed)
      const host = parsed.hostname.toLowerCase()
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        host === '0.0.0.0'
      ) {
        if (parsed.pathname.startsWith('/uploads/')) {
          return parsed.pathname
        }
      }
    }
  } catch {
    /* keep original */
  }

  if (trimmed.startsWith('uploads/')) {
    return `/${trimmed}`
  }

  return trimmed
}
