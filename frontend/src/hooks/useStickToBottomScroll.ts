import { useCallback, useEffect, useRef } from 'react'

function isNearBottom(el: HTMLElement, threshold = 120) {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold
}

function scrollToBottom(el: HTMLElement) {
  el.scrollTop = el.scrollHeight
}

export function useStickToBottomScroll(deps: unknown[] = []) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const forceScrollRef = useRef(false)
  const stickToBottomRef = useRef(true)

  const forceScrollToBottom = useCallback(() => {
    forceScrollRef.current = true
    stickToBottomRef.current = true
  }, [])

  const notifyContentChanged = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    if (forceScrollRef.current || (stickToBottomRef.current && isNearBottom(el))) {
      requestAnimationFrame(() => scrollToBottom(el))
      forceScrollRef.current = false
    }
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const onScroll = () => {
      stickToBottomRef.current = isNearBottom(el)
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    notifyContentChanged()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { scrollRef, forceScrollToBottom, notifyContentChanged }
}
