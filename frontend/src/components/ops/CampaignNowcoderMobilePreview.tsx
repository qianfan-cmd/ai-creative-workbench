import dayjs from 'dayjs'
import CampaignPreviewMediaGrid from '@/components/ops/CampaignPreviewMediaGrid'
import UserAvatar from '@/components/common/UserAvatar'
import { useAuthStore } from '@/stores/authStore'
import styles from '@/components/ops/CampaignNowcoderMobilePreview.module.css'

interface CampaignNowcoderMobilePreviewProps {
  imageUrls?: string[]
  coverUrl?: string | null
  title: string
  body: string
  hashtag?: string
}

export default function CampaignNowcoderMobilePreview({
  imageUrls,
  coverUrl,
  title,
  body,
  hashtag = '#活动',
}: CampaignNowcoderMobilePreviewProps) {
  const user = useAuthStore((s) => s.user)
  const displayName = user?.username ?? '运营账号'
  const timeLabel = dayjs().format('MM-DD HH:mm')
  const urls = imageUrls?.length ? imageUrls : coverUrl ? [coverUrl] : []

  return (
    <div className={styles.frame}>
      <article className={styles.phone}>
        <div className={styles.appBar}>
          <span aria-hidden>&lt;</span>
          <span className={styles.appTitle}>牛客</span>
          <span aria-hidden>···</span>
        </div>

        <header className={styles.userRow}>
          <UserAvatar user={user} size={36} className={styles.avatar} />
          <div className={styles.userMeta}>
            <p className={styles.userName}>
              {displayName}
              <span className={styles.level}>LV.4</span>
            </p>
            <p className={styles.userSub}>活动运营 · 官方</p>
          </div>
          <button type="button" className={styles.followBtn} tabIndex={-1}>
            关注
          </button>
        </header>

        <div className={styles.content}>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.body}>{body}</p>
          <span className={styles.hashtag}>{hashtag}</span>
        </div>

        <CampaignPreviewMediaGrid urls={urls} platform="mobile" className={styles.media} />

        <footer className={styles.bottomBar}>
          <span>
            {timeLabel} 广东
          </span>
          <button type="button" className={styles.flowerBtn} tabIndex={-1}>
            送花
            <span className={styles.flowerCount}>193</span>
          </button>
        </footer>
      </article>
    </div>
  )
}
