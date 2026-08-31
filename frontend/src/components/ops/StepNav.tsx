import styles from '@/components/ops/StepNav.module.css'

const STEPS = [
  { n: 1, label: '源图' },
  { n: 2, label: '框选' },
  { n: 3, label: '元素' },
  { n: 4, label: '候选' },
  { n: 5, label: '保存' },
]

interface StepNavProps {
  current: number
}

export default function StepNav({ current }: StepNavProps) {
  return (
    <nav className={styles.nav} aria-label="抠图步骤">
      {STEPS.map((s) => (
        <div
          key={s.n}
          className={[styles.step, current === s.n ? styles.stepActive : '', current > s.n ? styles.stepDone : ''].filter(Boolean).join(' ')}
        >
          <span className={styles.badge}>{s.n}</span>
          <span className={styles.label}>{s.label}</span>
        </div>
      ))}
    </nav>
  )
}
