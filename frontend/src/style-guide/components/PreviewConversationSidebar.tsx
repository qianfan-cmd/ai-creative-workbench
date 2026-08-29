import { PlusOutlined } from '@ant-design/icons'
import styles from './PreviewConversationSidebar.module.css'

export interface HistoryItem {
  id: string
  title: string
  active?: boolean
}

interface PreviewConversationSidebarProps {
  title?: string
  newButtonLabel?: string
  items: HistoryItem[]
  className?: string
}

export default function PreviewConversationSidebar({
  title = '历史对话',
  newButtonLabel = '新对话',
  items,
  className,
}: PreviewConversationSidebarProps) {
  return (
    <aside className={`${styles.sidebar} ${className ?? ''}`}>
      <button type="button" className={styles.newBtn}>
        <PlusOutlined />
        {newButtonLabel}
      </button>
      <div className={styles.listHeader}>{title}</div>
      <nav className={styles.list}>
        {items.map((item) => (
          <div
            key={item.id}
            className={`${styles.listItem} ${item.active ? styles.listItem_active : ''}`}
            title={item.title}
          >
            {item.title}
          </div>
        ))}
      </nav>
    </aside>
  )
}
