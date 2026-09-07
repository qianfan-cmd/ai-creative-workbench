import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import styles from './VirtualChatMessageList.module.css'

interface VirtualChatMessageListProps<T> {
  items: T[]
  scrollRef: RefObject<HTMLDivElement | null>
  getItemKey: (item: T, index: number) => string
  renderItem: (item: T, index: number) => ReactNode
  estimateSize?: number
  /** 流式输出时用 flex 列布局，避免 absolute 行重叠 */
  disableVirtualization?: boolean
  /** 切换会话时清空行高缓存 */
  listResetKey?: string | number
}

function FlexMeasuredItem({
  itemKey,
  heightCacheRef,
  children,
}: {
  itemKey: string
  heightCacheRef: RefObject<Map<string, number>>
  children: ReactNode
}) {
  const elRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = elRef.current
    if (!el) return

    const update = () => {
      heightCacheRef.current.set(itemKey, el.getBoundingClientRect().height)
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [itemKey, heightCacheRef])

  return (
    <div ref={elRef} className={styles.staticItem}>
      {children}
    </div>
  )
}

export default function VirtualChatMessageList<T>({
  items,
  scrollRef,
  getItemKey,
  renderItem,
  estimateSize = 160,
  disableVirtualization = false,
  listResetKey,
}: VirtualChatMessageListProps<T>) {
  const heightCacheRef = useRef(new Map<string, number>())
  const prevDisableVirtualizationRef = useRef(disableVirtualization)

  useEffect(() => {
    heightCacheRef.current.clear()
  }, [listResetKey])

  const getCachedSize = useCallback(
    (index: number) => {
      const item = items[index]
      if (item == null) return estimateSize
      const key = getItemKey(item, index)
      return heightCacheRef.current.get(key) ?? estimateSize
    },
    [items, getItemKey, estimateSize],
  )

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: getCachedSize,
    overscan: 6,
    measureElement: (el) => el.getBoundingClientRect().height,
  })

  useLayoutEffect(() => {
    if (prevDisableVirtualizationRef.current && !disableVirtualization) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          virtualizer.measure()
        })
      })
    }
    prevDisableVirtualizationRef.current = disableVirtualization
  }, [disableVirtualization, virtualizer])

  useEffect(() => {
    if (disableVirtualization) return
    virtualizer.measure()
  }, [items.length, disableVirtualization, virtualizer])

  if (disableVirtualization) {
    return (
      <div className={styles.staticList}>
        {items.map((item, index) => {
          const key = getItemKey(item, index)
          return (
            <FlexMeasuredItem key={key} itemKey={key} heightCacheRef={heightCacheRef}>
              {renderItem(item, index)}
            </FlexMeasuredItem>
          )
        })}
      </div>
    )
  }

  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div className={styles.root} style={{ height: virtualizer.getTotalSize() }}>
      {virtualItems.map((virtualRow) => {
        const item = items[virtualRow.index]
        return (
          <div
            key={getItemKey(item, virtualRow.index)}
            ref={virtualizer.measureElement}
            data-index={virtualRow.index}
            className={styles.row}
            style={{ transform: `translateY(${virtualRow.start}px)` }}
          >
            {renderItem(item, virtualRow.index)}
          </div>
        )
      })}
    </div>
  )
}
