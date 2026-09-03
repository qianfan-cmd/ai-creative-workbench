/** SSE 文本 chunk 归一化 — 兼容 JSON 字符串、{ content } 对象、裸文本 */

export function extractSseTextChunk(data: string): string {
  if (!data) return ''

  try {
    const parsed: unknown = JSON.parse(data)
    if (typeof parsed === 'string') return parsed
    if (parsed && typeof parsed === 'object' && 'content' in parsed) {
      const content = (parsed as { content?: unknown }).content
      return content == null ? '' : String(content)
    }
  } catch {
    // 裸文本 fallback
  }

  return data
}

export interface SseTextStreamHandlers {
  onChunk: (chunk: string) => void
  onDone: () => void
}

/**
 * 读取 fetch ReadableStream 的 SSE 文本流。
 * message 事件或无 event 名的 data 行均视为文本 chunk。
 */
export async function readSseTextStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  handlers: SseTextStreamHandlers,
): Promise<void> {
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim()
        continue
      }

      if (line.startsWith('data:')) {
        const data = line.slice(5).trim()

        if (currentEvent === 'done' || data === '[DONE]') {
          handlers.onDone()
        } else if (currentEvent === 'error') {
          throw new Error(data || '流式服务错误')
        } else if (currentEvent === 'message' || currentEvent === '') {
          const chunk = extractSseTextChunk(data)
          if (chunk) handlers.onChunk(chunk)
        }
        continue
      }

      if (line === '') currentEvent = ''
    }
  }

  handlers.onDone()
}
