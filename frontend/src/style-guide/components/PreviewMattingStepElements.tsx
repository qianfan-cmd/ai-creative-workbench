import { EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import PreviewMattingStepFrame from './PreviewMattingStepFrame'
import sectionStyles from './previewSection.module.css'
import styles from './PreviewMattingStepElements.module.css'

const ELEMENTS = [
  { name: '吉祥物', checked: true },
  { name: '道具图标', checked: true },
  { name: '背景杂物', checked: false },
]

export default function PreviewMattingStepElements() {
  return (
    <div className={sectionStyles.section}>
      <PreviewMattingStepFrame activeStep="3" sectionTitle="抠图 Matting · 步骤 ③ 元素">
        <div className={styles.shell}>
          <div className={styles.scroll}>
            <div className={styles.sourceBlock}>
              <button type="button" className={styles.sourceThumb} title="查看整图大图">
                <div className={styles.thumbFill} />
              </button>
              <div className={styles.sourceMeta}>
                <span className={styles.sourceKicker}>来源整图</span>
                <span className={styles.sourceName}>hero-mascot.png · 方案 A</span>
              </div>
            </div>

            <div className={styles.regionSection}>
              <div className={styles.regionHdr}>
                <span className={styles.regionAccent} aria-hidden="true" />
                <span className={styles.regionLabel}>区域 1</span>
                <button type="button" className={styles.regionThumbBtn} title="查看区域切图">
                  <div className={styles.regionThumbFill} />
                </button>
                <button type="button" className={styles.regenBtn}>
                  <ReloadOutlined />
                  重新识别
                </button>
              </div>

              <div className={styles.groupBlock}>
                <div className={styles.groupHead}>
                  <span className={styles.groupChev} aria-hidden="true">▼</span>
                  <span className={styles.groupName}>主体</span>
                  <button type="button" className={styles.addBtn} title="添加元素">
                    <PlusOutlined />
                  </button>
                </div>
                <div className={styles.groupBody}>
                  {ELEMENTS.map((el) => (
                    <div key={el.name} className={styles.elementRow}>
                      <span className={`${styles.checkbox} ${el.checked ? styles.checkbox_checked : ''}`} />
                      <span className={styles.elementName}>{el.name}</span>
                      <button type="button" className={styles.editBtn} aria-label="编辑">
                        <EditOutlined />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.regionSection}>
              <div className={styles.regionHdr}>
                <span className={styles.regionAccent} aria-hidden="true" />
                <span className={styles.regionLabel}>区域 2</span>
                <button type="button" className={styles.regionThumbBtn}>
                  <div className={styles.regionThumbFillAlt} />
                </button>
                <button type="button" className={styles.regenBtn}>
                  <ReloadOutlined />
                  重新识别
                </button>
              </div>
              <div className={styles.groupBlock}>
                <div className={styles.groupHead}>
                  <span className={styles.groupChev} aria-hidden="true">▼</span>
                  <span className={styles.groupName}>装饰</span>
                </div>
                <div className={styles.groupBody}>
                  <div className={styles.elementRow}>
                    <span className={`${styles.checkbox} ${styles.checkbox_checked}`} />
                    <span className={styles.elementName}>光效层</span>
                    <button type="button" className={styles.editBtn} aria-label="编辑">
                      <EditOutlined />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PreviewMattingStepFrame>
    </div>
  )
}
