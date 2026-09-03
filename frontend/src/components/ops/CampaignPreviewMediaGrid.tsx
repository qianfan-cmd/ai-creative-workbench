import {
  chunkUrlsIntoRows,
  getPreviewMediaRowSizes,
  getRowColumnCount,
  type PreviewMediaPlatform,
} from '@/components/ops/campaignPreviewMediaLayout'
import styles from '@/components/ops/CampaignPreviewMediaGrid.module.css'

interface CampaignPreviewMediaGridProps {
  urls: string[]
  platform: PreviewMediaPlatform
  aspectLabel?: string
  className?: string
}

export default function CampaignPreviewMediaGrid({
  urls,
  platform,
  aspectLabel = '16:9 封面',
  className,
}: CampaignPreviewMediaGridProps) {
  const count = urls.length

  if (count === 0) {
    if (platform !== 'web') return null
    return (
      <div className={[styles.placeholder, className].filter(Boolean).join(' ')}>
        <span className={styles.placeholderBadge}>{aspectLabel}</span>
      </div>
    )
  }

  const rowSizes = getPreviewMediaRowSizes(count, platform)
  const rows = chunkUrlsIntoRows(urls, rowSizes)
  const singleWebWide = platform === 'web' && count === 1

  return (
    <div className={[styles.wrap, className].filter(Boolean).join(' ')}>
      {rows.map((rowUrls, rowIndex) => {
        const rowSize = rowSizes[rowIndex] ?? rowUrls.length
        const columns = getRowColumnCount(rowSize, platform, count)
        return (
          <div
            key={`row-${rowIndex}`}
            className={styles.row}
            style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
          >
            {rowUrls.map((url, cellIndex) => (
              <img
                key={`${url}-${cellIndex}`}
                src={url}
                alt=""
                className={[
                  styles.img,
                  singleWebWide ? styles.imgWebSingle : '',
                  platform === 'mobile' ? styles.imgMobile : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
