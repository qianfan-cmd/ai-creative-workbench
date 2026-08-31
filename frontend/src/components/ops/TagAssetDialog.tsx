import { Modal, Input, Select, message } from 'antd'
import { useEffect, useState } from 'react'
import { uploadAssetApi, replaceAssetTagsApi } from '@/api/assets'
import request from '@/api/request'
import type { ApiResponse, TagVO } from '@/types/api'
import styles from '@/components/ops/TagAssetDialog.module.css'

interface TagAssetDialogProps {
  open: boolean
  imageUrl: string | null
  defaultName?: string
  defaultTags?: string[]
  onClose: () => void
  onSaved?: (assetId: number) => void
}

async function fetchTags(): Promise<TagVO[]> {
  const res = await request.get<ApiResponse<TagVO[]>>('/tags')
  return res.data.data
}

export default function TagAssetDialog({
  open,
  imageUrl,
  defaultName = 'generated-asset.png',
  defaultTags = ['generated'],
  onClose,
  onSaved,
}: TagAssetDialogProps) {
  const [name, setName] = useState(defaultName)
  const [tags, setTags] = useState<TagVO[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(defaultName)
    void fetchTags().then((list) => {
      setTags(list)
      const ids = list.filter((t) => defaultTags.includes(t.name)).map((t) => t.id)
      setSelectedTagIds(ids)
    })
  }, [open, defaultName, defaultTags])

  const handleSave = async () => {
    if (!imageUrl) return
    setSaving(true)
    try {
      const resp = await fetch(imageUrl)
      const blob = await resp.blob()
      const file = new File([blob], name, { type: blob.type || 'image/png' })
      const uploaded = await uploadAssetApi(file)
      if (selectedTagIds.length > 0) {
        await replaceAssetTagsApi(uploaded.id, selectedTagIds)
      }
      message.success('已入库')
      onSaved?.(uploaded.id)
      onClose()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '入库失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="打标入库"
      open={open}
      onCancel={onClose}
      onOk={() => void handleSave()}
      confirmLoading={saving}
      okText="确认入库"
    >
      <div className={styles.body}>
        {imageUrl && <img src={imageUrl} alt="预览" className={styles.preview} />}
        <label className={styles.label}>文件名</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
        <label className={styles.label}>标签</label>
        <Select
          mode="multiple"
          className={styles.selectFull}
          placeholder="选择标签"
          value={selectedTagIds}
          onChange={setSelectedTagIds}
          options={tags.map((t) => ({ value: t.id, label: t.name }))}
        />
      </div>
    </Modal>
  )
}
