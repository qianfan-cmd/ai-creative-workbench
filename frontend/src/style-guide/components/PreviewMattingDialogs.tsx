import PreviewOpsDialog from './PreviewOpsDialog'
import PreviewHistoryDrawer from './PreviewHistoryDrawer'
import PreviewImageSourcePanel from './PreviewImageSourcePanel'
import PreviewTagAssetDialog from './PreviewTagAssetDialog'
import sectionStyles from './previewSection.module.css'
import styles from './PreviewMattingDialogs.module.css'

export default function PreviewMattingDialogs() {
  return (
    <section className={sectionStyles.section}>
      <div className={sectionStyles.sectionTitle}>抠图 Matting · 对话框、历史抽屉与图片来源三态</div>

      <div className={`${sectionStyles.previewFrame} ${styles.frame}`}>
        <div className={styles.col}>
          <div className={styles.colLabel}>新建任务 Dialog</div>
          <PreviewOpsDialog title="新建抠图任务" showPinToggle />
        </div>
        <div className={styles.col}>
          <div className={styles.colLabel}>历史生成 Drawer</div>
          <div className={styles.drawerWrap}>
            <PreviewHistoryDrawer />
          </div>
        </div>
        <div className={styles.col}>
          <div className={styles.colLabel}>打标入库 Dialog</div>
          <PreviewTagAssetDialog />
        </div>
      </div>

      <div className={styles.sourcesTitle}>图片来源三态对比</div>
      <div className={`${sectionStyles.previewFrame} ${styles.sourcesFrame}`}>
        <div className={styles.sourceCol}>
          <div className={styles.colLabel}>直接上传</div>
          <PreviewImageSourcePanel contextLabel="源图" mode="upload" compact />
        </div>
        <div className={styles.sourceCol}>
          <div className={styles.colLabel}>素材库 · 已有素材</div>
          <PreviewImageSourcePanel contextLabel="源图" mode="library-existing" compact />
        </div>
        <div className={styles.sourceCol}>
          <div className={styles.colLabel}>素材库 · AI 生图入库</div>
          <PreviewImageSourcePanel contextLabel="源图" mode="library-ai" compact />
        </div>
      </div>
    </section>
  )
}
