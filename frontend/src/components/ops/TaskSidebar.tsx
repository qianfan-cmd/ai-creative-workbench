import { PlusOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import type { MattingTaskVO } from '@/api/ops'
import styles from '@/components/ops/TaskSidebar.module.css'

interface TaskSidebarProps {
  tasks: MattingTaskVO[]
  activeId: number | null
  onSelect: (id: number) => void
  onNew: () => void
}

export default function TaskSidebar({ tasks, activeId, onSelect, onNew }: TaskSidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.head}>
        <span className={styles.title}>任务</span>
        <Button type="text" size="small" icon={<PlusOutlined />} onClick={onNew}>
          新建
        </Button>
      </div>
      <ul className={styles.list}>
        {tasks.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              className={[styles.item, activeId === t.id ? styles.itemActive : ''].join(' ')}
              onClick={() => onSelect(t.id)}
            >
              <span className={styles.itemTitle}>{t.title}</span>
              <span className={styles.itemMeta}>步骤 {t.stage}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
