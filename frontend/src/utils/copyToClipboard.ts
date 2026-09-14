/**
 * 复制文本到剪贴板 — 兼容 HTTP 非安全上下文（Demo 无 navigator.clipboard）。
 */
export async function copyToClipboard(text: string): Promise<void> {
  const value = text.trim()
  if (!value) {
    throw new Error('暂无内容可复制')
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return
    } catch {
      // fall through to legacy
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, value.length)

  try {
    const ok = document.execCommand('copy')
    if (!ok) {
      throw new Error('浏览器不支持复制')
    }
  } finally {
    document.body.removeChild(textarea)
  }
}
