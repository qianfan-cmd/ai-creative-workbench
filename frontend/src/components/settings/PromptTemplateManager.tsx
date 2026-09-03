import { useCallback, useEffect, useState } from 'react'
import { Button, Form, Input, Modal, Select, Space, Table, Tag, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  createPromptApi,
  deletePromptApi,
  getPromptApi,
  getPromptSceneLabel,
  getSceneDisplayName,
  isSystemPrompt,
  listPromptsApi,
  updatePromptApi,
  type PromptTemplateVO,
} from '@/api/prompts'
import PromptTemplateHelp from '@/components/settings/PromptTemplateHelp'
import {
  COPY_STYLE_SCENE_OPTIONS,
  SCENE_TYPE_OPTIONS,
  VISUAL_STYLE_CONTENT_EXAMPLE,
  VISUAL_STYLE_SCENE_OPTIONS,
} from '@/components/settings/promptTemplateGuide'
import { formatDate } from '@/utils/format'
import styles from '@/components/settings/PromptTemplateManager.module.css'

const SCENE_TAG_COLOR: Record<string, string> = {
  文案初稿: 'cyan',
  文案风格: 'blue',
  视觉风格: 'gold',
  配图生成: 'green',
  抠图: 'default',
  其它: 'default',
}

const COPY_STYLE_CONTENT_PLACEHOLDER = `例如：将以下活动文案改写为正式、清晰、专业的公告风格，保留事实不变。

原文：
{{copy}}

用户补充：
{{hint}}

要求：输出 JSON，包含 title 和 body 字段。`

const VISUAL_STYLE_CONTENT_PLACEHOLDER = `例如：${VISUAL_STYLE_CONTENT_EXAMPLE}

写 1–2 句画面/氛围/配色关键词即可，不需要 {{变量}}。`

type SceneFilter = 'copy_style' | 'campaign_visual' | 'all'

function sceneOptionsForEdit(scene: string, sceneFilter: SceneFilter) {
  if (sceneFilter === 'copy_style' || scene.startsWith('copy_style_')) {
    return COPY_STYLE_SCENE_OPTIONS
  }
  if (sceneFilter === 'campaign_visual' || scene.startsWith('campaign_visual_')) {
    return VISUAL_STYLE_SCENE_OPTIONS
  }
  return SCENE_TYPE_OPTIONS
}

function defaultSceneForDuplicate(scene: string) {
  if (scene.startsWith('campaign_visual_')) return 'campaign_visual_custom'
  return 'copy_style_custom'
}

function defaultSceneForFilter(sceneFilter: SceneFilter) {
  if (sceneFilter === 'campaign_visual') return 'campaign_visual_custom'
  return 'copy_style_custom'
}

function helpVariantForFilter(sceneFilter: SceneFilter) {
  if (sceneFilter === 'copy_style') return 'copyStyle' as const
  if (sceneFilter === 'campaign_visual') return 'visualStyle' as const
  return 'full' as const
}

function contentPlaceholderForFilter(sceneFilter: SceneFilter, editingScene?: string) {
  if (sceneFilter === 'campaign_visual') return VISUAL_STYLE_CONTENT_PLACEHOLDER
  if (sceneFilter === 'all' && editingScene?.startsWith('campaign_visual_')) {
    return VISUAL_STYLE_CONTENT_PLACEHOLDER
  }
  return COPY_STYLE_CONTENT_PLACEHOLDER
}

function contentLabelForFilter(sceneFilter: SceneFilter, editingScene?: string) {
  if (sceneFilter === 'campaign_visual') return '风格描述'
  if (sceneFilter === 'all' && editingScene?.startsWith('campaign_visual_')) return '风格描述'
  return '模板内容'
}

interface PromptTemplateManagerProps {
  /** Campaign Drawer 按类型过滤；Settings 用 all 展示全部 */
  sceneFilter?: SceneFilter
  compact?: boolean
  onChanged?: () => void
}

export default function PromptTemplateManager({
  sceneFilter = 'all',
  compact = false,
  onChanged,
}: PromptTemplateManagerProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingModal, setLoadingModal] = useState(false)
  const [templates, setTemplates] = useState<PromptTemplateVO[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [viewOnly, setViewOnly] = useState(false)
  const [editing, setEditing] = useState<PromptTemplateVO | null>(null)
  const [duplicateDraft, setDuplicateDraft] = useState<PromptTemplateVO | null>(null)
  const [form] = Form.useForm<{ name: string; scene: string; content: string }>()

  const createSceneOptions =
    sceneFilter === 'copy_style'
      ? COPY_STYLE_SCENE_OPTIONS
      : sceneFilter === 'campaign_visual'
        ? VISUAL_STYLE_SCENE_OPTIONS
        : SCENE_TYPE_OPTIONS

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listPromptsApi()
      const filtered =
        sceneFilter === 'copy_style'
          ? data.filter((t) => t.scene.startsWith('copy_style_'))
          : sceneFilter === 'campaign_visual'
            ? data.filter((t) => t.scene.startsWith('campaign_visual_'))
            : data
      setTemplates(filtered)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载模板失败')
    } finally {
      setLoading(false)
    }
  }, [sceneFilter])

  useEffect(() => {
    void fetchTemplates()
  }, [fetchTemplates])

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
    setViewOnly(false)
    setDuplicateDraft(null)
    form.resetFields()
  }

  const openCreate = () => {
    setEditing(null)
    setViewOnly(false)
    setDuplicateDraft(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (record: PromptTemplateVO, readonly: boolean) => {
    setEditing(record)
    setViewOnly(readonly)
    setDuplicateDraft(null)
    setModalOpen(true)
  }

  const openDuplicate = (record: PromptTemplateVO) => {
    setEditing(null)
    setViewOnly(false)
    setDuplicateDraft(null)
    if (modalOpen) {
      form.setFieldsValue({
        name: `${record.name}（副本）`,
        scene: defaultSceneForDuplicate(record.scene),
        content: record.content,
      })
      return
    }
    setDuplicateDraft(record)
    setModalOpen(true)
  }

  const populateModalForm = useCallback(async () => {
    if (editing) {
      setLoadingModal(true)
      try {
        const detail = await getPromptApi(editing.id)
        form.setFieldsValue({
          name: detail.name,
          scene: detail.scene,
          content: detail.content,
        })
      } catch (err) {
        message.error(err instanceof Error ? err.message : '加载模板详情失败')
        form.setFieldsValue({
          name: editing.name,
          scene: editing.scene,
          content: editing.content,
        })
      } finally {
        setLoadingModal(false)
      }
      return
    }

    if (duplicateDraft) {
      form.setFieldsValue({
        name: `${duplicateDraft.name}（副本）`,
        scene: defaultSceneForDuplicate(duplicateDraft.scene),
        content: duplicateDraft.content,
      })
      setDuplicateDraft(null)
      return
    }

    form.setFieldsValue({
      scene: createSceneOptions[0]?.value ?? defaultSceneForFilter(sceneFilter),
    })
  }, [createSceneOptions, duplicateDraft, editing, form, sceneFilter])

  const handleSubmit = async () => {
    if (viewOnly) {
      closeModal()
      return
    }

    let values: { name: string; scene: string; content: string }
    try {
      values = await form.validateFields()
    } catch {
      return
    }

    setSaving(true)
    try {
      if (editing) {
        await updatePromptApi(editing.id, values)
        message.success('模板已更新')
      } else {
        await createPromptApi(values)
        message.success('模板已创建')
      }
      closeModal()
      await fetchTemplates()
      onChanged?.()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (record: PromptTemplateVO) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除模板「${record.name}」吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await deletePromptApi(record.id)
        message.success('已删除')
        await fetchTemplates()
        onChanged?.()
      },
    })
  }

  const renderActions = (_: unknown, record: PromptTemplateVO) => {
    const system = isSystemPrompt(record)
    return (
      <Space size="small" wrap>
        <Button type="link" size="small" onClick={() => openEdit(record, system)}>
          {system ? '查看' : '编辑'}
        </Button>
        {system ? (
          <Button type="link" size="small" onClick={() => openDuplicate(record)}>
            复制编辑
          </Button>
        ) : (
          <Button type="link" size="small" danger onClick={() => handleDelete(record)}>
            删除
          </Button>
        )}
      </Space>
    )
  }

  const columns: ColumnsType<PromptTemplateVO> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'scene',
      key: 'scene',
      width: compact ? 100 : 120,
      render: (scene: string) => {
        const label = getPromptSceneLabel(scene)
        return <Tag color={SCENE_TAG_COLOR[label] ?? 'default'}>{label}</Tag>
      },
    },
    ...(compact
      ? []
      : [
          {
            title: '类型说明',
            key: 'sceneName',
            width: 140,
            render: (_: unknown, record: PromptTemplateVO) => getSceneDisplayName(record.scene),
          } as ColumnsType<PromptTemplateVO>[number],
          {
            title: '归属',
            key: 'type',
            width: 100,
            render: (_: unknown, record: PromptTemplateVO) =>
              isSystemPrompt(record) ? (
                <Tag>系统内置</Tag>
              ) : (
                <Tag color="processing">我的模板</Tag>
              ),
          } as ColumnsType<PromptTemplateVO>[number],
          {
            title: '更新时间',
            dataIndex: 'updatedAt',
            key: 'updatedAt',
            width: 160,
            render: (v: string | undefined) => (v ? formatDate(v) : '—'),
          } as ColumnsType<PromptTemplateVO>[number],
        ]),
    {
      title: '操作',
      key: 'actions',
      width: compact ? 160 : 200,
      render: renderActions,
    },
  ]

  const isEditingMine = editing != null && !viewOnly
  const editSceneOptions = editing
    ? sceneOptionsForEdit(editing.scene, sceneFilter)
    : createSceneOptions

  const viewSystemTemplate = viewOnly && editing != null && isSystemPrompt(editing)
  const contentPlaceholder = contentPlaceholderForFilter(sceneFilter, editing?.scene)
  const contentLabel = contentLabelForFilter(sceneFilter, editing?.scene)
  const namePlaceholder =
    sceneFilter === 'campaign_visual' ? '如：赛博朋克' : '如：活泼推送'

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <PromptTemplateHelp variant={helpVariantForFilter(sceneFilter)} />
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新建模板
        </Button>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={templates}
        pagination={compact ? false : { pageSize: 10, showSizeChanger: false }}
        size={compact ? 'small' : 'middle'}
      />

      <Modal
        title={viewOnly ? '查看模板' : editing ? '编辑模板' : '新建模板'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => void handleSubmit()}
        okText={viewOnly ? '关闭' : '保存'}
        confirmLoading={saving}
        cancelButtonProps={{ style: viewOnly ? { display: 'none' } : undefined }}
        footer={
          viewSystemTemplate
            ? [
                <Button key="duplicate" onClick={() => openDuplicate(editing!)}>
                  复制编辑
                </Button>,
                <Button key="close" type="primary" onClick={closeModal}>
                  关闭
                </Button>,
              ]
            : undefined
        }
        width={560}
        destroyOnClose
        afterOpenChange={(open) => {
          if (open) void populateModalForm()
        }}
      >
        <Form form={form} layout="vertical" disabled={viewOnly || loadingModal}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder={namePlaceholder} />
          </Form.Item>
          {viewOnly ? (
            <>
              <Form.Item name="scene" hidden>
                <Input />
              </Form.Item>
              <Form.Item label="模板类型">
                <Input value={editing ? getSceneDisplayName(editing.scene) : ''} disabled />
              </Form.Item>
            </>
          ) : (
            <Form.Item
              name="scene"
              label="模板类型"
              rules={[{ required: true, message: '请选择模板类型' }]}
              extra="不确定怎么写？点击列表上方 ? 查看使用说明"
            >
              <Select
                options={isEditingMine ? editSceneOptions : createSceneOptions}
                disabled={isEditingMine && editSceneOptions.length <= 1}
              />
            </Form.Item>
          )}
          <Form.Item
            name="content"
            label={contentLabel}
            rules={[{ required: true, message: '请输入内容' }]}
            extra={viewOnly ? undefined : '不确定怎么写？点击列表上方 ? 查看使用说明'}
          >
            <Input.TextArea rows={8} placeholder={contentPlaceholder} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
