import { useCallback, useEffect, useState } from 'react'
import { Modal, Select } from 'antd'
import { listTagsApi, type TagVO } from '@/api/tags'
import { updateKnowledgeDocumentTagsApi } from '@/api/knowledge'
import TagOptionLabel from '@/components/assets/TagOptionLabel'
import { showApiError } from '@/utils/apiError'

interface KnowledgeDocumentTagsModalProps {
  open: boolean
  documentId: number | null
  filename?: string
  initialTagIds?: number[]
  onClose: () => void
  onSaved: (tags: TagVO[]) => void
}

export default function KnowledgeDocumentTagsModal({
  open,
  documentId,
  filename,
  initialTagIds = [],
  onClose,
  onSaved,
}: KnowledgeDocumentTagsModalProps) {
  const [allTags, setAllTags] = useState<TagVO[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelected(initialTagIds)
    listTagsApi().then(setAllTags).catch(() => setAllTags([]))
  }, [open, initialTagIds])

  const handleOk = useCallback(async () => {
    if (!documentId) return
    setSaving(true)
    try {
      const tags = await updateKnowledgeDocumentTagsApi(documentId, selected)
      onSaved(tags)
      onClose()
    } catch (error) {
      showApiError(error, '保存标签失败')
    } finally {
      setSaving(false)
    }
  }, [documentId, onClose, onSaved, selected])

  return (
    <Modal
      title={filename ? `编辑标签 — ${filename}` : '编辑标签'}
      open={open}
      onCancel={onClose}
      onOk={() => void handleOk()}
      confirmLoading={saving}
      destroyOnClose
    >
      <Select
        mode="multiple"
        style={{ width: '100%' }}
        placeholder="选择标签（AI 入库时会自动建议）"
        value={selected}
        onChange={setSelected}
        optionFilterProp="label"
        options={allTags.map((tag) => ({
          value: tag.id,
          label: tag.name,
          tag,
        }))}
        optionRender={(option) => (
          <TagOptionLabel tag={(option.data as { tag: TagVO }).tag} />
        )}
      />
    </Modal>
  )
}
