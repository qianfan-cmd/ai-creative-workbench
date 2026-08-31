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
  /** 允许进入第 5 步预览（提取完成但未正式 save） */
  canPreviewSave?: boolean
  onStepClick: (step: number) => void
}

export default function StepNav({
  viewStage,
  farthestStage,
  canPreviewSave = false,
  onStepClick,
}: StepNavProps) {
  const canClick = (n: number) =>
    n <= farthestStage || (n === 5 && canPreviewSave && farthestStage >= 4)

  return (
    <nav className={styles.nav} aria-label="抠图步骤">
      {STEPS.map((s) => {
        const disabled = !canClick(s.n)
        const isActive = viewStage === s.n
        const isDone = s.n < farthestStage || (s.n === 5 && farthestStage >= 5)
        return (
          <button
            key={s.n}
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
            <span className={styles.badge}>{s.n}</span>
            <span className={styles.label}>{s.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
