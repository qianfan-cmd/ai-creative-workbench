import type { AssetVO } from '@/types/api'
import { formatFileSize, formatMimeBadge } from '@/utils/format'
import styles from './AssetGrid.module.css'

interface AssetGridProps {
  assets: AssetVO[]
  onView?: (asset: AssetVO) => void
  onEdit?: (asset: AssetVO) => void
  onDelete?: (asset: AssetVO) => void
}

function isImageAsset(type: string) {
  return type.startsWith('image/')
}

export default function AssetGrid({ assets, onView, onEdit, onDelete }: AssetGridProps) {
  return (
    <div className={styles.grid}>
      {assets.map((asset) => (
        <article key={asset.id} className={styles.card}>
          <div className={styles.thumbnail}>
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
      ))}
    </div>
  )
}