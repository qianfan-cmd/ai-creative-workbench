import { CloudUploadOutlined } from '@ant-design/icons'

import { Button, Image, Progress, Spin, message } from 'antd'

import { useCallback, useEffect, useRef, useState } from 'react'

import { listAssetsApi, uploadAssetApi } from '@/api/assets'

import type { MattingSourceScheme, MattingTaskVO } from '@/api/ops'

import {

  confirmMattingSourceApi,

  generateMattingSourceApi,

  getMattingSourceSchemesApi,

  patchMattingSourceSchemesApi,

} from '@/api/ops'

import SourceGenerateComposer from '@/components/ops/SourceGenerateComposer'

import SourceSchemeGrid from '@/components/ops/SourceSchemeGrid'

import type { AssetVO } from '@/types/api'

import styles from '@/components/ops/MattingStage1Source.module.css'



type TopMode = 'upload' | 'library'

type LibraryTab = 'existing' | 'ai'



const MAX_FILE_BYTES = 10 * 1024 * 1024

const ACCEPT_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']



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



function parseSchemesFromConfig(configJson?: string | null): MattingSourceScheme[] {

  if (!configJson) return []

  try {

    const cfg = JSON.parse(configJson) as { sourceSchemes?: MattingSourceScheme[] }

    return cfg.sourceSchemes ?? []

  } catch {

    return []

  }

}



export default function MattingStage1Source({

  taskId,

  configJson,

  onConfirmed,

  onBeforeConfirm,

}: MattingStage1SourceProps) {

  const [topMode, setTopMode] = useState<TopMode>('upload')

  const [libraryTab, setLibraryTab] = useState<LibraryTab>('existing')

  const [assets, setAssets] = useState<AssetVO[]>([])

  const [loadingAssets, setLoadingAssets] = useState(false)

  const [uploading, setUploading] = useState(false)

  const [uploadPercent, setUploadPercent] = useState(0)

  const [dragActive, setDragActive] = useState(false)

  const [uploadedAssets, setUploadedAssets] = useState<AssetVO[]>([])

  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<number>>(new Set())

  const [schemes, setSchemes] = useState<MattingSourceScheme[]>(() => parseSchemesFromConfig(configJson))

  const [aiGenerating, setAiGenerating] = useState(false)

  const [confirming, setConfirming] = useState(false)

  const [preview, setPreview] = useState<{ url: string; alt: string } | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)



  const loadSchemes = useCallback(async () => {

    try {

      const data = await getMattingSourceSchemesApi(taskId)

      setSchemes(data.schemes ?? [])

    } catch {

      setSchemes(parseSchemesFromConfig(configJson))

    }

  }, [taskId, configJson])



  useEffect(() => {

    void loadSchemes()

  }, [loadSchemes, taskId])



  const loadAssets = useCallback(async () => {

    setLoadingAssets(true)

    try {

      const page = await listAssetsApi({ page: 1, size: 24 })

      setAssets(page.records ?? [])

    } catch (e) {

      message.error(e instanceof Error ? e.message : '加载素材失败')

    } finally {

      setLoadingAssets(false)

    }

  }, [])



  useEffect(() => {

    if (topMode === 'library' && libraryTab === 'existing') void loadAssets()

  }, [topMode, libraryTab, loadAssets])



  const toggleAssetSelection = (assetId: number) => {

    setSelectedAssetIds((prev) => {

      const next = new Set(prev)

      if (next.has(assetId)) next.delete(assetId)

      else next.add(assetId)

      return next

    })

  }



  const handleUpload = async (file: File) => {

    const err = validateFile(file)

    if (err) {

      message.error(err)

      return

    }

    setUploading(true)

    setUploadPercent(0)

    try {

      const uploaded = await uploadAssetApi(file, { onProgress: (p) => setUploadPercent(p) })

      const asset: AssetVO = {

        id: uploaded.id,

        name: uploaded.name,

        url: uploaded.url,

        path: uploaded.path,

        size: uploaded.size,

        type: uploaded.type,

        createdAt: '',

        tags: [],

      }

      setUploadedAssets((prev) => {

        if (prev.some((a) => a.id === asset.id)) return prev

        return [...prev, asset]

      })

      setSelectedAssetIds((prev) => new Set(prev).add(asset.id))

      message.success('上传成功，可继续上传或勾选后确认')

    } catch (e) {

      message.error(e instanceof Error ? e.message : '上传失败')

    } finally {

      setUploading(false)

      setUploadPercent(0)

    }

  }



  const handleAiGenerate = async (payload: { prompt: string; count: number; aspectRatio: string }) => {

    setAiGenerating(true)

    try {

      const data = await generateMattingSourceApi(taskId, {

        prompt: payload.prompt,

        count: payload.count,

        aspectRatio: payload.aspectRatio === '智能' ? undefined : payload.aspectRatio,

      })

      setSchemes(data.schemes ?? [])

      message.success('生成完成')

    } catch (e) {

      message.error(e instanceof Error ? e.message : '生图失败')

    } finally {

      setAiGenerating(false)

    }

  }



  const handleToggleScheme = async (schemeId: string, selected: boolean) => {

    try {

      const data = await patchMattingSourceSchemesApi(taskId, { schemeId, selected })

      setSchemes(data.schemes ?? [])

    } catch (e) {

      message.error(e instanceof Error ? e.message : '更新失败')

    }

  }



  const handleDeleteScheme = async (schemeId: string) => {

    try {

      const data = await patchMattingSourceSchemesApi(taskId, { deleteIds: [schemeId] })

      setSchemes(data.schemes ?? [])

    } catch (e) {

      message.error(e instanceof Error ? e.message : '删除失败')

    }

  }



  const selectedSchemes = schemes.filter((s) => s.selected)

  const selectedAssetCount = [...selectedAssetIds].filter(

    (id) => uploadedAssets.some((a) => a.id === id) || assets.some((a) => a.id === id),

  ).length

  const totalSelected = selectedSchemes.length + selectedAssetCount



  const selectionLabel =

    totalSelected === 0

      ? '请先选择或生成源图'

      : `已选中 ${totalSelected} 张${selectedSchemes.length > 0 ? '（含 AI 方案）' : ''}，将进入整图区域切割`



  const handleConfirm = async () => {

    if (totalSelected === 0) {

      message.warning('请至少选择一张源图')

      return

    }

    if (onBeforeConfirm && !(await onBeforeConfirm())) return

    setConfirming(true)

    try {

      const schemeIds = selectedSchemes.map((s) => s.id)

      const assetIdSet = new Set<number>()

      for (const id of selectedAssetIds) {

        if (uploadedAssets.some((a) => a.id === id) || assets.some((a) => a.id === id)) {

          assetIdSet.add(id)

        }

      }

      const sourceAssetIds = [...assetIdSet]



      const updated = await confirmMattingSourceApi(taskId, { schemeIds, sourceAssetIds })

      onConfirmed(updated)

      message.success(`已确认 ${totalSelected} 张源图`)

    } catch (e) {

      message.error(e instanceof Error ? e.message : '确认失败')

    } finally {

      setConfirming(false)

    }

  }



  const renderAssetGrid = (items: AssetVO[], emptyHint: string) => (

    <div className={styles.assetGrid}>

      {items.length === 0 && <p className={styles.emptyHint}>{emptyHint}</p>}

      {items.map((a) => (

        <label

          key={a.id}

          className={[

            styles.assetCell,

            selectedAssetIds.has(a.id) ? styles.assetCellActive : '',

          ].join(' ')}

        >

          <input

            type="checkbox"

            className={styles.assetCheckbox}

            checked={selectedAssetIds.has(a.id)}

            onChange={() => toggleAssetSelection(a.id)}

          />

          <img src={a.url} alt={a.name} className={styles.assetThumb} />

          <span className={styles.assetName}>{a.name}</span>

        </label>

      ))}

    </div>

  )



  return (

    <div className={styles.stage1}>

      <div className={styles.panel}>

        <div className={styles.header}>

          <span className={styles.contextLabel}>源图</span>

          <div className={styles.topSegment}>

            <button

              type="button"

              className={[styles.segment, topMode === 'upload' ? styles.segmentActive : ''].join(' ')}

              onClick={() => setTopMode('upload')}

            >

              直接上传

            </button>

            <button

              type="button"

              className={[styles.segment, topMode === 'library' ? styles.segmentActive : ''].join(' ')}

              onClick={() => setTopMode('library')}

            >

              素材库

            </button>

          </div>

        </div>



        <div className={styles.actionBar}>

          <p className={styles.selectionHint}>{selectionLabel}</p>

          <Button type="primary" disabled={totalSelected === 0} loading={confirming} onClick={() => void handleConfirm()}>

            确认源图，进入框选 →

          </Button>

        </div>



        {topMode === 'upload' && (

          <div className={styles.scrollArea}>

            <button

              type="button"

              className={[

                styles.dropzone,

                dragActive ? styles.dropzoneActive : '',

                uploading ? styles.dropzoneBusy : '',

              ].join(' ')}

              disabled={uploading}

              onClick={() => fileRef.current?.click()}

              onDragOver={(e) => {

                e.preventDefault()

                setDragActive(true)

              }}

              onDragLeave={() => setDragActive(false)}

              onDrop={(e) => {

                e.preventDefault()

                setDragActive(false)

                if (uploading) return

                const file = e.dataTransfer.files?.[0]

                if (file) void handleUpload(file)

              }}

            >

              {uploading ? <Spin size="large" /> : <CloudUploadOutlined className={styles.dropzoneIcon} />}

              <span className={styles.dropzoneTitle}>

                {uploading ? '上传中…' : '拖拽或点击上传 PNG / JPG（可多次上传）'}

              </span>

              <span className={styles.dropzoneHint}>单文件 ≤ 10MB</span>

              {uploading && uploadPercent > 0 && (

                <Progress percent={uploadPercent} size="small" className={styles.uploadProgress} />

              )}

            </button>

            <input

              ref={fileRef}

              type="file"

              accept="image/png,image/jpeg,image/jpg,image/webp"

              className={styles.hiddenInput}

              onChange={(e) => {

                const f = e.target.files?.[0]

                if (f) void handleUpload(f)

                e.target.value = ''

              }}

            />

            {uploadedAssets.length > 0 && renderAssetGrid(uploadedAssets, '')}

          </div>

        )}



        {topMode === 'library' && (

          <>

            <div className={styles.librarySubSegment}>

              <button

                type="button"

                className={[styles.subSegment, libraryTab === 'existing' ? styles.subSegmentActive : ''].join(' ')}

                onClick={() => setLibraryTab('existing')}

              >

                已有素材

              </button>

              <button

                type="button"

                className={[styles.subSegment, libraryTab === 'ai' ? styles.subSegmentActive : ''].join(' ')}

                onClick={() => setLibraryTab('ai')}

              >

                AI 生图

              </button>

            </div>



            {libraryTab === 'existing' && (

              <div className={styles.scrollArea}>

                <Spin spinning={loadingAssets}>{renderAssetGrid(assets, '暂无素材，请先上传或使用 AI 生图')}</Spin>

              </div>

            )}



            {libraryTab === 'ai' && (

              <div className={styles.aiLayout}>

                <div className={styles.scrollArea}>

                  <SourceSchemeGrid

                    schemes={schemes}

                    onToggleSelect={(id, selected) => void handleToggleScheme(id, selected)}

                    onDelete={(id) => void handleDeleteScheme(id)}

                    onPreview={(url, alt) => setPreview({ url, alt: alt ?? '预览' })}

                  />

                </div>

                <div className={styles.dock}>

                  <SourceGenerateComposer loading={aiGenerating} onSend={(p) => void handleAiGenerate(p)} />

                </div>

              </div>

            )}

          </>

        )}

      </div>



      {preview && (

        <Image

          style={{ display: 'none' }}

          preview={{

            visible: true,

            src: preview.url,

            onVisibleChange: (v) => {

              if (!v) setPreview(null)

            },

          }}

        />

      )}

    </div>

  )

}

