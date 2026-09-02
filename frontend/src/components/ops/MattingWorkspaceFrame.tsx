import type { ReactNode } from 'react'
import styles from '@/components/ops/MattingWorkspaceFrame.module.css'

interface MattingWorkspaceFrameProps {
  sidebar: ReactNode
  nav?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

export default function MattingWorkspaceFrame({
  sidebar,
  nav,
  children,
  footer,
}: MattingWorkspaceFrameProps) {
  return (
    <div className={styles.frame}>
      {sidebar}
      <div className={styles.main}>
        {nav}
        <div className={styles.body}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  )
}

export { styles as mattingFrameStyles }
