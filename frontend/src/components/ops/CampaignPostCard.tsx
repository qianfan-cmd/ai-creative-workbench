import styles from '@/components/ops/CampaignPostCard.module.css'

interface CampaignPostCardProps {
  coverUrl?: string | null
  title: string
  body: string
  aspectLabel?: string
}

export default function CampaignPostCard({
  coverUrl,
  title,
  body,
  aspectLabel = '16:9 封面',
}: CampaignPostCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.cover}>
        {coverUrl ? (
          <img src={coverUrl} alt="封面" className={styles.coverImg} />
        ) : (
          <span className={styles.coverBadge}>{aspectLabel}</span>
        )}
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.excerpt}>{body}</p>
        <span className={styles.tag}>#活动</span>
      </div>
      <p className={styles.footer}>MVP：复制到牛客手动发布</p>
    </article>
  )
}
