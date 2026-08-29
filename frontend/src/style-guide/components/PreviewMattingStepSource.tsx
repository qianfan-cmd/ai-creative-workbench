import PreviewMattingStepFrame from './PreviewMattingStepFrame'
import PreviewImageSourcePanel from './PreviewImageSourcePanel'
import sectionStyles from './previewSection.module.css'

export default function PreviewMattingStepSource() {
  return (
    <div className={sectionStyles.section}>
      <PreviewMattingStepFrame activeStep="1" sectionTitle="抠图 Matting · 步骤 ① 源图">
        <PreviewImageSourcePanel contextLabel="源图" mode="upload" selectedAssetName="hero-mascot.png" />
        <p className={sectionStyles.hint}>
          图片来源：直接上传，或从素材库选择（已有素材 / AI 生图打标入库）。三态对比见下方 Dialogs 区块。
        </p>
      </PreviewMattingStepFrame>
    </div>
  )
}
