import { MoreOutlined, PlusOutlined } from '@ant-design/icons'
import styles from './PreviewTaskSidebar.module.css'

export interface TaskItem {
  id: string
  title: string
  active?: boolean
  pinned?: boolean
  status?: 'running' | 'done'
}

export interface TaskGroup {
  id: string
  name: string
  collapsed?: boolean
  tasks: TaskItem[]
}

interface PreviewTaskSidebarProps {
  title?: string
  pinned?: TaskItem[]
  ungrouped?: TaskItem[]
  groups?: TaskGroup[]
  activeTaskId?: string
  className?: string
}

export default function PreviewTaskSidebar({
  title = '抠图任务',
  pinned = [],
  ungrouped = [],
  groups = [],
  activeTaskId,
  className,
}: PreviewTaskSidebarProps) {
  const renderTask = (task: TaskItem, indent = false) => (
    <div
      key={task.id}
      className={`${styles.taskRow} ${indent ? styles.taskRow_indent : ''} ${
        task.active || task.id === activeTaskId ? styles.taskRow_active : ''
      }`}
      title={task.title}
    >
      {task.pinned && <span className={styles.pinMark} aria-hidden="true">★</span>}
      <span className={styles.taskTitle}>{task.title}</span>
      {task.status === 'running' && <span className={styles.statusDot} data-status="running" />}
      {task.status === 'done' && <span className={styles.statusDot} data-status="done" />}
    </div>
  )

  return (
    <aside className={`${styles.sidebar} ${className ?? ''}`}>
      <div className={styles.header}>{title}</div>
      <div className={styles.createRow}>
        <button type="button" className={styles.createBtn}>
          <PlusOutlined />
          新建任务
        </button>
        <button type="button" className={styles.createBtn}>
          <PlusOutlined />
          新建分组
        </button>
      </div>

      <div className={styles.list}>
        {pinned.map((task) => renderTask(task))}

        {ungrouped.length > 0 && (
          <div className={styles.group}>
            <div className={styles.groupHeader}>
              <span>▾ 未分组 ({ungrouped.length})</span>
            </div>
            {ungrouped.map((task) => renderTask(task, true))}
          </div>
        )}

        {groups.map((group) => (
          <div key={group.id} className={styles.group}>
            <div className={styles.groupHeader}>
              <span>{group.collapsed ? '▸' : '▾'} {group.name} ({group.tasks.length})</span>
              <button type="button" className={styles.groupMenu} aria-label="分组菜单">
                <MoreOutlined />
              </button>
            </div>
            {!group.collapsed && group.tasks.map((task) => renderTask(task, true))}
          </div>
        ))}
      </div>
    </aside>
  )
}
