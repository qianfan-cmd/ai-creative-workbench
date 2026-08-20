import type { AssetStatsVO } from '@/types/api'
import { formatPrev7DaysDelta } from '@/utils/format'
import styles from './AssetStatsStrip.module.css'

interface AssetStatsStripProps {
    stats: AssetStatsVO
}

export default function AssetStatsStrip({ stats }: AssetStatsStripProps) {
    const items = [
        {
            label: '素材总数',
            value: String(stats.total),
            delta:
                stats.last7DaysCount > 0
                    ? `近7天 +${stats.last7DaysCount}`
                    : '近7天无上传',
        },
        {
            label: '近7天上传',
            value: String(stats.last7DaysCount),
            delta: formatPrev7DaysDelta(stats.last7DaysCount, stats.prev7DaysCount),
        },
        {
            label: '知识库文档',
            value: String(stats.knowledgeDocCount),
            delta: 'RAG 已索引',
        },
    ]

    return (
        <div className={styles.statsStrip}>
            {items.map((item) => (
                <div key={item.label} className={styles.statCard}>
                    <div className={styles.statLabel}>{item.label}</div>
                    <div className={styles.statValue}>{item.value}</div>
                    {item.delta && <div className={styles.statDelta}>{item.delta}</div>}
                </div>
            ))}
        </div>
    )
}