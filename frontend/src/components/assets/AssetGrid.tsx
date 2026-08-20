import type { AssetVO } from '@/types/api'
import AssetGridCard from './AssetGridCard'
import styles from './AssetGrid.module.css'

interface AssetGridProps {
  assets: AssetVO[]
  onView?: (asset: AssetVO) => void
  onEdit?: (asset: AssetVO) => void
  onDelete?: (asset: AssetVO) => void
}

export default function AssetGrid({ assets, onView, onEdit, onDelete }: AssetGridProps) {
  return (
    <div className={styles.grid}>
      {assets.map((asset) => (
        <AssetGridCard
          key={asset.id}
          asset={asset}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
