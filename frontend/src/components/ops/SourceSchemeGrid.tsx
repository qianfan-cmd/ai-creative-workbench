import { DeleteOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useState } from 'react'
import type { MattingSourceScheme } from '@/api/ops'
import styles from '@/components/ops/SourceSchemeGrid.module.css'

interface SourceSchemeGridProps {
  schemes: MattingSourceScheme[]
  onToggleSelect: (id: string, selected: boolean) => void
  onDelete: (id: string) => void
  onPreview: (url: string, alt?: string) => void
  onAddToLibrary?: (scheme: MattingSourceScheme) => void | Promise<void>
}

export default function SourceSchemeGrid({
  schemes,
  onToggleSelect,
  onDelete,
  onPreview,
  onAddToLibrary,
}: SourceSchemeGridProps) {
  const [importingId, setImportingId] = useState<string | null>(null)
  const [brokenIds, setBrokenIds] = useState<Set<string>>(() => new Set())

  if (schemes.length === 0) {
    return <p className={styles.empty}>暂无 AI 方案，在下方输入描述并发送生成</p>
  }

  const handleAddToLibrary = async (scheme: MattingSourceScheme) => {
    if (!onAddToLibrary || importingId != null) return
    setImportingId(scheme.id)
    try {
      await onAddToLibrary(scheme)
    } finally {
      setImportingId(null)
    }
  }

  const markBroken = (id: string) => {
    setBrokenIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  return (
    <div className={styles.grid}>
      {schemes.map((scheme, index) => (
        <article
          key={scheme.id}
          className={[styles.card, scheme.selected ? styles.cardSelected : ''].filter(Boolean).join(' ')}
        >
          <button
            type="button"
            className={styles.imageBtn}
            onClick={() => onPreview(scheme.imageUrl, scheme.prompt ?? `方案 ${index + 1}`)}
          >
            {brokenIds.has(scheme.id) ? (
              <span className={styles.imageExpired}>图片链接已过期，请再生成</span>
            ) : (
              <img
                src={scheme.imageUrl}
                alt={scheme.prompt ?? `方案 ${index + 1}`}
                className={styles.image}
                onError={() => markBroken(scheme.id)}
              />
            )}
          </button>
          <footer className={styles.footer}>
            <div className={styles.footerLeft}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={!!scheme.selected}
                  onChange={(e) => onToggleSelect(scheme.id, e.target.checked)}
                />
                选为源图
              </label>
              {onAddToLibrary ? (
                <Button
                  type="link"
                  size="small"
                  className={styles.libraryBtn}
                  loading={importingId === scheme.id}
                  disabled={importingId != null && importingId !== scheme.id}
                  onClick={() => void handleAddToLibrary(scheme)}
                >
                  加入素材库
                </Button>
              ) : null}
            </div>
            <button type="button" className={styles.deleteBtn} onClick={() => onDelete(scheme.id)} title="删除">
              <DeleteOutlined />
            </button>
          </footer>
        </article>
      ))}
    </div>
  )
}
