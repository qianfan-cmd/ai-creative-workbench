import styles from './PreviewAssetGrid.module.css'

interface MockAsset {
  id: number
  name: string
  type: string
  size: string
  hasPreview?: boolean
  previewColor?: string
}

const MOCK_ASSETS: MockAsset[] = [
  { id: 1, name: 'hero-banner-v2.png', type: 'image/png', size: '1.2 MB', hasPreview: true, previewColor: '#334155' },
  { id: 2, name: 'character-sprite.png', type: 'image/png', size: '840 KB', hasPreview: true, previewColor: '#f97316' },
  { id: 3, name: 'icon-set.svg', type: 'image/svg+xml', size: '56 KB' },
  { id: 4, name: 'promo-cutscene.mp4', type: 'video/mp4', size: '12.4 MB', hasPreview: true, previewColor: '#334155' },
  { id: 5, name: 'brand-guide.pdf', type: 'application/pdf', size: '2.1 MB' },
  { id: 6, name: 'ui-kit.fig', type: 'application/octet-stream', size: '4.8 MB' },
]

export default function PreviewAssetGrid() {
  return (
    <div className={styles.grid}>
      {MOCK_ASSETS.map((asset) => (
        <div key={asset.id} className={styles.card}>
          <div className={styles.thumbnail}>
            {asset.hasPreview ? (
              <div
                className={styles.previewFill}
                style={{ backgroundColor: asset.previewColor }}
              />
            ) : (
              <div className={styles.checkerboard} />
            )}
            <div className={styles.typeBadge}>{asset.type.split('/')[1]?.toUpperCase() ?? 'FILE'}</div>
            <div className={styles.overlay}>
              <span className={styles.overlayBtn}>查看</span>
              <span className={styles.overlayBtn}>删除</span>
            </div>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.cardName}>{asset.name}</div>
            <div className={styles.cardMeta}>
              <span className={styles.mono}>{asset.type}</span> · {asset.size}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
