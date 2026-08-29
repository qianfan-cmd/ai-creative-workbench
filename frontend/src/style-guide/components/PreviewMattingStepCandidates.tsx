import { ReloadOutlined } from '@ant-design/icons'
import PreviewMattingStepFrame from './PreviewMattingStepFrame'
import PreviewCandidateGallery from './PreviewCandidateGallery'
import sectionStyles from './previewSection.module.css'
import styles from './PreviewMattingStepCandidates.module.css'

const CANDIDATES = [
  { id: '1', label: '候选 A', selected: true, checkerboard: true },
  { id: '2', label: '候选 B', selected: true, checkerboard: true },
  { id: '3', label: '候选 C', checkerboard: true },
  { id: '4', label: '候选 D', checkerboard: true },
]

export default function PreviewMattingStepCandidates() {
  return (
    <div className={sectionStyles.section}>
      <PreviewMattingStepFrame activeStep="3" sectionTitle="抠图 Matting · 步骤 ③ 候选">
        <div className={styles.stepHint}>
          源图：hero-mascot.png · 模板：吉祥物透明底 · 模型：rembg-v2
        </div>
        <div className={styles.toolbar}>
          <button type="button" className={styles.secondaryBtn}>
            <ReloadOutlined />
            重新生成
          </button>
        </div>
        <PreviewCandidateGallery items={CANDIDATES} />
      </PreviewMattingStepFrame>
    </div>
  )
}
