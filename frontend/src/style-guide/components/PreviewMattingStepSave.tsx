import { CheckOutlined, DownloadOutlined, HistoryOutlined } from '@ant-design/icons'
import PreviewMattingStepFrame from './PreviewMattingStepFrame'
import sectionStyles from './previewSection.module.css'
import styles from './PreviewMattingStepSave.module.css'

const EXPORT_ITEMS = [
  { name: '吉祥物' },
  { name: '道具图标' },
  { name: '光效层' },
]

export default function PreviewMattingStepSave() {
  return (
    <div className={sectionStyles.section}>
      <PreviewMattingStepFrame
        activeStep="5"
        sectionTitle="抠图 Matting · 步骤 ⑤ 保存"
        footerExtra={
          <button type="button" className={styles.historyBtn}>
            <HistoryOutlined />
            历史图片
          </button>
        }
      >
        <div className={styles.shell}>
          <div className={styles.success}>
            <CheckOutlined className={styles.successIcon} />
            <span>
              已完成去背景处理，共 <strong>3</strong> 张元素图片
            </span>
          </div>

          <div className={styles.grid}>
            {EXPORT_ITEMS.map((item) => (
              <div key={item.name} className={styles.card}>
                <div className={styles.cardThumb}>
                  <div className={styles.checkerboard} />
                </div>
                <span className={styles.cardName}>{item.name}</span>
                <button type="button" className={styles.cardDl}>
                  <DownloadOutlined />
                  下载
                </button>
              </div>
            ))}
          </div>

          <div className={styles.options}>
            <label className={styles.optionCheck}>
              <span className={styles.checkboxChecked} />
              同时保存源图到素材库
            </label>
            <div className={styles.tagMock}>matted, 吉祥物</div>
          </div>
        </div>
      </PreviewMattingStepFrame>
    </div>
  )
}
