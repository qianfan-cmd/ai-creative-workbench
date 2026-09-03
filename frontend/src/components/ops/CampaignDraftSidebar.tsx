import { MoreOutlined, PlusOutlined, RocketOutlined } from '@ant-design/icons'
import { Dropdown, Modal, Tag, message } from 'antd'
import type { MenuProps } from 'antd'
import type { CampaignDraftListItemVO } from '@/api/ops'
import { formatDate } from '@/utils/format'
import menuStyles from '@/components/common/SessionRowMenu.module.css'
import styles from '@/components/ops/CampaignDraftSidebar.module.css'

interface CampaignDraftSidebarProps {
  drafts: CampaignDraftListItemVO[]
  activeId: number | null
  onSelect: (id: number) => void
  onNew: () => void
  onRename: (id: number, title: string) => void
  onDelete: (id: number) => void
  onPin: (id: number, pinned: boolean) => void
}

export default function CampaignDraftSidebar({
  drafts,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onPin,
}: CampaignDraftSidebarProps) {
  const menuItems = (draft: CampaignDraftListItemVO): MenuProps['items'] => [
    {
      key: 'pin',
      label: draft.pinned ? '取消置顶' : '置顶',
      onClick: () => onPin(draft.id, !draft.pinned),
    },
    {
      key: 'rename',
      label: '重命名',
      onClick: () => {
        let title = draft.title
        Modal.confirm({
          title: '重命名活动帖',
          content: (
            <input
              className={styles.modalInput}
              defaultValue={draft.title}
              maxLength={30}
              onChange={(e) => {
                title = e.target.value
              }}
            />
          ),
          onOk: () => {
            const trimmed = title.trim()
            if (!trimmed) {
              message.warning('标题不能为空')
              return Promise.reject()
            }
            onRename(draft.id, trimmed)
          },
        })
      },
    },
    { type: 'divider' },
    {
      key: 'delete',
      label: '删除',
      danger: true,
      onClick: () => {
        Modal.confirm({
          title: '删除活动帖草稿',
          content: `确定删除「${draft.title}」吗？`,
          okType: 'danger',
          onOk: () => onDelete(draft.id),
        })
      },
    },
  ]

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <RocketOutlined className={styles.brandIcon} />
        <span className={styles.brandText}>活动帖</span>
      </div>
      <div className={styles.divider} />
      <div className={styles.body}>
        <div className={styles.createRow}>
          <button type="button" className={styles.createBtn} onClick={onNew}>
            <PlusOutlined />
            新建活动帖
          </button>
        </div>
        <div className={styles.list}>
          {drafts.length === 0 && <p className={styles.empty}>暂无草稿，点击上方新建</p>}
          {drafts.map((draft) => (
            <div key={draft.id} className={styles.rowWrap}>
              <button
                type="button"
                className={[styles.row, activeId === draft.id ? styles.rowActive : ''].join(' ')}
                onClick={() => onSelect(draft.id)}
              >
                {draft.coverUrl ? (
                  <img src={draft.coverUrl} alt="" className={styles.thumb} />
                ) : (
                  <span className={styles.thumbPlaceholder} />
                )}
                <span className={styles.meta}>
                  <span className={styles.titleRow}>
                    {draft.pinned ? (
                      <span className={styles.pinMark} aria-hidden="true">
                        ★
                      </span>
                    ) : null}
                    <span className={styles.title}>{draft.title}</span>
                  </span>
                  <span className={styles.sub}>
                    {draft.updatedAt ? formatDate(draft.updatedAt) : '—'}
                    {draft.status === 'ready' ? (
                      <Tag color="success" className={styles.statusTag}>
                        可导出
                      </Tag>
                    ) : null}
                  </span>
                </span>
              </button>
              <Dropdown menu={{ items: menuItems(draft) }} trigger={['click']}>
                <button type="button" className={menuStyles.menuBtn} aria-label="更多">
                  <MoreOutlined />
                </button>
              </Dropdown>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
