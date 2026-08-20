import styles from './PreviewStatsStrip.module.css'

interface StatItem {
  label: string
  value: string
  delta?: string
}

const STATS: StatItem[] = [
  { label: '素材总数', value: '128', delta: '本周 +12' },
  { label: '本周上传', value: '24', delta: '较上周 +18%' },
  { label: '知识库文档', value: '36', delta: 'RAG 已索引' },
]

export default function PreviewStatsStrip() {
  return (
    <div className={styles.statsStrip}>
      {STATS.map((stat) => (
        <div key={stat.label} className={styles.statCard}>
          <div className={styles.statLabel}>{stat.label}</div>
          <div className={styles.statValue}>{stat.value}</div>
          {stat.delta && <div className={styles.statDelta}>{stat.delta}</div>}
        </div>
      ))}
    </div>
  )
}
