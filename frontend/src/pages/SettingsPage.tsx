import { useEffect, useRef, useState } from 'react'
import { Button, Collapse, Form, Input, Segmented, Tabs, Tag, message } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useThemePreference } from '@/components/theme/ThemeProvider'
import PromptTemplateManager from '@/components/settings/PromptTemplateManager'
import UserAvatar from '@/components/common/UserAvatar'
import {
  changePasswordApi,
  updateProfileApi,
  uploadAvatarApi,
} from '@/api/auth'
import { useMainContentLayout } from '@/hooks/useMainContentLayout'
import type { ThemePreference } from '@/utils/themePreference'
import styles from '@/pages/SettingsPage.module.css'

const THEME_OPTIONS: { label: string; value: ThemePreference }[] = [
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
  { label: '跟随系统', value: 'system' },
]

interface ProfileFormValues {
  username: string
  email: string
}

interface PasswordFormValues {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const AVATAR_MAX_BYTES = 2 * 1024 * 1024

export default function SettingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const initialTab =
    (location.state as { tab?: string } | null)?.tab === 'prompts' ? 'prompts' : 'account'
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const { preference, setPreference } = useThemePreference()
  const [profileForm] = Form.useForm<ProfileFormValues>()
  const [passwordForm] = Form.useForm<PasswordFormValues>()
  const [profileSaving, setProfileSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useMainContentLayout({ lockScroll: false })

  useEffect(() => {
    if (user) {
      profileForm.setFieldsValue({
        username: user.username,
        email: user.email,
      })
    }
  }, [user, profileForm])

  const handleLogout = () => {
    clearAuth()
    navigate('/login', { replace: true })
  }

  const handleProfileSave = async (values: ProfileFormValues) => {
    setProfileSaving(true)
    try {
      const updated = await updateProfileApi(values)
      updateUser(updated)
      message.success('账户资料已保存')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setProfileSaving(false)
    }
  }

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (file.size > AVATAR_MAX_BYTES) {
      message.error('头像不能大于 2MB')
      return
    }

    setAvatarUploading(true)
    try {
      const updated = await uploadAvatarApi(file)
      updateUser(updated)
      message.success('头像已更新')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '头像上传失败')
    } finally {
      setAvatarUploading(false)
    }
  }

  const handlePasswordSave = async (values: PasswordFormValues) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的新密码不一致')
      return
    }

    setPasswordSaving(true)
    try {
      await changePasswordApi({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      message.success('密码已更新，请重新登录')
      passwordForm.resetFields()
      clearAuth()
      navigate('/login', { replace: true })
    } catch (err) {
      message.error(err instanceof Error ? err.message : '修改密码失败')
    } finally {
      setPasswordSaving(false)
    }
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
                <div className={styles.avatarSection}>
                  <UserAvatar user={user} size={72} className={styles.avatarPreview} />
                  <div className={styles.avatarActions}>
                    <p className={styles.avatarHint}>支持 PNG、JPG、WebP，最大 2MB</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className={styles.hiddenInput}
                      onChange={handleAvatarChange}
                    />
                    <Button
                      loading={avatarUploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      更换头像
                    </Button>
                  </div>
                </div>

                <Form
                  form={profileForm}
                  layout="vertical"
                  className={styles.profileForm}
                  onFinish={handleProfileSave}
                >
                  <Form.Item
                    label="用户名"
                    name="username"
                    rules={[{ required: true, message: '请输入用户名' }]}
                  >
                    <Input placeholder="用户名" />
                  </Form.Item>
                  <Form.Item
                    label="邮箱"
                    name="email"
                    rules={[
                      { required: true, message: '请输入邮箱' },
                      { type: 'email', message: '邮箱格式不正确' },
                    ]}
                  >
                    <Input placeholder="邮箱" />
                  </Form.Item>
                  <div className={styles.accountMeta}>
                    <span className={styles.accountLabel}>角色</span>
                    <Tag>{user?.role ?? 'User'}</Tag>
                  </div>
                  <Button type="primary" htmlType="submit" loading={profileSaving}>
                    保存资料
                  </Button>
                </Form>

                <Collapse
                  className={styles.securityCollapse}
                  items={[
                    {
                      key: 'password',
                      label: '修改密码',
                      children: (
                        <Form
                          form={passwordForm}
                          layout="vertical"
                          onFinish={handlePasswordSave}
                        >
                          <Form.Item
                            label="当前密码"
                            name="currentPassword"
                            rules={[{ required: true, message: '请输入当前密码' }]}
                          >
                            <Input.Password placeholder="当前密码" />
                          </Form.Item>
                          <Form.Item
                            label="新密码"
                            name="newPassword"
                            rules={[
                              { required: true, message: '请输入新密码' },
                              { min: 6, message: '密码至少 6 位' },
                            ]}
                          >
                            <Input.Password placeholder="新密码（至少 6 位）" />
                          </Form.Item>
                          <Form.Item
                            label="确认新密码"
                            name="confirmPassword"
                            rules={[{ required: true, message: '请再次输入新密码' }]}
                          >
                            <Input.Password placeholder="确认新密码" />
                          </Form.Item>
                          <Button type="primary" htmlType="submit" loading={passwordSaving}>
                            更新密码
                          </Button>
                        </Form>
                      ),
                    },
                  ]}
                />

                <div className={styles.accountRow}>
                  <span className={styles.accountLabel}>会话</span>
                  <Button danger onClick={handleLogout}>
                    退出登录
                  </Button>
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
