import PreviewMattingStepFrame from './PreviewMattingStepFrame'
import sectionStyles from './previewSection.module.css'
import styles from './PreviewMattingStepSave.module.css'

export default function PreviewMattingStepSave() {
  return (
    <div className={sectionStyles.section}>
      <PreviewMattingStepFrame activeStep="4" sectionTitle="抠图 Matting · 步骤 ④ 保存">
        <div className={styles.previewBlock}>
          <div className={styles.largePreview}>
            <div className={styles.checkerboard} />
          </div>
          <div className={styles.previewMeta}>
            <span className={styles.previewLabel}>已选候选</span>
            <span className={styles.previewName}>候选 A · 透明 PNG</span>
            <span className={styles.previewCount}>共选 2 张，将写入 Assets</span>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>标签</label>
          <div className={styles.inputMock}>吉祥物, matted</div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>保存说明</label>
          <div className={styles.textareaMock}>牛客活动主视觉抠图，供 Campaign 参考图使用</div>
        </div>
      </PreviewMattingStepFrame>
    </div>
  )
}
