import { useEffect, useState } from 'react'
import { Modal, Form, Input, message } from 'antd'
import { updateTagApi } from '@/api/tags'
import type { TagVO } from '@/api/tags'
import TagColorPicker from '@/components/assets/TagColorPicker'

interface EditTagModalProps {
    open: boolean
    tag: TagVO | null
    onCancel: () => void
    onSuccess: () => void
}

interface EditTagFormValues {
    name: string
    color?: string
}

export default function EditTagModal({
    open,
    tag,
    onCancel,
    onSuccess,
}: EditTagModalProps) {
    const [form] = Form.useForm<EditTagFormValues>();
    const [submitting, setSubmitting] = useState(false);

    // 打开弹窗时回填
    useEffect(() => {
        if (!open || !tag) return;
        form.setFieldsValue({
            name: tag.name,
            color: tag.color,
        })
    }, [open, tag, form])

    const handleOk = async () => {
        if (!tag) return;

        try {
            const values = await form.validateFields();
            setSubmitting(true);
            await updateTagApi(tag.id, {
                name: values.name.trim(),
                color: values.color?.trim() || undefined,
            })
            message.success('标签更新成功');
            form.resetFields();
            onSuccess();
        } catch (err) {
            if (err instanceof Error) {
                message.error(err.message);
            }
        } finally {
            setSubmitting(false);
        }
    }

    const handleCancel = () => {
        form.resetFields();
        onCancel()
    }

    return (
        <Modal
            title="编辑标签"
            open={open}
            onCancel={handleCancel}
            onOk={handleOk}
            confirmLoading={submitting}
            destroyOnClose
            okText="保存"
            cancelText="取消"
        >
            <Form form={form} layout="vertical">
                <Form.Item
                    label="标签名"
                    name="name"
                    rules={[{ required: true, message: '请输入标签名' }]}
                >
                    <Input placeholder="例如 Marketing" maxLength={32} />
                </Form.Item>

                <Form.Item label="标签颜色（可选）" name="color">
                    <TagColorPicker />
                </Form.Item>
            </Form>
        </Modal>
    )
}