import { PlusOutlined } from '@ant-design/icons'
import type { ConversationVO } from '@/api/chat'
import styles from './ChatHistorySidebar.module.css'

interface ChatHistorySidebarProps {
  conversations: ConversationVO[]
  /** Phase C：当前激活会话 id */
  activeId?: number | null
  /** Phase C：点击历史项切换线程 */
  onSelect?: (id: number) => void
  /** Phase C：新建对话 */
  onNew?: () => void
  disabled?: boolean
}

export default function ChatHistorySidebar({
  conversations,
  activeId = null,
  onSelect,
  onNew,
  disabled = false,
}: ChatHistorySidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <button
        type="button"
        className={styles.newBtn}
        onClick={onNew}
        disabled={disabled || !onNew}
      >
        <PlusOutlined />
        新对话
      </button>
      <div className={styles.listHeader}>历史对话</div>
      <nav className={styles.list}>
        {conversations.length === 0 ? (
          <p className={styles.emptyHint}>暂无历史</p>
        ) : (
          conversations.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${styles.listItem} ${
                item.id === activeId ? styles.listItem_active : ''
              }`}
              title={item.title}
              onClick={() => onSelect?.(item.id)}
              disabled={!onSelect}
            >
              {item.title}
            </button>
          ))
        )}
      </nav>
    </aside>
  )
}
