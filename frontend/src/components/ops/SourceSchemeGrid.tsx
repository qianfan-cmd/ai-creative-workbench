import { DeleteOutlined } from '@ant-design/icons'
import type { MattingSourceScheme } from '@/api/ops'
import styles from '@/components/ops/SourceSchemeGrid.module.css'

interface SourceSchemeGridProps {
  schemes: MattingSourceScheme[]
  onToggleSelect: (id: string, selected: boolean) => void
  onDelete: (id: string) => void
  onPreview: (url: string, alt?: string) => void
}

export default function SourceSchemeGrid({
  schemes,
  onToggleSelect,
  onDelete,
  onPreview,
}: SourceSchemeGridProps) {
  if (schemes.length === 0) {
    return <p className={styles.empty}>暂无 AI 方案，在下方输入描述并发送生成</p>
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
            <img src={scheme.imageUrl} alt={scheme.prompt ?? `方案 ${index + 1}`} className={styles.image} />
          </button>
          <footer className={styles.footer}>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={!!scheme.selected}
                onChange={(e) => onToggleSelect(scheme.id, e.target.checked)}
              />
              选为源图
            </label>
            <button type="button" className={styles.deleteBtn} onClick={() => onDelete(scheme.id)} title="删除">
              <DeleteOutlined />
            </button>
          </footer>
        </article>
      ))}
    </div>
  )
}
