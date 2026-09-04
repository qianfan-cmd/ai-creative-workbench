import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Form, Input, message } from 'antd'
import AuthCardLayout from '@/components/auth/AuthCardLayout'
import { forgotPasswordApi } from '@/api/auth'
import styles from '@/pages/LoginPage.module.css'

interface ForgotPasswordFormValues {
  email: string
}

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const onFinish = async (values: ForgotPasswordFormValues) => {
    setLoading(true)
    try {
      const msg = await forgotPasswordApi(values)
      setSubmitted(true)
      message.success(msg || '若该邮箱已注册，您将收到重置密码邮件')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '请求失败'
      message.error(msg)
      if (msg.includes('未配置') || msg.includes('application-local.yml')) {
        message.info('本地开发需在 backend-java/application-local.yml 配置 QQ SMTP，参考 application-local.yml.example')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCardLayout
      title="找回密码"
      subtitle="Reset your password via email"
    >
      {submitted ? (
        <p className={styles.footer}>
          若该邮箱已注册，我们已发送重置链接，请查收邮件（链接 1 小时内有效）。
        </p>
      ) : (
        <Form layout="vertical" onFinish={onFinish} autoComplete="off">
          <Form.Item
            label="注册邮箱"
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input placeholder="you@example.com" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            发送重置链接
          </Button>
        </Form>
      )}

      <p className={styles.footer}>
        <Link to="/login">返回登录</Link>
      </p>
    </AuthCardLayout>
  )
}
