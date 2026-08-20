import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { loginApi } from '@/api/auth'
import { Button, Input, Form, message } from 'antd'
import AuthCardLayout from '@/components/auth/AuthCardLayout'
import styles from '@/pages/LoginPage.module.css'

interface LoginFormValues {
  username: string
  password: string
}

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: LoginFormValues) => {
    setLoading(true)
    try {
      const data = await loginApi(values)
      setAuth(data.token, data.user)
      message.success('登录成功')
      navigate('/')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCardLayout
      title="登录工作台"
      subtitle="Sign in to AI Creative Workbench"
    >
      <Form
        name="login"
        layout="vertical"
        onFinish={onFinish}
        autoComplete="off"
      >
        <Form.Item
          label="用户名"
          name="username"
          rules={[{ required: true, message: '请输入用户名' }]}
        >
          <Input placeholder="请输入用户名" />
        </Form.Item>

        <Form.Item
          label="密码"
          name="password"
          rules={[{ required: true, message: '请输入密码' }]}
        >
          <Input.Password placeholder="请输入密码" />
        </Form.Item>

        <Button type="primary" htmlType="submit" block loading={loading}>
          登录
        </Button>
      </Form>

      <p className={styles.footer}>
        还没有账号？<Link to="/register">立即注册</Link>
      </p>
    </AuthCardLayout>
  )
}