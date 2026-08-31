import { CheckOutlined } from '@ant-design/icons'
import styles from '@/components/ops/CandidateGallery.module.css'

export interface CandidateItem {
  url: string
  index: number
}

interface CandidateGalleryProps {
  candidates: CandidateItem[]
  selectedIndex?: number | null
  onSelect?: (index: number) => void
  className?: string
}

export default function CandidateGallery({
  candidates,
  selectedIndex,
  onSelect,
  className,
}: CandidateGalleryProps) {
  const selected = selectedIndex ?? null

  return (
    <div className={[styles.wrap, className].filter(Boolean).join(' ')}>
      <div className={styles.grid}>
        {candidates.map((item) => (
          <button
            key={`${item.url}-${item.index}`}
            type="button"
            className={[styles.card, selected === item.index ? styles.cardSelected : ''].join(' ')}
            onClick={() => onSelect?.(item.index)}
          >
            <div className={styles.thumb}>
              <img src={item.url} alt={`候选 ${item.index + 1}`} className={styles.img} />
              {selected === item.index && (
                <span className={styles.checkMark}>
                  <CheckOutlined />
                </span>
              )}
            </div>
            <div className={styles.label}>候选 {String.fromCharCode(65 + item.index)}</div>
          </button>
        ))}
      </div>
      <div className={styles.footer}>
        已选 <strong>{selected != null ? 1 : 0}</strong> / {candidates.length}
      </div>
    </div>
  )
}
