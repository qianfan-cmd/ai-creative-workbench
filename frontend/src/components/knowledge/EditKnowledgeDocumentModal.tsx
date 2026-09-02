import { useEffect, useState } from 'react'
import { Form, Input, Modal, message } from 'antd'
import { patchKnowledgeDocumentApi } from '@/api/knowledge'
import type { KnowledgeDocumentVO } from '@/api/knowledge'

interface EditKnowledgeDocumentModalProps {
  open: boolean
  document: KnowledgeDocumentVO | null
  onCancel: () => void
  onSuccess: () => void
}

export default function EditKnowledgeDocumentModal({
  open,
  document,
  onCancel,
  onSuccess,
}: EditKnowledgeDocumentModalProps) {
  const [form] = Form.useForm<{ filename: string }>()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !document) return
    form.setFieldsValue({ filename: document.filename })
  }, [open, document, form])

  const handleOk = async () => {
    if (!document) return
    try {
      const values = await form.validateFields()
      const filename = values.filename.trim()
      if (!filename) {
        message.warning('文件名不能为空')
        return
      }
      setSubmitting(true)
      await patchKnowledgeDocumentApi(document.id, { filename })
      message.success('已更新文档名称')
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
      title="重命名文档"
      open={open}
      onCancel={onCancel}
      onOk={() => void handleOk()}
      confirmLoading={submitting}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="filename"
          label="文件名"
          rules={[{ required: true, message: '请输入文件名' }]}
        >
          <Input placeholder="例如 notes.md" />
        </Form.Item>
        {document && !document.hasOriginalFile && (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            该文档为历史回填记录，无原文件时无法重命名。
          </p>
        )}
      </Form>
    </Modal>
  )
}
