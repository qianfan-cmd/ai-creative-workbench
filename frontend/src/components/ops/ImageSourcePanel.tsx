import { CloudUploadOutlined } from '@ant-design/icons'
import { Button, Input, Progress, message, Spin } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { listAssetsApi, uploadAssetApi } from '@/api/assets'
import { generateOpsImageApi } from '@/api/ops'
import CandidateGallery from '@/components/ops/CandidateGallery'
import TagAssetDialog from '@/components/ops/TagAssetDialog'
import type { AssetVO } from '@/types/api'
import type { ImageCandidateVO } from '@/api/ops'
import styles from '@/components/ops/ImageSourcePanel.module.css'

export type ImageSourceMode = 'upload' | 'library-existing' | 'library-ai'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const ACCEPT_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

interface ImageSourcePanelProps {
  contextLabel?: string
  mode?: ImageSourceMode
  selectedAssetId?: number | null
  selectedAssetUrl?: string | null
  onSelectAsset?: (asset: AssetVO) => void
  compact?: boolean
}

function validateFile(file: File): string | null {
  if (!ACCEPT_TYPES.includes(file.type)) {
    return '仅支持 PNG / JPG / WebP'
  }
  if (file.size > MAX_FILE_BYTES) {
    return '文件不能超过 10MB'
  }
  return null
}

export default function ImageSourcePanel({
  contextLabel = '源图',
  mode: initialMode = 'upload',
  selectedAssetId,
  selectedAssetUrl,
  onSelectAsset,
  compact = false,
}: ImageSourcePanelProps) {
  const [mode, setMode] = useState<ImageSourceMode>(initialMode)
  const [libraryTab, setLibraryTab] = useState<'existing' | 'ai'>('existing')
  const [assets, setAssets] = useState<AssetVO[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiCandidates, setAiCandidates] = useState<ImageCandidateVO[]>([])
  const [aiSelectedIndex, setAiSelectedIndex] = useState<number | null>(null)
  const [tagDialogOpen, setTagDialogOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadAssets = useCallback(async () => {
    setLoading(true)
    try {
      const page = await listAssetsApi({ page: 1, size: 24 })
      setAssets(page.records ?? [])
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载素材失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mode === 'library-existing' && libraryTab === 'existing') void loadAssets()
  }, [mode, libraryTab, loadAssets])

  const handleUpload = async (file: File) => {
    const err = validateFile(file)
    if (err) {
      message.error(err)
      return
    }
    setUploading(true)
    setUploadPercent(0)
    try {
      const uploaded = await uploadAssetApi(file, {
        onProgress: (p) => setUploadPercent(p),
      })
      onSelectAsset?.({
        id: uploaded.id,
        name: uploaded.name,
        url: uploaded.url,
        path: uploaded.path,
        size: uploaded.size,
        type: uploaded.type,
        createdAt: '',
        tags: [],
      })
      message.success('上传成功')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '上传失败')
    } finally {
      setUploading(false)
      setUploadPercent(0)
    }
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (uploading) return
    const file = e.dataTransfer.files?.[0]
    if (file) void handleUpload(file)
  }

  const handleAiGenerate = async () => {
    const prompt = aiPrompt.trim()
    if (!prompt) {
      message.warning('请输入生图描述')
      return
    }
    setAiGenerating(true)
    try {
      const job = await generateOpsImageApi({ prompt, count: 4 })
      setAiCandidates(job.candidates)
      setAiSelectedIndex(job.candidates[0]?.index ?? null)
      message.success(`生成完成（${job.providerUsed}）`)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '生图失败')
    } finally {
      setAiGenerating(false)
    }
  }

  const aiSelectedUrl = aiCandidates.find((c) => c.index === aiSelectedIndex)?.url ?? null

  return (
    <div className={[styles.panel, compact ? styles.panelCompact : ''].filter(Boolean).join(' ')}>
      <div className={styles.header}>
        <span className={styles.contextLabel}>{contextLabel}</span>
        <div className={styles.topSegment}>
          <button
            type="button"
            className={[styles.segment, mode === 'upload' ? styles.segmentActive : ''].join(' ')}
            onClick={() => setMode('upload')}
          >
            直接上传
          </button>
          <button
            type="button"
            className={[styles.segment, mode !== 'upload' ? styles.segmentActive : ''].join(' ')}
            onClick={() => setMode('library-existing')}
          >
            素材库
          </button>
        </div>
      </div>

      {mode === 'upload' && (
        <div className={styles.uploadSection}>
          <button
            type="button"
            className={[
              styles.dropzone,
              dragActive ? styles.dropzoneActive : '',
              uploading ? styles.dropzoneBusy : '',
            ].join(' ')}
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {uploading ? (
              <Spin size="large" />
            ) : (
              <CloudUploadOutlined className={styles.dropzoneIcon} />
            )}
            <span className={styles.dropzoneTitle}>
              {uploading ? '上传中…' : '拖拽或点击上传 PNG / JPG'}
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
          {selectedAssetUrl && (
            <div className={styles.selectedRow}>
              <img src={selectedAssetUrl} alt="已选" className={styles.selectedThumb} />
              <span className={styles.selectedName}>已选源图</span>
            </div>
          )}
        </div>
      )}

      {mode === 'library-existing' && (
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
              AI 生图入库
            </button>
          </div>

          {libraryTab === 'existing' && (
            <Spin spinning={loading}>
              <div className={styles.assetGrid}>
                {assets.length === 0 && !loading && (
                  <p className={styles.emptyHint}>暂无素材，请先上传或使用 AI 生图</p>
                )}
                {assets.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={[
                      styles.assetCell,
                      selectedAssetId === a.id ? styles.assetCellActive : '',
                    ].join(' ')}
                    onClick={() => onSelectAsset?.(a)}
                  >
                    <img src={a.url} alt={a.name} className={styles.assetThumb} />
                    <span className={styles.assetName}>{a.name}</span>
                  </button>
                ))}
              </div>
            </Spin>
          )}

          {libraryTab === 'ai' && (
            <div className={styles.aiSection}>
              <Input.TextArea
                rows={3}
                placeholder="描述要生成的素材，例如：夏日清新风格活动 Banner"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
              />
              <Button type="primary" loading={aiGenerating} onClick={() => void handleAiGenerate()}>
                生成 4 张候选
              </Button>
              {aiCandidates.length > 0 && (
                <>
                  <CandidateGallery
                    candidates={aiCandidates}
                    selectedIndex={aiSelectedIndex}
                    onSelect={setAiSelectedIndex}
                  />
                  <Button
                    disabled={aiSelectedIndex == null}
                    onClick={() => setTagDialogOpen(true)}
                  >
                    打标入库并选为源图
                  </Button>
                </>
              )}
            </div>
          )}
        </>
      )}

      <TagAssetDialog
        open={tagDialogOpen}
        imageUrl={aiSelectedUrl}
        defaultName="matting-source.png"
        defaultTags={['generated', 'reference']}
        onClose={() => setTagDialogOpen(false)}
        onSaved={(assetId) => {
          const url = aiSelectedUrl
          if (url) {
            onSelectAsset?.({
              id: assetId,
              name: 'matting-source.png',
              url,
              path: '',
              size: 0,
              type: 'image/png',
              createdAt: '',
              tags: [],
            })
          }
          setTagDialogOpen(false)
          message.success('已选为源图')
        }}
      />
    </div>
  )
}
