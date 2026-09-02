import { CheckOutlined, RightOutlined } from '@ant-design/icons'
import styles from '@/components/ops/StepNav.module.css'

const STEPS = [
  { n: 1, label: '源图' },
  { n: 2, label: '框选' },
  { n: 3, label: '元素' },
  { n: 4, label: '候选' },
  { n: 5, label: '保存' },
]

interface StepNavProps {
  viewStage: number
  farthestStage: number
  canPreviewSave?: boolean
  stepLocked?: boolean
  onStepClick: (step: number) => void
}

export default function StepNav({
  viewStage,
  farthestStage,
  canPreviewSave = false,
  stepLocked = false,
  onStepClick,
}: StepNavProps) {
  const canClick = (n: number) =>
    !stepLocked && (n <= farthestStage || (n === 5 && canPreviewSave && farthestStage >= 4))

  return (
    <nav className={styles.nav} aria-label="抠图步骤">
      {STEPS.map((s, index) => {
        const disabled = !canClick(s.n)
        const isActive = viewStage === s.n
        const isDone = s.n < farthestStage || (s.n === 5 && farthestStage >= 5)

        return (
          <span key={s.n} className={styles.itemWrap}>
            {index > 0 && (
              <span className={styles.chev} aria-hidden="true">
                <RightOutlined />
              </span>
            )}
            <button
              type="button"
              disabled={disabled}
              className={[
                styles.step,
                isActive ? styles.stepActive : '',
                isDone && !isActive ? styles.stepDone : '',
                disabled ? styles.stepDisabled : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onStepClick(s.n)}
            >
              {isActive && <span className={styles.dot} aria-hidden="true" />}
              {isDone && !isActive && (
                <span className={styles.check} aria-hidden="true">
                  <CheckOutlined />
                </span>
              )}
              <span className={styles.label}>{s.label}</span>
            </button>
          </span>
        )
      })}
      <span className={styles.spacer} aria-hidden="true" />
      <span className={styles.progress}>步骤 {viewStage}/5</span>
    </nav>
  )
}
