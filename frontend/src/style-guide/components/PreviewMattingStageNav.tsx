import { CheckOutlined, RightOutlined } from '@ant-design/icons'
import styles from './PreviewMattingStageNav.module.css'

export type MattingStageNavStep = 1 | 2 | 3 | 4 | 5

const STEPS: { n: MattingStageNavStep; label: string }[] = [
  { n: 1, label: '源图' },
  { n: 2, label: '框选' },
  { n: 3, label: '元素' },
  { n: 4, label: '候选' },
  { n: 5, label: '保存' },
]

interface PreviewMattingStageNavProps {
  activeStep: MattingStageNavStep
  farthestStep?: MattingStageNavStep
  className?: string
}

export default function PreviewMattingStageNav({
  activeStep,
  farthestStep = 5,
  className,
}: PreviewMattingStageNavProps) {
  return (
    <nav className={`${styles.nav} ${className ?? ''}`} aria-label="抠图步骤">
      {STEPS.map((step, index) => {
        const isActive = activeStep === step.n
        const isDone = step.n < activeStep || (step.n <= farthestStep && step.n < activeStep)
        const isPast = step.n < activeStep

        return (
          <span key={step.n} className={styles.itemWrap}>
            {index > 0 && (
              <span className={styles.chev} aria-hidden="true">
                <RightOutlined />
              </span>
            )}
            <div
              className={[
                styles.step,
                isActive ? styles.stepActive : '',
                isPast ? styles.stepDone : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {isActive && <span className={styles.dot} aria-hidden="true" />}
              {isDone && !isActive && (
                <span className={styles.check} aria-hidden="true">
                  <CheckOutlined />
                </span>
              )}
              <span className={styles.label}>{step.label}</span>
            </div>
          </span>
        )
      })}
      <span className={styles.spacer} aria-hidden="true" />
      <span className={styles.progress}>步骤 {activeStep}/5</span>
    </nav>
  )
}
