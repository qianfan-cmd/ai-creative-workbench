import { Button, message } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { listAssetsApi } from '@/api/assets'
import { listTagsApi, type TagVO } from '@/api/tags'
import useDebouncedValue from '@/hooks/useDebouncedValue'
import type { MattingTaskVO } from '@/api/ops'
import {
  confirmMattingSourceApi,
  generateMattingSourceApi,
  patchMattingSourceSchemesApi,
} from '@/api/ops'
import SourceGenerateComposer, { type SourceGeneratePayload } from '@/components/ops/SourceGenerateComposer'
import OpsImageSourcePicker from '@/components/ops/OpsImageSourcePicker'
import ImageLightbox from '@/components/common/ImageLightbox'
import {
  addWorkflowSourcesFromLibraryApi,
  deleteWorkflowSourceApi,
  listWorkflowSourcesApi,
  patchWorkflowSourceApi,
  uploadSourcesToAssetLike,
  uploadWorkflowSourceApi,
  workflowSourceToScheme,
  type WorkflowSourceVO,
} from '@/api/workflowSource'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const ACCEPT_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

type TopMode = 'upload' | 'library'
type LibraryTab = 'existing' | 'ai'

interface MattingStage1SourceProps {
  taskId: number
  sourceAssetId?: number | null
  sourceAssetUrl?: string | null
  configJson?: string | null
  onConfirmed: (task: MattingTaskVO) => void
  onBeforeConfirm?: () => Promise<boolean>
}

function validateFile(file: File): string | null {
  if (!ACCEPT_TYPES.includes(file.type)) return '仅支持 PNG / JPG / WebP'
  if (file.size > MAX_FILE_BYTES) return '文件不能超过 10MB'
  return null
}

export default function MattingStage1Source({
  taskId,
  onConfirmed,
  onBeforeConfirm,
}: MattingStage1SourceProps) {
  const [topMode, setTopMode] = useState<TopMode>('upload')
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('existing')
  const [sources, setSources] = useState<WorkflowSourceVO[]>([])
  const [loadingSources, setLoadingSources] = useState(false)
  const [libraryAssets, setLibraryAssets] = useState<Awaited<ReturnType<typeof listAssetsApi>>['records']>([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [assetTagId, setAssetTagId] = useState<number | undefined>()
  const [assetKeywordInput, setAssetKeywordInput] = useState('')
  const assetKeyword = useDebouncedValue(assetKeywordInput.trim(), 300)
  const [tags, setTags] = useState<TagVO[]>([])
  const [confirming, setConfirming] = useState(false)
  const [preview, setPreview] = useState<{ url: string; alt: string } | null>(null)

  const taskIdRef = useRef(taskId)
  useEffect(() => {
    taskIdRef.current = taskId
  }, [taskId])

  const loadSources = useCallback(async () => {
    const entityId = taskIdRef.current
    setLoadingSources(true)
    try {
      const list = await listWorkflowSourcesApi({ context: 'matting', taskId: entityId })
      if (taskIdRef.current !== entityId) return
      setSources(list)
    } catch (e) {
      if (taskIdRef.current === entityId) {
        message.error(e instanceof Error ? e.message : '加载源图失败')
      }
    } finally {
      if (taskIdRef.current === entityId) {
        setLoadingSources(false)
      }
    }
  }, [taskId])

  useEffect(() => {
    void loadSources()
  }, [loadSources])

  const loadLibrary = useCallback(async () => {
    setLoadingLibrary(true)
    try {
      const page = await listAssetsApi({
        page: 1,
        size: 24,
        tagId: assetTagId,
        keyword: assetKeyword || undefined,
      })
      setLibraryAssets(page.records ?? [])
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载素材失败')
    } finally {
      setLoadingLibrary(false)
    }
  }, [assetTagId, assetKeyword])

  useEffect(() => {
    if (topMode === 'library' && libraryTab === 'existing') void loadLibrary()
  }, [topMode, libraryTab, loadLibrary])

  useEffect(() => {
    if (topMode === 'library') {
      listTagsApi().then(setTags).catch(() => setTags([]))
    }
  }, [topMode])

  const uploadItems = uploadSourcesToAssetLike(sources)
  const aiSchemes = sources.filter((s) => s.sourceType === 'ai_gen').map(workflowSourceToScheme)
  const selectedUploadIds = new Set(
    sources.filter((s) => s.sourceType === 'upload' && s.selected).map((s) => s.id),
  )
  const libraryByAssetId = new Map(
    sources.filter((s) => s.sourceType === 'library' && s.assetId).map((s) => [s.assetId!, s]),
  )
  const selectedLibraryAssetIds = new Set(
    sources.filter((s) => s.sourceType === 'library' && s.selected && s.assetId).map((s) => s.assetId!),
  )
  const totalSelected = sources.filter((s) => s.selected).length

  const selectionLabel =
    totalSelected === 0
      ? '请先选择或生成源图'
      : `已选中 ${totalSelected} 张${sources.some((s) => s.sourceType === 'ai_gen' && s.selected) ? '（含 AI 方案）' : ''}，将进入整图区域切割`

  const handleUpload = async (file: File) => {
    const entityId = taskIdRef.current
    const err = validateFile(file)
    if (err) {
      message.error(err)
      return
    }
    setUploading(true)
    setUploadPercent(0)
    try {
      const row = await uploadWorkflowSourceApi(
        file,
        { context: 'matting', taskId: entityId },
        { onProgress: (p) => setUploadPercent(p) },
      )
      if (taskIdRef.current !== entityId) return
      await patchWorkflowSourceApi(row.id, { selected: true })
      if (taskIdRef.current !== entityId) return
      await loadSources()
      message.success('上传成功（工作流暂存，未入素材库）')
    } catch (e) {
      if (taskIdRef.current === entityId) {
        message.error(e instanceof Error ? e.message : '上传失败')
      }
    } finally {
      if (taskIdRef.current === entityId) {
        setUploading(false)
        setUploadPercent(0)
      }
    }
  }

  const toggleUpload = async (workflowSourceId: number) => {
    const row = sources.find((s) => s.id === workflowSourceId)
    if (!row) return
    try {
      await patchWorkflowSourceApi(workflowSourceId, { selected: !row.selected })
      await loadSources()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '更新失败')
    }
  }

  const toggleLibraryAsset = async (assetId: number) => {
    const entityId = taskIdRef.current
    const existing = libraryByAssetId.get(assetId)
    try {
      if (existing) {
        await patchWorkflowSourceApi(existing.id, { selected: !existing.selected })
      } else {
        const rows = await addWorkflowSourcesFromLibraryApi({
          context: 'matting',
          taskId: entityId,
          assetIds: [assetId],
        })
        if (rows[0]) await patchWorkflowSourceApi(rows[0].id, { selected: true })
      }
      await loadSources()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '更新失败')
    }
  }

  const handleAiGenerate = async (payload: SourceGeneratePayload) => {
    const entityId = taskIdRef.current
    setAiGenerating(true)
    try {
      await generateMattingSourceApi(entityId, {
        prompt: payload.prompt,
        count: payload.count,
        aspectRatio: payload.aspectRatio === '智能' ? undefined : payload.aspectRatio,
        referenceUrls: payload.referenceUrls,
      })
      if (taskIdRef.current !== entityId) return
      await loadSources()
      message.success('生成完成')
    } catch (e) {
      if (taskIdRef.current === entityId) {
        message.error(e instanceof Error ? e.message : '生图失败')
      }
    } finally {
      if (taskIdRef.current === entityId) {
        setAiGenerating(false)
      }
    }
  }

  const handleToggleScheme = async (schemeId: string, selected: boolean) => {
    try {
      await patchMattingSourceSchemesApi(taskIdRef.current, { schemeId, selected })
      await loadSources()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '更新失败')
    }
  }

  const handleDeleteScheme = async (schemeId: string) => {
    try {
      await deleteWorkflowSourceApi(Number(schemeId))
      await loadSources()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  const handleConfirm = async () => {
    if (totalSelected === 0) {
      message.warning('请至少选择一张源图')
      return
    }
    if (onBeforeConfirm && !(await onBeforeConfirm())) return

    setConfirming(true)
    try {
      const workflowSourceIds = sources.filter((s) => s.selected).map((s) => s.id)
      const updated = await confirmMattingSourceApi(taskIdRef.current, { workflowSourceIds })
      onConfirmed(updated)
      message.success(`已确认 ${totalSelected} 张源图`)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '确认失败')
    } finally {
      setConfirming(false)
    }
  }

  const confirmButton = (
    <Button
      type="primary"
      disabled={totalSelected === 0}
      loading={confirming}
      onClick={() => void handleConfirm()}
    >
      确认源图，进入框选 →
    </Button>
  )

  return (
    <>
      <OpsImageSourcePicker
        contextLabel="源图"
        selectionHint={selectionLabel}
        topMode={topMode}
        onTopModeChange={setTopMode}
        libraryTab={libraryTab}
        onLibraryTabChange={setLibraryTab}
        uploading={uploading}
        uploadPercent={uploadPercent}
        dragActive={dragActive}
        onDragActiveChange={setDragActive}
        onPickUploadFile={(file) => void handleUpload(file)}
        uploadItems={uploadItems}
        libraryAssets={libraryAssets ?? []}
        loadingLibrary={loadingLibrary}
        selectedUploadIds={selectedUploadIds}
        selectedLibraryAssetIds={selectedLibraryAssetIds}
        onToggleUpload={(id) => void toggleUpload(id)}
        onToggleLibraryAsset={(id) => void toggleLibraryAsset(id)}
        tags={tags}
        assetTagId={assetTagId}
        onAssetTagIdChange={setAssetTagId}
        assetKeywordInput={assetKeywordInput}
        onAssetKeywordInputChange={setAssetKeywordInput}
        schemes={aiSchemes}
        loadingSchemes={loadingSources}
        onToggleScheme={(id, selected) => void handleToggleScheme(id, selected)}
        onDeleteScheme={(id) => void handleDeleteScheme(id)}
        onPreviewScheme={(url, alt) => setPreview({ url, alt: alt ?? '预览' })}
        aiDock={
          <SourceGenerateComposer
            loading={aiGenerating}
            onSend={(p) => void handleAiGenerate(p)}
            confirmAction={confirmButton}
          />
        }
        panelFooter={confirmButton}
      />

      <ImageLightbox url={preview?.url ?? null} alt={preview?.alt} onClose={() => setPreview(null)} />
    </>
  )
}
