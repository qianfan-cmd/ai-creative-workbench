import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { Modal, Skeleton, message } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MattingElementRowVO, MattingElementsVO, MattingRegionVO } from '@/api/ops'
import ImageLightbox from '@/components/common/ImageLightbox'
import styles from '@/components/ops/ElementListPanel.module.css'

const MAX_ELEMENTS_PER_GROUP = 20

interface ElementListPanelProps {
  data: MattingElementsVO | null
  loading?: boolean
  detecting?: boolean
  onToggle: (elementId: string, checked: boolean) => void
  onRename: (elementId: string, name: string) => void | Promise<void>
  onReDetect: (regionId: string) => void
  onDelete: (elementId: string) => void | Promise<void>
  onAdd: (
    regionId: string,
    groupName: string,
    elementName?: string,
  ) => Promise<string | undefined> | string | undefined
}

function groupKey(regionId: string, groupName: string) {
  return `${regionId}::${groupName}`
}

function PreviewThumb({
  url,
  className,
  imgClassName,
  title,
  onPreview,
}: {
  url: string
  className: string
  imgClassName: string
  title: string
  onPreview: (url: string, alt: string) => void
}) {
  return (
    <button
      type="button"
      className={className}
      title={title}
      onClick={() => onPreview(url, title)}
    >
      <img src={url} alt="" className={imgClassName} />
    </button>
  )
}

function ElementEditRow({
  el,
  onSaveEdit,
  onCancelEdit,
  onToggle,
}: {
  el: MattingElementRowVO
  onSaveEdit: (name: string) => void
  onCancelEdit: () => void
  onToggle: (elementId: string, checked: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(el.elementName)

  useEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }, [])

  const save = () => {
    const trimmed = draft.replace(/\s+/g, ' ').trim()
    if (!trimmed) {
      message.warning('元素名称不能为空')
      return
    }
    onSaveEdit(trimmed)
  }

  return (
    <div className={`${styles.elementRow} ${styles.elementRow_editing}`}>
      <button
        type="button"
        className={[styles.checkbox, el.checked ? styles.checkbox_checked : ''].join(' ')}
        aria-label={el.checked ? '取消勾选' : '勾选'}
        onClick={() => onToggle(el.id, !el.checked)}
      />
      <input
        ref={inputRef}
        className={styles.elementInput}
        value={draft}
        maxLength={10}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            save()
          }
          if (e.key === 'Escape') onCancelEdit()
        }}
      />
      <button type="button" className={styles.iconBtn} aria-label="保存" onClick={save}>
        <CheckOutlined />
      </button>
      <button type="button" className={styles.iconBtn} aria-label="取消" onClick={onCancelEdit}>
        <CloseOutlined />
      </button>
    </div>
  )
}

function ElementRow({
  el,
  isEditing,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onToggle,
  onDelete,
}: {
  el: MattingElementRowVO
  isEditing: boolean
  onStartEdit: () => void
  onSaveEdit: (name: string) => void
  onCancelEdit: () => void
  onToggle: (elementId: string, checked: boolean) => void
  onDelete: (elementId: string, name: string) => void
}) {
  if (isEditing) {
    return (
      <ElementEditRow
        el={el}
        onSaveEdit={onSaveEdit}
        onCancelEdit={onCancelEdit}
        onToggle={onToggle}
      />
    )
  }

  return (
    <div className={styles.elementRow}>
      <button
        type="button"
        className={[styles.checkbox, el.checked ? styles.checkbox_checked : ''].join(' ')}
        aria-label={el.checked ? '取消勾选' : '勾选'}
        onClick={() => onToggle(el.id, !el.checked)}
      />
      <span className={styles.elementName}>{el.elementName}</span>
      <button type="button" className={styles.iconBtn} aria-label="编辑名称" onClick={onStartEdit}>
        <EditOutlined />
      </button>
      <button
        type="button"
        className={[styles.iconBtn, styles.iconBtn_danger].join(' ')}
        aria-label="删除"
        onClick={() => onDelete(el.id, el.elementName)}
      >
        <DeleteOutlined />
      </button>
    </div>
  )
}

function RegionBlock({
  region,
  collapsedGroups,
  editingId,
  onToggleGroup,
  onToggle,
  onRename,
  onReDetect,
  onDelete,
  onAdd,
  onSetEditingId,
  onPreview,
}: {
  region: MattingRegionVO
  collapsedGroups: Set<string>
  editingId: string | null
  onToggleGroup: (key: string) => void
  onToggle: (elementId: string, checked: boolean) => void
  onRename: (elementId: string, name: string) => void | Promise<void>
  onReDetect: (regionId: string) => void
  onDelete: (elementId: string) => void | Promise<void>
  onAdd: (
    regionId: string,
    groupName: string,
    elementName?: string,
  ) => Promise<string | undefined> | string | undefined
  onSetEditingId: (id: string | null) => void
  onPreview: (url: string, alt: string) => void
}) {
  const handleDelete = (elementId: string, elementName: string) => {
    Modal.confirm({
      title: '确认删除元素',
      content: (
        <div>
          <p>删除后该元素将从清单中移除，无法恢复。</p>
          <p className={styles.deleteTag}>{elementName}</p>
        </div>
      ),
      okText: '确认删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await onDelete(elementId)
        if (editingId === elementId) onSetEditingId(null)
      },
    })
  }

  const handleAdd = async (groupName: string, count: number) => {
    if (count >= MAX_ELEMENTS_PER_GROUP) {
      message.warning(`该分组最多 ${MAX_ELEMENTS_PER_GROUP} 个元素`)
      return
    }
    try {
      const newId = await onAdd(region.regionId, groupName, '新元素')
      if (newId) onSetEditingId(newId)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '添加失败')
    }
  }

  return (
    <div className={styles.regionSection}>
      <div className={styles.regionHdr}>
        <span className={styles.regionAccent} aria-hidden="true" />
        <span className={styles.regionLabel}>{region.regionLabel}</span>
        {region.imageUrl && (
          <PreviewThumb
            url={region.imageUrl}
            className={styles.regionThumbBtn}
            imgClassName={styles.regionThumbImg}
            title="查看区域切图"
            onPreview={onPreview}
          />
        )}
        <button type="button" className={styles.regenBtn} onClick={() => onReDetect(region.regionId)}>
          <ReloadOutlined />
          重新识别
        </button>
      </div>
      {region.groups.map((group) => {
        const key = groupKey(region.regionId, group.groupName)
        const collapsed = collapsedGroups.has(key)
        const atLimit = group.elements.length >= MAX_ELEMENTS_PER_GROUP
        return (
          <div key={group.groupName} className={styles.groupBlock}>
            <div
              className={[styles.groupHead, collapsed ? styles.groupHead_collapsed : ''].join(' ')}
            >
              <button
                type="button"
                className={styles.groupHeadToggle}
                onClick={() => onToggleGroup(key)}
                aria-expanded={!collapsed}
              >
                <span className={styles.groupChev} aria-hidden="true">
                  ▼
                </span>
                <span className={styles.groupName}>{group.groupName}</span>
              </button>
              <button
                type="button"
                className={styles.addBtn}
                title={atLimit ? `该分组最多 ${MAX_ELEMENTS_PER_GROUP} 个元素` : '添加元素'}
                disabled={atLimit}
                onClick={() => void handleAdd(group.groupName, group.elements.length)}
              >
                <PlusOutlined />
              </button>
            </div>
            {!collapsed && (
              <div className={styles.groupBody}>
                {group.elements.map((el) => (
                  <ElementRow
                    key={el.id}
                    el={el}
                    isEditing={editingId === el.id}
                    onStartEdit={() => onSetEditingId(el.id)}
                    onSaveEdit={(name) => {
                      void Promise.resolve(onRename(el.id, name)).then(() => onSetEditingId(null))
                    }}
                    onCancelEdit={() => onSetEditingId(null)}
                    onToggle={onToggle}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function ElementListPanel({
  data,
  loading,
  detecting,
  onToggle,
  onRename,
  onReDetect,
  onDelete,
  onAdd,
}: ElementListPanelProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ url: string; alt: string } | null>(null)

  const openPreview = useCallback((url: string, alt: string) => {
    setPreview({ url, alt })
  }, [])

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  if (loading || detecting) {
    return (
      <div className={styles.shell}>
        <Skeleton active paragraph={{ rows: 6 }} />
        <p className={styles.statusHint}>正在识别图片元素，请稍候…</p>
      </div>
    )
  }

  const hasSources = (data?.sources?.length ?? 0) > 0
  const flatRegions = data?.regions ?? []
  const isEmpty = !data || (!hasSources && flatRegions.length === 0)

  if (isEmpty) {
    return (
      <div className={styles.empty}>
        <p>暂无元素清单，请先完成框选并识别。</p>
      </div>
    )
  }

  const regionBlockProps = {
    collapsedGroups,
    editingId,
    onToggleGroup: toggleGroup,
    onToggle,
    onRename,
    onReDetect,
    onDelete,
    onAdd,
    onSetEditingId: setEditingId,
    onPreview: openPreview,
  }

  return (
    <div className={styles.shell}>
      <div className={styles.scroll}>
        {data!.detectStatus === 'failed' && data!.detectError && (
          <div className={styles.errorBox}>{data!.detectError}</div>
        )}

        {hasSources
          ? (data!.sources ?? []).map((source) => (
              <div key={source.sourceId}>
                <div className={styles.sourceBlock}>
                  {source.imageUrl && (
                    <PreviewThumb
                      url={source.imageUrl}
                      className={styles.sourceThumb}
                      imgClassName={styles.thumbImg}
                      title="查看整图大图"
                      onPreview={openPreview}
                    />
                  )}
                  <div className={styles.sourceMeta}>
                    <span className={styles.sourceKicker}>来源整图</span>
                    <span
                      className={styles.sourceName}
                      title={source.sourceDescription ?? source.label ?? source.sourceId}
                    >
                      {source.sourceDescription ?? source.label ?? source.sourceId}
                    </span>
                  </div>
                </div>
                {source.regions.map((region) => (
                  <RegionBlock key={region.regionId} region={region} {...regionBlockProps} />
                ))}
              </div>
            ))
          : flatRegions.map((region) => (
              <RegionBlock key={region.regionId} region={region} {...regionBlockProps} />
            ))}
      </div>
      <ImageLightbox
        url={preview?.url ?? null}
        alt={preview?.alt}
        onClose={() => setPreview(null)}
      />
    </div>
  )
}
