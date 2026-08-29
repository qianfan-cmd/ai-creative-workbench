import { CheckOutlined } from '@ant-design/icons'
import styles from './PreviewCandidateGallery.module.css'

export interface CandidateItem {
  id: string
  label?: string
  selected?: boolean
  previewColor?: string
  checkerboard?: boolean
}

interface PreviewCandidateGalleryProps {
  items: CandidateItem[]
  selectedCount?: number
  className?: string
}

export default function PreviewCandidateGallery({
  items,
  selectedCount,
  className,
}: PreviewCandidateGalleryProps) {
  const count = selectedCount ?? items.filter((i) => i.selected).length

  return (
    <div className={`${styles.wrap} ${className ?? ''}`}>
      <div className={styles.grid}>
        {items.map((item) => (
          <div
            key={item.id}
            className={`${styles.card} ${item.selected ? styles.card_selected : ''}`}
          >
            <div className={styles.thumb}>
              {item.checkerboard !== false && !item.previewColor ? (
                <div className={styles.checkerboard} />
              ) : (
                <div
                  className={styles.previewFill}
                  style={item.previewColor ? { backgroundColor: item.previewColor } : undefined}
                />
              )}
              {item.selected && (
                <span className={styles.checkMark}>
                  <CheckOutlined />
                </span>
              )}
            </div>
            {item.label && <div className={styles.label}>{item.label}</div>}
          </div>
        ))}
      </div>
      <div className={styles.footer}>
        已选 <strong>{count}</strong> / {items.length}
      </div>
    </div>
  )
}
