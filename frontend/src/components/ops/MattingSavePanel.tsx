import { CheckOutlined, DownloadOutlined, LoadingOutlined } from '@ant-design/icons'
import { Select } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import type { MattingExtractStatusVO } from '@/api/ops'
import type { TagVO } from '@/api/tags'
import { normalizeMediaUrl } from '@/utils/mediaUrl'
import styles from '@/components/ops/MattingSavePanel.module.css'

interface MattingSavePanelProps {
  status: MattingExtractStatusVO | null
  saveSourceToAssets: boolean
  onSaveSourceChange: (checked: boolean) => void
  sourceTagIds: number[]
  onSourceTagIdsChange: (ids: number[]) => void
  availableTags: TagVO[]
  sourceCount: number
}

export default function MattingSavePanel({
  status,
  saveSourceToAssets,
  onSaveSourceChange,
  sourceTagIds,
  onSourceTagIdsChange,
  availableTags,
  sourceCount,
}: MattingSavePanelProps) {
  const [brokenNames, setBrokenNames] = useState<Set<string>>(() => new Set())

  const items = useMemo(() => {
    return (status?.elements ?? [])
      .map((el) => {
        const selected = el.images.find((img) => img.selected && img.url)
        if (!selected?.url) return null
        return { name: el.elementName, url: selected.url }
      })
      .filter(Boolean) as { name: string; url: string }[]
  }, [status])

  const markBroken = (name: string) => {
    setBrokenNames((prev) => {
      if (prev.has(name)) return prev
      const next = new Set(prev)
      next.add(name)
      return next
    })
  }

  const count = items.length
  const itemsKey = items.map((i) => `${i.name}:${i.url}`).join('|')

  useEffect(() => {
    setBrokenNames(new Set())
  }, [itemsKey])

  if (status == null) {
    return (
      <div className={styles.shell}>
        <div className={styles.loadingSlot}>
          <LoadingOutlined spin />
          <span>加载保存结果…</span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <div className={styles.success}>
        <CheckOutlined className={styles.successIcon} />
        <span>
          已完成去背景处理，共 <strong>{count}</strong> 张元素图片
        </span>
      </div>

      <div className={styles.grid}>
        {items.map((item) => (
          <div key={item.name} className={styles.card}>
            <div className={styles.cardThumb}>
              {brokenNames.has(item.name) ? (
                <span className={styles.imageExpired}>图片加载失败</span>
              ) : (
                <img
                  src={normalizeMediaUrl(item.url)}
                  alt=""
                  className={styles.cardImg}
                  onError={() => markBroken(item.name)}
                />
              )}
            </div>
            <span className={styles.cardName}>{item.name}</span>
            <a
              href={normalizeMediaUrl(item.url)}
              download
              className={styles.cardDl}
              target="_blank"
              rel="noreferrer"
            >
              <DownloadOutlined />
              下载
            </a>
          </div>
        ))}
      </div>

      <div className={styles.options}>
        <label className={styles.optionCheck}>
          <input
            type="checkbox"
            checked={saveSourceToAssets}
            onChange={(e) => onSaveSourceChange(e.target.checked)}
          />
          {sourceCount > 1
            ? `同时保存全部 ${sourceCount} 张源图到素材库`
            : '同时保存源图到素材库'}
        </label>
        {saveSourceToAssets && (
          <Select
            mode="multiple"
            className={styles.tagSelect}
            placeholder="源图标签"
            value={sourceTagIds}
            onChange={onSourceTagIdsChange}
            options={(availableTags ?? []).map((t) => ({ value: t.id, label: t.name }))}
          />
        )}
        <div className={styles.tagMock}>matted</div>
      </div>
    </div>
  )
}
