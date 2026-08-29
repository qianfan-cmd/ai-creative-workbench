import styles from './PreviewStepNav.module.css'

export interface StepItem {
  id: string
  label: string
  active?: boolean
  done?: boolean
}

interface PreviewStepNavProps {
  steps: StepItem[]
  className?: string
}

export default function PreviewStepNav({ steps, className }: PreviewStepNavProps) {
  return (
    <nav className={`${styles.nav} ${className ?? ''}`} aria-label="工作流步骤">
      {steps.map((step, index) => (
        <div key={step.id} className={styles.itemWrap}>
          <div
            className={`${styles.item} ${step.active ? styles.item_active : ''} ${
              step.done ? styles.item_done : ''
            }`}
          >
            <span className={styles.label}>{step.label}</span>
          </div>
          {index < steps.length - 1 && <span className={styles.sep} aria-hidden="true" />}
        </div>
      ))}
    </nav>
  )
}
