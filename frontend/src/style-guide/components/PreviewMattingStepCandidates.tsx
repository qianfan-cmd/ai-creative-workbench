import { CheckOutlined, ExpandOutlined, LoadingOutlined, PlusOutlined } from '@ant-design/icons'
import PreviewMattingStepFrame from './PreviewMattingStepFrame'
import sectionStyles from './previewSection.module.css'
import styles from './PreviewMattingStepCandidates.module.css'

export default function PreviewMattingStepCandidates() {
  return (
    <div className={sectionStyles.section}>
      <PreviewMattingStepFrame activeStep="4" sectionTitle="抠图 Matting · 步骤 ④ 候选">
        <div className={styles.shell}>
          <div className={styles.progRow}>
            <span className={styles.progSource}>区域 1 · 2/3 元素已完成</span>
            <span className={styles.badgeDone}>
              <CheckOutlined />
              提取完成
            </span>
          </div>

          <div className={styles.scroll}>
            <div className={styles.elemCard}>
              <div className={styles.elemName}>吉祥物</div>
              <div className={styles.thumbRow}>
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`${styles.thumb} ${i === 0 ? styles.thumb_selected : ''}`}
                  >
                    <button type="button" className={styles.thumbDetail} aria-label="预览大图">
                      <ExpandOutlined />
                    </button>
                    <div className={styles.checkerboard} />
                    {i === 0 && (
                      <span className={styles.thumbCheck}>
                        <CheckOutlined />
                      </span>
                    )}
                  </div>
                ))}
                <button type="button" className={styles.regenSlot}>
                  <PlusOutlined />
                  再生成
                </button>
              </div>
            </div>

            <div className={styles.elemCard}>
              <div className={styles.elemName}>道具图标</div>
              <div className={styles.thumbRow}>
                <div className={styles.loadingSlot}>
                  <LoadingOutlined spin />
                  <span>提取中…</span>
                </div>
              </div>
            </div>

            <div className={styles.regionDivider}>区域 2</div>

            <div className={styles.elemCard}>
              <div className={styles.elemName}>光效层</div>
              <div className={styles.thumbRow}>
                {[0, 1].map((i) => (
                  <div key={i} className={`${styles.thumb} ${i === 1 ? styles.thumb_selected : ''}`}>
                    <button type="button" className={styles.thumbDetail} aria-label="预览大图">
                      <ExpandOutlined />
                    </button>
                    <div className={styles.checkerboard} />
                    {i === 1 && (
                      <span className={styles.thumbCheck}>
                        <CheckOutlined />
                      </span>
                    )}
                  </div>
                ))}
                <button type="button" className={styles.regenSlot}>
                  <PlusOutlined />
                  再生成
                </button>
              </div>
            </div>
          </div>
        </div>
      </PreviewMattingStepFrame>
    </div>
  )
}
