import styles from './PreviewOpsDialog.module.css'

interface PreviewOpsDialogProps {
  title?: string
  label?: string
  placeholder?: string
  showPinToggle?: boolean
  primaryLabel?: string
  className?: string
}

export default function PreviewOpsDialog({
  title = '新建任务',
  label = '任务名称',
  placeholder = '例如：牛客吉祥物抠图',
  showPinToggle = false,
  primaryLabel = '确认',
  className,
}: PreviewOpsDialogProps) {
  return (
    <div className={`${styles.wrap} ${className ?? ''}`}>
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.dialog} role="dialog" aria-label={title}>
        <h3 className={styles.title}>{title}</h3>
        <div className={styles.field}>
          <label className={styles.label}>{label}</label>
          <div className={styles.inputMock}>{placeholder}</div>
        </div>
        {showPinToggle && (
          <label className={styles.checkbox}>
            <span className={styles.checkboxBox} />
            置顶任务
          </label>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn}>取消</button>
          <button type="button" className={styles.primaryBtn}>{primaryLabel}</button>
        </div>
      </div>
    </div>
  )
}
