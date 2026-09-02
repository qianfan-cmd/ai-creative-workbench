import { useEffect, useRef } from 'react'

/** 按 scroll 比例映射：A 滚到 30%，B 也滚到 30% */
function applyScrollRatio(from: HTMLElement, to: HTMLElement) {
    // scrollHeight 是元素内容总高度，clientHeight 是元素可视区域高度包括content和padding
  const fromMax = from.scrollHeight - from.clientHeight // from最多还能滚多少像素（最大scrollTop，意思是当前向上滚了多少像素)
  const toMax = to.scrollHeight - to.clientHeight
  if (fromMax <= 0 || toMax <= 0) return

  const ratio = from.scrollTop / fromMax
  to.scrollTop = ratio * toMax
}

/**
 * 双向滚动同步（比例法，适合 Markdown 源码 vs 渲染预览）
 * @param sourceEl 左栏滚动容器（CodeMirror 的 view.scrollDOM）
 * @param targetEl 右栏滚动容器（previewBody div）
 */
export function useScrollSync(
  sourceEl: HTMLElement | null,
  targetEl: HTMLElement | null,
) {
  const syncingRef = useRef(false) // 存正在同步标识，改ref不触发重新渲染

  useEffect(() => {
    if (!sourceEl || !targetEl) return

    const onSourceScroll = () => {
      if (syncingRef.current) return
      syncingRef.current = true
      applyScrollRatio(sourceEl, targetEl)
      syncingRef.current = false
    }

    const onTargetScroll = () => {
      if (syncingRef.current) return // .current 取最新值
      syncingRef.current = true
      applyScrollRatio(targetEl, sourceEl)
      syncingRef.current = false
    }

    // { passive: true } 表示滚动事件不会阻止默认行为
    sourceEl.addEventListener('scroll', onSourceScroll, { passive: true })
    targetEl.addEventListener('scroll', onTargetScroll, { passive: true })

    return () => {
      sourceEl.removeEventListener('scroll', onSourceScroll)
      targetEl.removeEventListener('scroll', onTargetScroll)
    }
  }, [sourceEl, targetEl])
}