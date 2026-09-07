import { useState, useEffect } from 'react'
import { Form, Input, Modal, Select, Button, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { replaceAssetTagsApi, updateAssetNameApi } from '@/api/assets'
import { splitFileName, joinFileName } from '@/utils/assetName'
import type { AssetVO } from '@/types/api'
import type { TagVO } from '@/api/tags'
import TagOptionLabel from './TagOptionLabel'
import CreateTagModal from './CreateTagModal'

interface EditAssetModalProps {
  open: boolean
  asset: AssetVO | null
  tags: TagVO[]           // 父组件传入的初始列表
  onCancel: () => void
  onSuccess: () => void
  onTagsReload?: (created: TagVO) => void
}

interface EditAssetFormValues {
  nameBase: string
  tagIds: number[]
}

export default function EditAssetModal({
  open,
  asset,
  tags,
  onCancel,
  onSuccess,
  onTagsReload,
}: EditAssetModalProps) {
  const [form] = Form.useForm<EditAssetFormValues>()
  const [submitting, setSubmitting] = useState(false)
  const [fileExt, setFileExt] = useState('')

  // 目的：弹窗内维护自己的标签列表，新建标签后立刻出现在下拉里
  const [availableTags, setAvailableTags] = useState<TagVO[]>(tags)
  const [createTagOpen, setCreateTagOpen] = useState(false)

  useEffect(() => {
    setAvailableTags(tags)
  }, [tags])

  // 目的：打开编辑弹窗时回填当前素材的文件名和标签
  useEffect(() => {
    if (!open || !asset) return

    const { base, ext } = splitFileName(asset.name)
    setFileExt(ext)
    form.setFieldsValue({
      nameBase: base,
      tagIds: asset.tags?.map((t) => t.id) ?? [],
    })
  }, [open, asset, form])

  const handleOk = async () => {
    if (!asset) return

    try {
      const values = await form.validateFields()
      const finalName = joinFileName(values.nameBase, fileExt)

      // 目的：保证后端收到的一定是数组，避免单选时传数字
      const rawTagIds = values.tagIds
      const tagIds = Array.isArray(rawTagIds)
        ? rawTagIds
        : rawTagIds != null
          ? [rawTagIds as number]
          : []

      setSubmitting(true)

      if (finalName !== asset.name) {
        await updateAssetNameApi(asset.id, finalName)
      }

      await replaceAssetTagsApi(asset.id, tagIds)

      message.success('保存成功')
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

  const handleCancel = () => {
    form.resetFields()
    onCancel()
  }

  const handleTagCreated = (created: TagVO) => {
    setCreateTagOpen(false)
    onTagsReload?.(created)

    const current: number[] = form.getFieldValue('tagIds') ?? []
    if (!current.includes(created.id)) {
      form.setFieldsValue({ tagIds: [...current, created.id] })
    }
  }

  return (
    <>
      <Modal
        title="编辑素材"
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
            label="文件名"
            name="nameBase"
            rules={[{ required: true, message: '请输入文件名' }]}
          >
            <Input placeholder="文件名" addonAfter={fileExt || undefined} />
          </Form.Item>

          <Form.Item label="标签">
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Form.Item name="tagIds" noStyle>
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="选择标签（可选）"
                  style={{ flex: 1 }}
                  options={availableTags.map((tag) => ({
                    value: tag.id,
                    label: tag.name,
                    tag,
                  }))}
                  optionRender={(option) => {
                    const tag = (option.data as { tag?: TagVO }).tag
                    if (!tag) return option.label
                    return <TagOptionLabel tag={tag} />
                  }}
                />
              </Form.Item>

              <Button
                icon={<PlusOutlined />}
                onClick={() => setCreateTagOpen(true)}
              >
                新建标签
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      <CreateTagModal
        open={createTagOpen}
        onCancel={() => setCreateTagOpen(false)}
        onSuccess={handleTagCreated}
      />
    </>
  )
}