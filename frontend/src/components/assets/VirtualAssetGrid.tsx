import { useEffect, useMemo, useState, type RefObject } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { AssetVO } from '@/types/api'
import AssetGridCard from './AssetGridCard'
import styles from './VirtualAssetGrid.module.css'

const GRID_GAP = 12
const MIN_COL_WIDTH = 180
/** 卡片体（文件名 + meta + padding）估算高度 */
const CARD_BODY_HEIGHT = 64

interface VirtualAssetGridProps {
  assets: AssetVO[]
  scrollRef: RefObject<HTMLDivElement | null>
  selectedIds?: number[]
  onToggleSelect?: (asset: AssetVO) => void
  onView?: (asset: AssetVO) => void
  onEdit?: (asset: AssetVO) => void
  onDelete?: (asset: AssetVO) => void
}

function getColumnCount(width: number) {
  if (width <= 0) return 1
  return Math.max(1, Math.floor((width + GRID_GAP) / (MIN_COL_WIDTH + GRID_GAP)))
}

function getColumnWidth(width: number, columnCount: number) {
  return (width - GRID_GAP * (columnCount - 1)) / columnCount
}

function getRowHeight(columnWidth: number) {
  return columnWidth * 0.75 + CARD_BODY_HEIGHT + GRID_GAP
}

export default function VirtualAssetGrid({
  assets,
  scrollRef,
  selectedIds = [],
  onToggleSelect,
  onView,
  onEdit,
  onDelete,
}: VirtualAssetGridProps) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const updateWidth = () => setContainerWidth(el.clientWidth)
    updateWidth()

    const observer = new ResizeObserver(updateWidth)
    observer.observe(el)
    return () => observer.disconnect()
  }, [scrollRef])

  const columnCount = getColumnCount(containerWidth)
  const columnWidth = getColumnWidth(containerWidth, columnCount)
  const rowCount = Math.ceil(assets.length / columnCount)
  const rowHeight = getRowHeight(columnWidth)

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 2,
  })

  useEffect(() => {
    rowVirtualizer.measure()
  }, [columnCount, rowHeight]) // eslint-disable-line react-hooks/exhaustive-deps

  const virtualRows = rowVirtualizer.getVirtualItems()

  const gridTemplateColumns = useMemo(
    () => `repeat(${columnCount}, minmax(0, 1fr))`,
    [columnCount],
  )

  // 滚动容器尚未量出高度时，虚拟列表可能不算可见行，先全量渲染兜底
  if (assets.length > 0 && virtualRows.length === 0) {
    return (
      <div
        className={styles.gridRow}
        style={{ gridTemplateColumns, gap: GRID_GAP }}
      >
        {assets.map((asset) => (
          <AssetGridCard
            key={asset.id}
            asset={asset}
            selected={selectedSet.has(asset.id)}
            onToggleSelect={onToggleSelect}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={styles.virtualRoot}
      style={{ height: rowVirtualizer.getTotalSize() }}
    >
      {virtualRows.map((virtualRow) => {
        const startIndex = virtualRow.index * columnCount
        const rowAssets = assets.slice(startIndex, startIndex + columnCount)

        return (
          <div
            key={virtualRow.key}
            className={styles.virtualRow}
            style={{
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <div
              className={styles.gridRow}
              style={{ gridTemplateColumns, gap: GRID_GAP }}
            >
              {rowAssets.map((asset) => (
                <AssetGridCard
                  key={asset.id}
                  asset={asset}
                  selected={selectedSet.has(asset.id)}
                  onToggleSelect={onToggleSelect}
                  onView={onView}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
