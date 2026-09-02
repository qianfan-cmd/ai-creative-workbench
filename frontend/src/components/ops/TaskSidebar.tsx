import { MoreOutlined, PlusOutlined, ScissorOutlined } from '@ant-design/icons'
import { Dropdown, Modal, message } from 'antd'
import type { MenuProps } from 'antd'
import { useMemo, useState } from 'react'
import type { MattingTaskGroupVO, MattingTaskVO } from '@/api/ops'
import {
  createMattingTaskGroupApi,
  deleteMattingTaskApi,
  deleteMattingTaskGroupApi,
  patchMattingTaskGroupApi,
  patchMattingTaskMetaApi,
} from '@/api/ops'
import menuStyles from '@/components/common/SessionRowMenu.module.css'
import styles from '@/components/ops/TaskSidebar.module.css'

const COLLAPSE_KEY = 'matting:group-collapsed'

interface TaskSidebarProps {
  tasks: MattingTaskVO[]
  groups: MattingTaskGroupVO[]
  activeId: number | null
  onSelect: (id: number) => void
  onNew: () => void
  onRefresh: () => void | Promise<void>
  onDeleted?: (taskId: number) => void
}

function loadCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

export default function TaskSidebar({
  tasks,
  groups,
  activeId,
  onSelect,
  onNew,
  onRefresh,
  onDeleted,
}: TaskSidebarProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed)

  const toggleCollapsed = (key: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next))
      return next
    })
  }

  const pinned = useMemo(() => tasks.filter((t) => t.pinned), [tasks])
  const ungrouped = useMemo(() => tasks.filter((t) => !t.pinned && !t.groupId), [tasks])

  const tasksByGroup = useMemo(() => {
    const map = new Map<number, MattingTaskVO[]>()
    for (const g of groups) map.set(g.id, [])
    for (const t of tasks) {
      if (t.pinned || !t.groupId) continue
      const list = map.get(t.groupId)
      if (list) list.push(t)
    }
    return map
  }, [tasks, groups])

  const taskMenuItems = (task: MattingTaskVO): MenuProps['items'] => [
    {
      key: 'pin',
      label: task.pinned ? '取消置顶' : '置顶',
      onClick: () => void togglePin(task),
    },
    {
      key: 'rename',
      label: '重命名',
      onClick: () => renameTask(task),
    },
    { type: 'divider' },
    ...groups.map((g) => ({
      key: `g-${g.id}`,
      label: `移到「${g.name}」`,
      onClick: () => void moveTask(task.id, g.id),
    })),
    {
      key: 'ungroup',
      label: '移到未分组',
      onClick: () => void moveTask(task.id, null),
    },
    { type: 'divider' },
    {
      key: 'delete',
      label: '删除',
      danger: true,
      onClick: () => {
        Modal.confirm({
          title: '删除任务',
          content: `确定删除「${task.title}」吗？`,
          okText: '删除',
          okButtonProps: { danger: true },
          cancelText: '取消',
          onOk: async () => {
            await deleteMattingTaskApi(task.id)
            message.success('已删除')
            onDeleted?.(task.id)
            await onRefresh()
          },
        })
      },
    },
  ]

  const renderTask = (task: MattingTaskVO, indent = false) => (
    <div key={task.id} className={menuStyles.rowWrap}>
      <button
        type="button"
        className={[
          styles.taskRow,
          menuStyles.rowBtn,
          indent ? styles.taskRow_indent : '',
          activeId === task.id ? styles.taskRow_active : '',
        ]
          .filter(Boolean)
          .join(' ')}
        title={task.title}
        onClick={() => onSelect(task.id)}
      >
        {task.pinned && (
          <span className={styles.pinMark} aria-hidden="true">
            ★
          </span>
        )}
        <span className={styles.taskTitle}>{task.title}</span>
        {task.status === 'running' && (
          <span className={[styles.statusDot, styles.statusDot_running].join(' ')} aria-hidden="true" />
        )}
        {task.status === 'done' && (
          <span className={[styles.statusDot, styles.statusDot_done].join(' ')} aria-hidden="true" />
        )}
      </button>
      <Dropdown menu={{ items: taskMenuItems(task) }} trigger={['click']}>
        <button type="button" className={menuStyles.menuBtn} aria-label="任务菜单">
          <MoreOutlined />
        </button>
      </Dropdown>
    </div>
  )

  const togglePin = async (task: MattingTaskVO) => {
    try {
      await patchMattingTaskMetaApi(task.id, { pinned: !task.pinned })
      await onRefresh()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败')
    }
  }

  const renameTask = (task: MattingTaskVO) => {
    Modal.confirm({
      title: '重命名',
      content: (
        <input
          id="matting-rename-input"
          defaultValue={task.title}
          className={styles.taskTitle}
          style={{ width: '100%', padding: 8, border: '1px solid var(--color-border)', borderRadius: 6 }}
        />
      ),
      onOk: async () => {
        const input = document.getElementById('matting-rename-input') as HTMLInputElement | null
        const title = input?.value?.trim()
        if (!title) return
        await patchMattingTaskMetaApi(task.id, { title })
        await onRefresh()
      },
    })
  }

  const moveTask = async (taskId: number, groupId: number | null) => {
    try {
      await patchMattingTaskMetaApi(taskId, { groupId })
      await onRefresh()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '移动失败')
    }
  }

  const handleNewGroup = () => {
    Modal.confirm({
      title: '新建分组',
      content: (
        <input
          id="matting-new-group"
          placeholder="分组名称（20 字以内）"
          maxLength={20}
          style={{ width: '100%', padding: 8, border: '1px solid var(--color-border)', borderRadius: 6 }}
        />
      ),
      onOk: async () => {
        const input = document.getElementById('matting-new-group') as HTMLInputElement | null
        const name = input?.value?.trim()
        if (!name) {
          message.warning('请输入分组名称')
          throw new Error('empty')
        }
        await createMattingTaskGroupApi(name)
        await onRefresh()
        message.success('分组已创建')
      },
    })
  }

  const groupMenuItems = (group: MattingTaskGroupVO): MenuProps['items'] => [
    {
      key: 'rename',
      label: '重命名',
      onClick: () => {
        Modal.confirm({
          title: '重命名分组',
          content: (
            <input
              id={`matting-group-rename-${group.id}`}
              defaultValue={group.name}
              maxLength={20}
              style={{ width: '100%', padding: 8, border: '1px solid var(--color-border)', borderRadius: 6 }}
            />
          ),
          onOk: async () => {
            const input = document.getElementById(`matting-group-rename-${group.id}`) as HTMLInputElement | null
            const name = input?.value?.trim()
            if (!name) throw new Error('empty')
            await patchMattingTaskGroupApi(group.id, { name })
            await onRefresh()
          },
        })
      },
    },
    {
      key: 'delete',
      label: '删除分组',
      danger: true,
      onClick: () => {
        Modal.confirm({
          title: '删除分组',
          content: `确定删除「${group.name}」？组内任务将移至未分组。`,
          okText: '删除',
          okButtonProps: { danger: true },
          onOk: async () => {
            await deleteMattingTaskGroupApi(group.id)
            await onRefresh()
          },
        })
      },
    },
  ]

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <ScissorOutlined className={styles.brandIcon} aria-hidden="true" />
        <span className={styles.brandText}>抠图Matting</span>
      </div>
      <div className={styles.divider} />
      <div className={styles.body}>
        <div className={styles.createRow}>
          <button type="button" className={styles.createBtn} onClick={onNew}>
            <PlusOutlined />
            新建
          </button>
          <button type="button" className={styles.createBtn} onClick={handleNewGroup}>
            <PlusOutlined />
            新建分组
          </button>
        </div>
        <div className={styles.list}>
          {pinned.map((t) => renderTask(t))}

          {ungrouped.length > 0 && (
            <div className={styles.group}>
              <button
                type="button"
                className={styles.groupHeader}
                onClick={() => toggleCollapsed('ungrouped')}
              >
                <span className={styles.groupHeaderLabel}>
                  {collapsed.ungrouped ? '▸' : '▾'} 未分组 ({ungrouped.length})
                </span>
              </button>
              {!collapsed.ungrouped && ungrouped.map((t) => renderTask(t, true))}
            </div>
          )}

          {groups.map((group) => {
            const groupTasks = tasksByGroup.get(group.id) ?? []
            const key = `g-${group.id}`
            return (
              <div key={group.id} className={styles.group}>
                <div className={styles.groupHeaderRow}>
                  <button
                    type="button"
                    className={styles.groupHeader}
                    onClick={() => toggleCollapsed(key)}
                  >
                    <span className={styles.groupHeaderLabel}>
                      {collapsed[key] ? '▸' : '▾'} {group.name} ({groupTasks.length})
                    </span>
                  </button>
                  <Dropdown menu={{ items: groupMenuItems(group) }} trigger={['click']}>
                    <button type="button" className={menuStyles.menuBtn} aria-label="分组菜单">
                      <MoreOutlined />
                    </button>
                  </Dropdown>
                </div>
                {!collapsed[key] && groupTasks.map((t) => renderTask(t, true))}
              </div>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
