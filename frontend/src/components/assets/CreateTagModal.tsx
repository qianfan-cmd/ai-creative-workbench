import { useState } from 'react'
import { Form, Input, Modal, message } from 'antd'
import { createTagApi } from '@/api/tags'

interface CreateTagModalProps {
  open: boolean
  onCancel: () => void
  onSuccess: () => void
}

interface CreateTagFormValues {
  name: string
  color?: string
}

export default function CreateTagModal({ open, onCancel, onSuccess }: CreateTagModalProps) {
  const [form] = Form.useForm<CreateTagFormValues>()
  const [submitting, setSubmitting] = useState(false)

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      await createTagApi({
        name: values.name.trim(),
        color: values.color?.trim() || undefined,
      })
      message.success('标签创建成功')
      form.resetFields()
      onSuccess()
    } catch (err) {
      if (err instanceof Error) {
        message.error(err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="新建标签"
      open={open}
      onCancel={() => {
        form.resetFields()
        onCancel()
      }}
      onOk={handleOk}
      confirmLoading={submitting}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="标签名"
          name="name"
          rules={[{ required: true, message: '请输入标签名' }]}
        >
          <Input placeholder="例如 Marketing" maxLength={32} />
        </Form.Item>

        <Form.Item label="颜色（可选）" name="color">
          <Input placeholder="#0D9488，留空使用默认色" />
        </Form.Item>
      </Form>
    </Modal>
  )
}