import { ScissorOutlined } from '@ant-design/icons'
import PreviewTaskSidebar from './PreviewTaskSidebar'
import sectionStyles from './previewSection.module.css'
import styles from './PreviewMattingWelcome.module.css'

const SIDEBAR_PROPS = {
  pinned: [{ id: 'p1', title: '牛客吉祥物抠图', pinned: true }],
  ungrouped: [
    { id: 'u1', title: '道具图标 batch' },
    { id: 'u2', title: 'UI 元素提取' },
  ],
  groups: [
    {
      id: 'g1',
      name: '活动素材',
      tasks: [{ id: 't1', title: '夏日 banner 源图' }],
    },
  ],
}

export default function PreviewMattingWelcome() {
  return (
    <section className={sectionStyles.section}>
      <div className={sectionStyles.sectionTitle}>抠图 Matting · 初始空态</div>
      <div className={`${sectionStyles.previewFrame} ${styles.frame}`}>
        <PreviewTaskSidebar {...SIDEBAR_PROPS} />

        <div className={styles.welcome}>
          <span className={styles.icon} aria-hidden="true">
            <ScissorOutlined />
          </span>
          <h2 className={styles.title}>抠图工作台 Matting</h2>
          <p className={styles.desc}>从左侧新建任务，或选择已有任务继续</p>
        </div>
      </div>
    </section>
  )
}
