import { BorderOutlined } from '@ant-design/icons'
import PreviewMattingStepFrame from './PreviewMattingStepFrame'
import sectionStyles from './previewSection.module.css'
import styles from './PreviewMattingStepConfig.module.css'

export default function PreviewMattingStepConfig() {
  return (
    <div className={sectionStyles.section}>
      <PreviewMattingStepFrame activeStep="2" sectionTitle="抠图 Matting · 步骤 ② 配置">
        <div className={styles.sourceBar}>
          <div className={styles.sourceThumb}>
            <div className={styles.checkerboard} />
          </div>
          <div className={styles.sourceMeta}>
            <span className={styles.sourceLabel}>当前源图</span>
            <span className={styles.sourceName}>hero-mascot.png · 直接上传</span>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>抠图模板</label>
          <div className={styles.selectMock}>吉祥物透明底</div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Prompt</label>
          <div className={styles.textareaMock}>保留主体轮廓，去除背景，边缘平滑无锯齿</div>
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label}>模型</label>
            <div className={styles.selectMock}>rembg-v2</div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>可选</label>
            <button type="button" className={styles.regionBtn}>
              <BorderOutlined />
              框选区域
            </button>
          </div>
        </div>
      </PreviewMattingStepFrame>
    </div>
  )
}
