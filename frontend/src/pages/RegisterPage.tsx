import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Form, Input, Button, message } from 'antd'
import { registerApi } from '@/api/auth'
import AuthCardLayout from '@/components/auth/AuthCardLayout'
import styles from '@/pages/RegisterPage.module.css'

interface RegisterFormValues {
  username: string
  password: string
  email?: string
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: RegisterFormValues) => {
    setLoading(true)
    try {
      await registerApi(values)
      message.success('注册成功，请登录')
      navigate('/login', { replace: true })
    } catch (err) {
      message.error(err instanceof Error ? err.message : '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCardLayout
      title="注册账号"
      subtitle="Create your AI Creative Workbench account"
    >
      <Form layout="vertical" onFinish={onFinish} autoComplete="off">
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
          rules={[
            { required: true, message: '请输入密码' },
            { min: 6, message: '密码至少 6 位' },
          ]}
        >
          <Input.Password placeholder="至少 6 位" />
        </Form.Item>

        <Form.Item label="邮箱" name="email">
          <Input placeholder="可选" />
        </Form.Item>

        <Button type="primary" htmlType="submit" block loading={loading}>
          注册
        </Button>
      </Form>

      <p className={styles.footer}>
        已有账号？<Link to="/login">去登录</Link>
      </p>
    </AuthCardLayout>
  )
}