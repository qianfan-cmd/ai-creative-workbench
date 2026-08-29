import styles from './PreviewTagAssetDialog.module.css'

interface PreviewTagAssetDialogProps {
  className?: string
}

export default function PreviewTagAssetDialog({ className }: PreviewTagAssetDialogProps) {
  return (
    <div className={`${styles.wrap} ${className ?? ''}`}>
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.dialog} role="dialog" aria-label="打标入库">
        <h3 className={styles.title}>打标入库</h3>

        <div className={styles.previewRow}>
          <div className={styles.previewThumb}>
            <div className={styles.checkerboard} />
          </div>
          <span className={styles.previewHint}>选中候选 · 入库后可被其他工作流引用</span>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>资产名称</label>
          <div className={styles.inputMock}>campaign-ref-20260829-a.png</div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>标签</label>
          <div className={styles.inputMock}>吉祥物, generated</div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>资产类型</label>
          <div className={styles.selectMock}>generated</div>
          <span className={styles.fieldHint}>reference · matted · generated · draft_cover</span>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn}>取消</button>
          <button type="button" className={styles.primaryBtn}>确认入库</button>
        </div>
      </div>
    </div>
  )
}
