import styles from './PreviewCampaignPostCard.module.css'

interface PreviewCampaignPostCardProps {
  title?: string
  body?: string
  tag?: string
  className?: string
}

export default function PreviewCampaignPostCard({
  title = '夏日版本更新 · 登录即领限定皮肤',
  body = '新版本已上线！完成每日任务即可兑换夏日限定皮肤与道具礼包。活动时间 8/15–8/31，详情见游戏内公告。',
  tag = '#活动',
  className,
}: PreviewCampaignPostCardProps) {
  return (
    <article className={`${styles.card} ${className ?? ''}`}>
      <div className={styles.cover}>
        <div className={styles.coverFill} />
        <span className={styles.coverBadge}>16:9 封面</span>
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.excerpt}>{body}</p>
        <span className={styles.tag}>{tag}</span>
      </div>
      <p className={styles.footer}>MVP：复制到牛客手动发布</p>
    </article>
  )
}
