import { Button, Segmented, Tabs, Tag } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useThemePreference } from '@/components/theme/ThemeProvider'
import PromptTemplateManager from '@/components/settings/PromptTemplateManager'
import { useMainContentLayout } from '@/hooks/useMainContentLayout'
import type { ThemePreference } from '@/utils/themePreference'
import styles from '@/pages/SettingsPage.module.css'

const THEME_OPTIONS: { label: string; value: ThemePreference }[] = [
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
  { label: '跟随系统', value: 'system' },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const initialTab =
    (location.state as { tab?: string } | null)?.tab === 'prompts' ? 'prompts' : 'account'
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const { preference, setPreference } = useThemePreference()

  useMainContentLayout({ lockScroll: false })

  const handleLogout = () => {
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>设置 Settings</h1>
        <p className={styles.desc}>账户、外观与 Prompt 模板管理</p>
      </header>

      <Tabs
        defaultActiveKey={initialTab}
        items={[
          {
            key: 'account',
            label: '账户',
            children: (
              <div className={styles.panel}>
                <div className={styles.accountGrid}>
                  <div className={styles.accountRow}>
                    <span className={styles.accountLabel}>用户名</span>
                    <span className={styles.accountValue}>{user?.username ?? '—'}</span>
                  </div>
                  <div className={styles.accountRow}>
                    <span className={styles.accountLabel}>邮箱</span>
                    <span className={styles.accountValue}>{user?.email ?? '—'}</span>
                  </div>
                  <div className={styles.accountRow}>
                    <span className={styles.accountLabel}>角色</span>
                    <Tag>{user?.role ?? 'User'}</Tag>
                  </div>
                  <div className={styles.accountRow}>
                    <span className={styles.accountLabel}>会话</span>
                    <Button danger onClick={handleLogout}>
                      退出登录
                    </Button>
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: 'appearance',
            label: '外观',
            children: (
              <div className={styles.panel}>
                <p className={styles.appearanceHint}>
                  选择界面主题，偏好将保存在本浏览器 localStorage。
                </p>
                <Segmented
                  options={THEME_OPTIONS}
                  value={preference}
                  onChange={(v) => setPreference(v as ThemePreference)}
                />
              </div>
            ),
          },
          {
            key: 'prompts',
            label: 'Prompt 模板',
            children: (
              <div className={styles.panel}>
                <PromptTemplateManager />
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
