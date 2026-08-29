import type { ReactNode } from 'react'
import {
  AppstoreOutlined,
  BookOutlined,
  MessageOutlined,
  RocketOutlined,
  ScissorOutlined,
  SettingOutlined,
  TagsOutlined,
} from '@ant-design/icons'
import styles from './PreviewSidebar.module.css'

interface NavItem {
  key: string
  label: string
  icon: ReactNode
  active?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { key: 'assets', label: '素材 Assets', icon: <AppstoreOutlined />, active: true },
  { key: 'tags', label: '标签 Tags', icon: <TagsOutlined /> },
  { key: 'chat', label: 'AI 对话 Chat', icon: <MessageOutlined /> },
  { key: 'knowledge', label: '知识库 Knowledge', icon: <BookOutlined /> },
  { key: 'matting', label: '抠图 Matting', icon: <ScissorOutlined /> },
  { key: 'campaign', label: '活动帖 Campaign', icon: <RocketOutlined /> },
  { key: 'settings', label: '设置 Settings', icon: <SettingOutlined /> },
]

export default function PreviewSidebar() {
  return (
    <aside className={styles.previewSidebar}>
      <div className={styles.logo}>
        <div className={styles.logoMark}>W</div>
        <div className={styles.logoText}>
          <span className={styles.logoTitle}>Workbench</span>
          <span className={styles.logoSubtitle}>AI 创意资产工作台</span>
        </div>
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => (
          <div
            key={item.key}
            className={`${styles.navItem} ${item.active ? styles.navItem_active : ''}`}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            {item.label}
          </div>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <p className={styles.footerHint}>风格预览 — 导航为静态 mock</p>
      </div>
    </aside>
  )
}
