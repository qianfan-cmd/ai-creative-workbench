import PreviewImageSourcePanel from './PreviewImageSourcePanel'
import sectionStyles from './previewSection.module.css'
import styles from './PreviewCampaignImageSources.module.css'

const MODES = [
  { mode: 'upload' as const, label: '直接上传' },
  { mode: 'library-existing' as const, label: '素材库 · 已有素材' },
  { mode: 'library-ai' as const, label: '素材库 · AI 生图入库' },
]

export default function PreviewCampaignImageSources() {
  return (
    <section className={sectionStyles.section}>
      <div className={sectionStyles.sectionTitle}>活动帖 Campaign · 参考图来源三态</div>
      <div className={`${sectionStyles.previewFrame} ${styles.frame}`}>
        {MODES.map(({ mode, label }) => (
          <div key={mode} className={styles.col}>
            <div className={styles.colLabel}>{label}</div>
            <PreviewImageSourcePanel contextLabel="参考图" mode={mode} compact />
          </div>
        ))}
      </div>
    </section>
  )
}
