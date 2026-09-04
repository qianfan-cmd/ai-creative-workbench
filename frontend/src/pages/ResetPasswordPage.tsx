import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Form, Input, message } from 'antd'
import AuthCardLayout from '@/components/auth/AuthCardLayout'
import { resetPasswordApi } from '@/api/auth'
import styles from '@/pages/LoginPage.module.css'

interface ResetPasswordFormValues {
  newPassword: string
  confirmPassword: string
}

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams])
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: ResetPasswordFormValues) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的密码不一致')
      return
    }
    if (!token) {
      message.error('重置链接无效，请重新申请')
      return
    }

    setLoading(true)
    try {
      const msg = await resetPasswordApi({
        token,
        newPassword: values.newPassword,
      })
      message.success(msg || '密码已重置')
      navigate('/login', { replace: true })
    } catch (err) {
      message.error(err instanceof Error ? err.message : '重置失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCardLayout
      title="设置新密码"
      subtitle="Choose a new password for your account"
    >
      {!token ? (
        <p className={styles.footer}>
          重置链接无效或已过期，请
          <Link to="/forgot-password"> 重新申请 </Link>
          。
        </p>
      ) : (
        <Form layout="vertical" onFinish={onFinish} autoComplete="off">
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
          <Button type="primary" htmlType="submit" block loading={loading}>
            重置密码
          </Button>
        </Form>
      )}

      <p className={styles.footer}>
        <Link to="/login">返回登录</Link>
      </p>
    </AuthCardLayout>
  )
}
