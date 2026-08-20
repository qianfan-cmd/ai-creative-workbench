import type { ReactNode } from 'react'
import styles from '@/components/auth/AuthCardLayout.module.css'

interface AuthCardLayoutProps {
  /** 主标题，如「登录工作台」 */
  title: string
  /** 英文副标题 */
  subtitle: string
  /** 卡片主体：Form、底部链接等 */
  children: ReactNode
}

export default function AuthCardLayout({
  title,
  subtitle,
  children,
}: AuthCardLayoutProps) {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <header className={styles.header}>
          <div className={styles.logoMark}>W</div>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </header>

        <div className={styles.body}>{children}</div>
      </div>
    </div>
  )
}