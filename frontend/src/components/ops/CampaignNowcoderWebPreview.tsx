import dayjs from 'dayjs'
import CampaignPreviewMediaGrid from '@/components/ops/CampaignPreviewMediaGrid'
import UserAvatar from '@/components/common/UserAvatar'
import { useAuthStore } from '@/stores/authStore'
import styles from '@/components/ops/CampaignNowcoderWebPreview.module.css'

interface CampaignNowcoderWebPreviewProps {
  imageUrls?: string[]
  coverUrl?: string | null
  title: string
  body: string
  hashtag?: string
  aspectLabel?: string
}

export default function CampaignNowcoderWebPreview({
  imageUrls,
  coverUrl,
  title,
  body,
  hashtag = '#活动',
  aspectLabel = '16:9 封面',
}: CampaignNowcoderWebPreviewProps) {
  const user = useAuthStore((s) => s.user)
  const displayName = user?.username ?? '运营账号'
  const timeLabel = dayjs().format('MM-DD HH:mm')
  const urls = imageUrls?.length ? imageUrls : coverUrl ? [coverUrl] : []

  return (
    <div className={styles.frame}>
      <article className={styles.card}>
        <header className={styles.header}>
          <UserAvatar user={user} size={40} className={styles.avatar} />
          <div className={styles.headerMeta}>
            <p className={styles.userName}>{displayName}</p>
            <p className={styles.userSub}>{timeLabel} · 活动运营</p>
          </div>
          <button type="button" className={styles.followBtn} tabIndex={-1}>
            + 关注
          </button>
        </header>

        <div className={styles.body}>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.excerpt}>{body}</p>
          <span className={styles.hashtag}>{hashtag}</span>
        </div>

        <CampaignPreviewMediaGrid
          urls={urls}
          platform="web"
          aspectLabel={aspectLabel}
          className={styles.media}
        />

        <footer className={styles.footer}>
          <div className={styles.stats}>
            <span>评论 10</span>
            <span>赞 4</span>
            <span>收藏 2</span>
            <span>分享</span>
          </div>
          <span className={styles.views}>浏览 2972</span>
        </footer>
      </article>
    </div>
  )
}
