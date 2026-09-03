import { NavLink } from 'react-router-dom'
import styles from '@/components/layout/AppSidebar.module.css'
import {
  AppstoreOutlined,
  BookOutlined,
  MessageOutlined,
  RocketOutlined,
  ScissorOutlined,
  SettingOutlined,
  TagsOutlined,
} from '@ant-design/icons'
import type { ReactNode } from 'react'

interface NavItemConfig {
  key: string
  label: string
  icon: ReactNode
  to?: string
}

interface AppSidebarProps {
  collapsed: boolean
}

/** 导航栏配置 */
const NAV_ITEMS: NavItemConfig[] = [
  { key: 'asset', label: '素材 Assets', icon: <AppstoreOutlined />, to: '/assets' },
  { key: 'tags', label: '标签 Tags', icon: <TagsOutlined />, to: '/tags' },
  { key: 'chat', label: 'AI 对话 Chat', icon: <MessageOutlined />, to: '/chat' },
  { key: 'knowledge', label: '知识库 Knowledge', icon: <BookOutlined />, to: '/knowledge' },
  { key: 'matting', label: '抠图 Matting', icon: <ScissorOutlined />, to: '/ops/matting' },
  { key: 'campaign', label: '活动帖 Campaign', icon: <RocketOutlined />, to: '/ops/campaign' },
  { key: 'settings', label: '设置 Settings', icon: <SettingOutlined />, to: '/settings' },
]

export default function AppSidebar({ collapsed }: AppSidebarProps) {
  return (
    <aside
      className={[styles.sidebar, collapsed && styles.sidebarCollapsed].filter(Boolean).join(' ')}
    >
      <div className={styles.logo}>
        <div className={styles.logoMark}>W</div>
        {!collapsed && (
          <div className={styles.logoText}>
            <span className={styles.logoTitle}>Workbench</span>
            <span className={styles.logoSubtitle}>AI 创意资产工作台</span>
          </div>
        )}
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) =>
          item.to ? (
            <NavLink
              key={item.key}
              to={item.to}
              end
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                [styles.navItem, isActive && styles.navItemActive].filter(Boolean).join(' ')
              }
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
            </NavLink>
          ) : (
            <div
              key={item.key}
              className={[styles.navItem, styles.navItemDisabled].join(' ')}
              title={collapsed ? item.label : '即将推出'}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
            </div>
          ),
        )}
      </nav>
    </aside>
  )
}
