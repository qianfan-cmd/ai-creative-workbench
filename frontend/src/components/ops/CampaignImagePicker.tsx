import { message } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { importAssetFromUrlApi, listAssetsApi } from '@/api/assets'
import type { MattingSourceScheme } from '@/api/ops'
import { listTagsApi, type TagVO } from '@/api/tags'
import ImageLightbox from '@/components/common/ImageLightbox'
import OpsImageSourcePicker from '@/components/ops/OpsImageSourcePicker'
import SourceGenerateComposer, { type SourceGeneratePayload } from '@/components/ops/SourceGenerateComposer'
import useDebouncedValue from '@/hooks/useDebouncedValue'
import {
  addWorkflowSourcesFromLibraryApi,
  deleteWorkflowSourceApi,
  generateCampaignWorkflowAiApi,
  listWorkflowSourcesApi,
  patchWorkflowSourceApi,
  uploadSourcesToAssetLike,
  uploadWorkflowSourceApi,
  workflowSourceToScheme,
  workflowSourcesToPreviewUrls,
  type WorkflowSourceVO,
} from '@/api/workflowSource'

const MAX_IMAGES = 9
const ACCEPT_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const MAX_FILE_BYTES = 10 * 1024 * 1024

function validateFile(file: File): string | null {
  if (!ACCEPT_TYPES.includes(file.type)) return '仅支持 PNG / JPG / WebP'
  if (file.size > MAX_FILE_BYTES) return '文件不能超过 10MB'
  return null
}

export interface CampaignImageSelection {
  previewUrls: string[]
}

interface CampaignImagePickerProps {
  draftId: number | null
  aspectRatio?: string
  onSelectionChange: (selection: CampaignImageSelection) => void
}

export default function CampaignImagePicker({
  draftId,
  aspectRatio = '16:9',
  onSelectionChange,
}: CampaignImagePickerProps) {
  const [topMode, setTopMode] = useState<'upload' | 'library'>('upload')
  const [libraryTab, setLibraryTab] = useState<'existing' | 'ai'>('existing')
  const [sources, setSources] = useState<WorkflowSourceVO[]>([])
  const [libraryAssets, setLibraryAssets] = useState<Awaited<ReturnType<typeof listAssetsApi>>['records']>([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)
  const [loadingSources, setLoadingSources] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [tags, setTags] = useState<TagVO[]>([])
  const [assetTagId, setAssetTagId] = useState<number | undefined>()
  const [assetKeywordInput, setAssetKeywordInput] = useState('')
  const assetKeyword = useDebouncedValue(assetKeywordInput.trim(), 300)
  const [preview, setPreview] = useState<{ url: string; alt: string } | null>(null)

  const draftIdRef = useRef(draftId)
  useEffect(() => {
    draftIdRef.current = draftId
  }, [draftId])

  const onSelectionChangeRef = useRef(onSelectionChange)
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange
  }, [onSelectionChange])

  const loadSources = useCallback(async () => {
    const entityId = draftIdRef.current
    if (entityId == null) {
      setSources([])
      onSelectionChangeRef.current({ previewUrls: [] })
      return
    }
    setLoadingSources(true)
    try {
      const list = await listWorkflowSourcesApi({ context: 'campaign', draftId: entityId })
      if (draftIdRef.current !== entityId) return
      setSources(list)
      onSelectionChangeRef.current({
        previewUrls: workflowSourcesToPreviewUrls(list, MAX_IMAGES),
      })
    } catch (e) {
      if (draftIdRef.current === entityId) {
        message.error(e instanceof Error ? e.message : '加载配图失败')
      }
    } finally {
      if (draftIdRef.current === entityId) {
        setLoadingSources(false)
      }
    }
  }, [draftId])

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

  const selectedCount = sources.filter((s) => s.selected).length
  const selectionHint =
    selectedCount === 0
      ? '选择配图后将实时在预览 Tab 展示（最多 9 张）'
      : `已选 ${selectedCount}/${MAX_IMAGES} 张配图`

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

  const guardMaxSelected = (adding: boolean) => {
    if (adding && selectedCount >= MAX_IMAGES) {
      message.warning(`最多选择 ${MAX_IMAGES} 张配图`)
      return false
    }
    return true
  }

  const handleUpload = async (file: File) => {
    const entityId = draftIdRef.current
    if (entityId == null) {
      message.warning('请先保存左侧活动草稿')
      return
    }
    const err = validateFile(file)
    if (err) {
      message.error(err)
      return
    }
    if (!guardMaxSelected(true)) return

    setUploading(true)
    setUploadPercent(0)
    try {
      const row = await uploadWorkflowSourceApi(
        file,
        { context: 'campaign', draftId: entityId },
        { onProgress: (p) => setUploadPercent(p) },
      )
      if (draftIdRef.current !== entityId) return
      await patchWorkflowSourceApi(row.id, { selected: true })
      if (draftIdRef.current !== entityId) return
      await loadSources()
      message.success('上传成功（工作流暂存，未入素材库）')
    } catch (e) {
      if (draftIdRef.current === entityId) {
        message.error(e instanceof Error ? e.message : '上传失败')
      }
    } finally {
      if (draftIdRef.current === entityId) {
        setUploading(false)
        setUploadPercent(0)
      }
    }
  }

  const toggleUpload = async (workflowSourceId: number) => {
    const row = sources.find((s) => s.id === workflowSourceId)
    if (!row) return
    if (!row.selected && !guardMaxSelected(true)) return
    try {
      await patchWorkflowSourceApi(workflowSourceId, { selected: !row.selected })
      await loadSources()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '更新失败')
    }
  }

  const toggleLibraryAsset = async (assetId: number) => {
    const entityId = draftIdRef.current
    if (entityId == null) return
    const existing = libraryByAssetId.get(assetId)
    if (!existing?.selected && !guardMaxSelected(true)) return
    try {
      if (existing) {
        await patchWorkflowSourceApi(existing.id, { selected: !existing.selected })
      } else {
        const rows = await addWorkflowSourcesFromLibraryApi({
          context: 'campaign',
          draftId: entityId,
          assetIds: [assetId],
        })
        if (rows[0]) await patchWorkflowSourceApi(rows[0].id, { selected: true })
      }
      await loadSources()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '更新失败')
    }
  }

  const handleToggleScheme = async (schemeId: string, selected: boolean) => {
    if (selected && !guardMaxSelected(true)) return
    try {
      await patchWorkflowSourceApi(Number(schemeId), { selected })
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

  const handleAddToLibrary = async (scheme: MattingSourceScheme) => {
    try {
      await importAssetFromUrlApi(scheme.imageUrl, scheme.prompt?.trim() || '活动配图')
      message.success('已加入素材库')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '入库失败')
      throw e
    }
  }

  const handleAiGenerate = async (payload: SourceGeneratePayload) => {
    const entityId = draftIdRef.current
    if (entityId == null) {
      message.warning('请先保存左侧活动草稿')
      return
    }
    setAiGenerating(true)
    try {
      await generateCampaignWorkflowAiApi({
        draftId: entityId,
        prompt: payload.prompt,
        referenceUrls: payload.referenceUrls,
        count: payload.count,
        aspectRatio: payload.aspectRatio,
      })
      if (draftIdRef.current !== entityId) return
      await loadSources()
      message.success('生成完成')
    } catch (e) {
      if (draftIdRef.current === entityId) {
        message.error(e instanceof Error ? e.message : '生图失败')
      }
    } finally {
      if (draftIdRef.current === entityId) {
        setAiGenerating(false)
      }
    }
  }

  return (
    <>
      <OpsImageSourcePicker
        contextLabel="参考图"
        selectionHint={selectionHint}
        topMode={topMode}
        onTopModeChange={setTopMode}
        libraryTab={libraryTab}
        onLibraryTabChange={setLibraryTab}
        uploading={uploading}
        uploadPercent={uploadPercent}
        dragActive={dragActive}
        onDragActiveChange={setDragActive}
        onPickUploadFile={(f) => void handleUpload(f)}
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
        onAddSchemeToLibrary={(scheme) => handleAddToLibrary(scheme)}
        aiDock={
          <SourceGenerateComposer
            loading={aiGenerating}
            aspectRatio={aspectRatio}
            placeholder="描述要生成的活动配图，Enter 发送"
            onSend={(p) => void handleAiGenerate(p)}
          />
        }
      />
      <ImageLightbox url={preview?.url ?? null} alt={preview?.alt} onClose={() => setPreview(null)} />
    </>
  )
}
