import { MoreOutlined, PlusOutlined } from '@ant-design/icons'
import { Dropdown, Modal, message } from 'antd'
import type { MenuProps } from 'antd'
import type { ConversationVO } from '@/api/chat'
import { deleteConversationApi, patchConversationApi } from '@/api/chat'
import menuStyles from '@/components/common/SessionRowMenu.module.css'
import styles from './ChatHistorySidebar.module.css'

interface ChatHistorySidebarProps {
  conversations: ConversationVO[]
  activeId?: number | null
  onSelect?: (id: number) => void
  onNew?: () => void
  onRefresh?: () => void | Promise<void>
  onDeleted?: (deletedId: number) => void
  disabled?: boolean
}

export default function ChatHistorySidebar({
  conversations,
  activeId = null,
  onSelect,
  onNew,
  onRefresh,
  onDeleted,
  disabled = false,
}: ChatHistorySidebarProps) {
  const handleDelete = (item: ConversationVO) => {
    Modal.confirm({
      title: '删除对话',
      content: `确定删除「${item.title}」吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteConversationApi(item.id)
          message.success('已删除')
          onDeleted?.(item.id)
        } catch (err) {
          message.error(err instanceof Error ? err.message : '删除失败')
          throw err
        }
      },
    })
  }

  const togglePin = async (item: ConversationVO) => {
    try {
      await patchConversationApi(item.id, { pinned: !item.pinned })
      await onRefresh?.()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败')
    }
  }

  const renameConversation = (item: ConversationVO) => {
    Modal.confirm({
      title: '重命名',
      content: (
        <input
          id={`chat-rename-${item.id}`}
          defaultValue={item.title}
          maxLength={30}
          style={{
            width: '100%',
            padding: 8,
            border: '1px solid var(--color-border)',
            borderRadius: 6,
          }}
        />
      ),
      onOk: async () => {
        const input = document.getElementById(`chat-rename-${item.id}`) as HTMLInputElement | null
        const title = input?.value?.trim()
        if (!title) {
          message.warning('标题不能为空')
          throw new Error('empty')
        }
        await patchConversationApi(item.id, { title })
        await onRefresh?.()
      },
    })
  }

  const menuItems = (item: ConversationVO): MenuProps['items'] => [
    {
      key: 'pin',
      label: item.pinned ? '取消置顶' : '置顶',
      onClick: () => void togglePin(item),
    },
    {
      key: 'rename',
      label: '重命名',
      onClick: () => renameConversation(item),
    },
    { type: 'divider' },
    {
      key: 'delete',
      label: '删除',
      danger: true,
      onClick: () => handleDelete(item),
    },
  ]

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
            <div key={item.id} className={menuStyles.rowWrap}>
              <button
                type="button"
                className={`${styles.listItem} ${menuStyles.rowBtn} ${
                  item.id === activeId ? styles.listItem_active : ''
                }`}
                title={item.title}
                onClick={() => onSelect?.(item.id)}
                disabled={!onSelect}
              >
                {item.pinned && (
                  <span className={styles.pinMark} aria-hidden="true">
                    ★
                  </span>
                )}
                <span className={styles.itemTitle}>{item.title}</span>
              </button>
              <Dropdown menu={{ items: menuItems(item) }} trigger={['click']}>
                <button type="button" className={menuStyles.menuBtn} aria-label="对话菜单">
                  <MoreOutlined />
                </button>
              </Dropdown>
            </div>
          ))
        )}
      </nav>
    </aside>
  )
}
