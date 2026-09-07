import type { AssetVO } from '@/types/api'
import { formatFileSize, formatMimeBadge } from '@/utils/format'
import styles from './AssetGrid.module.css'

interface AssetGridCardProps {
  asset: AssetVO
  selected?: boolean
  onToggleSelect?: (asset: AssetVO) => void
  onView?: (asset: AssetVO) => void
  onEdit?: (asset: AssetVO) => void
  onDelete?: (asset: AssetVO) => void
}

function isImageAsset(type: string) {
  return type.startsWith('image/')
}

export default function AssetGridCard({
  asset,
  selected = false,
  onToggleSelect,
  onView,
  onEdit,
  onDelete,
}: AssetGridCardProps) {
  return (
    <article className={`${styles.card} ${selected ? styles.cardSelected : ''}`}>
      <div className={styles.thumbnail}>
        {onToggleSelect && (
          <label className={styles.selectBox}>
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(asset)}
              onClick={(e) => e.stopPropagation()}
            />
          </label>
        )}
        {isImageAsset(asset.type) ? (
          <img
            className={styles.previewImage}
            src={asset.url}
            alt={asset.name}
            loading="lazy"
          />
        ) : (
          <div className={styles.checkerboard} />
        )}

        <div className={styles.typeBadge}>{formatMimeBadge(asset.type)}</div>

        <div className={styles.overlay}>
          <button
            type="button"
            className={styles.overlayBtn}
            onClick={() => onView?.(asset)}
          >
            查看
          </button>
          <button
            type="button"
            className={styles.overlayBtn}
            onClick={() => onEdit?.(asset)}
          >
            编辑
          </button>
          <button
            type="button"
            className={`${styles.overlayBtn} ${styles.overlayBtnDanger}`}
            onClick={() => onDelete?.(asset)}
          >
            删除
          </button>
        </div>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardName} title={asset.name}>
          {asset.name}
        </div>
        <div className={styles.cardMeta}>
          <span className={styles.mono}>{asset.type}</span>
          {' · '}
          {formatFileSize(asset.size)}
        </div>
      </div>
    </article>
  )
}
