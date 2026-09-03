import { Link, useNavigate } from 'react-router-dom'
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/stores/authStore'
import styles from '@/components/layout/AppTopBar.module.css'
import { Button, Dropdown, Avatar } from 'antd'
import type { MenuProps } from 'antd'
import type { BreadcrumbItem } from '@/hooks/useAppBreadcrumbs'

interface AppTopBarProps {
  items: BreadcrumbItem[]
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
}

export default function AppTopBar({ items, sidebarCollapsed, onToggleSidebar }: AppTopBarProps) {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)

  const displayName = user?.username ?? '...'
  const roleLabel = user?.role ?? 'User'
  const avatarText = displayName.slice(0, 2).toUpperCase()

  const menuItems: MenuProps['items'] = [
    { key: 'profile', label: '个人资料', disabled: true },
    {
      key: 'settings',
      label: '设置',
      onClick: () => navigate('/settings'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      label: '退出登录',
      danger: true,
      onClick: () => {
        clearAuth()
        navigate('/login', { replace: true })
      },
    },
  ]

  return (
    <header className={styles.topBar}>
      <div className={styles.leading}>
        <button
          type="button"
          className={styles.sidebarToggle}
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
          aria-expanded={!sidebarCollapsed}
        >
          {sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </button>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        {items.map((item, index) => (
          <span key={`${item.label}-${index}`} className={styles.breadcrumbSegment}>
            {index > 0 && <span className={styles.breadcrumbSep}>/</span>}
            {item.href ? (
              <Link to={item.href} className={styles.breadcrumbLink}>
                {item.label}
              </Link>
            ) : (
              <span className={styles.breadcrumbCurrent}>{item.label}</span>
            )}
          </span>
        ))}
        </nav>
      </div>

      <div className={styles.actions}>
        <Button type="default" size="small">文档 Docs</Button>
        <Dropdown menu={{ items: menuItems }} placement="bottomRight">
          <div className={styles.userBlock}>
            <div className={styles.userMeta}>
              <span className={styles.userName}>{displayName}</span>
              <span className={styles.userRole}>{roleLabel}</span>
            </div>
            <Avatar size={32} className={styles.avatar}>{avatarText}</Avatar>
          </div>
        </Dropdown>
      </div>
    </header>
  )
}