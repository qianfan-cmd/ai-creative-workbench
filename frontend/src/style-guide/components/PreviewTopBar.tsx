import { Avatar, Button, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import styles from './PreviewTopBar.module.css'

const menuItems: MenuProps['items'] = [
  { key: 'profile', label: '个人资料' },
  { key: 'settings', label: '设置' },
  { type: 'divider' },
  { key: 'logout', label: '退出登录', danger: true },
]

export default function PreviewTopBar() {
  return (
    <header className={styles.topBar}>
      <div className={styles.breadcrumb}>
        <span>Workbench</span>
        <span>/</span>
        <span className={styles.breadcrumbCurrent}>素材 Assets</span>
      </div>

      <div className={styles.actions}>
        <Button type="default" size="small">
          文档 Docs
        </Button>
        <Dropdown menu={{ items: menuItems }} placement="bottomRight">
          <div className={styles.userBlock}>
            <div className={styles.userMeta}>
              <span className={styles.userName}>陈 Alex</span>
              <span className={styles.userRole}>Creator</span>
            </div>
            <Avatar size={32} className={styles.avatar}>
              AC
            </Avatar>
          </div>
        </Dropdown>
      </div>
    </header>
  )
}
