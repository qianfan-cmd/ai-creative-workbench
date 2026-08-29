import { CloseOutlined } from '@ant-design/icons'
import styles from './PreviewHistoryDrawer.module.css'

const HISTORY_ITEMS = [
  { id: '1', label: '候选 1 · 2026-08-28 14:32', stage: '抠图' },
  { id: '2', label: '候选 2 · 2026-08-28 14:30', stage: '抠图' },
  { id: '3', label: '候选 3 · 2026-08-27 09:15', stage: '抠图' },
]

interface PreviewHistoryDrawerProps {
  title?: string
  className?: string
}

export default function PreviewHistoryDrawer({
  title = '历史生成',
  className,
}: PreviewHistoryDrawerProps) {
  return (
    <div className={`${styles.panel} ${className ?? ''}`}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        <button type="button" className={styles.closeBtn} aria-label="关闭">
          <CloseOutlined />
        </button>
      </div>
      <div className={styles.list}>
        {HISTORY_ITEMS.map((item) => (
          <div key={item.id} className={styles.item}>
            <div className={styles.thumb}>
              <div className={styles.checkerboard} />
            </div>
            <div className={styles.meta}>
              <span className={styles.itemLabel}>{item.label}</span>
              <span className={styles.stage}>{item.stage}</span>
            </div>
            <button type="button" className={styles.useBtn}>选用</button>
          </div>
        ))}
      </div>
    </div>
  )
}
