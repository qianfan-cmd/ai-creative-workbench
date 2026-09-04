import { CloudUploadOutlined, SearchOutlined } from '@ant-design/icons'
import { Input, Progress, Select, Spin } from 'antd'
import type { ReactNode } from 'react'
import TagOptionLabel from '@/components/assets/TagOptionLabel'
import SourceSchemeGrid from '@/components/ops/SourceSchemeGrid'
import type { MattingSourceScheme } from '@/api/ops'
import type { TagVO } from '@/api/tags'
import type { AssetVO } from '@/types/api'
import { normalizeMediaUrl } from '@/utils/mediaUrl'
import styles from '@/components/ops/OpsImageSourcePicker.module.css'

export type OpsImageTopMode = 'upload' | 'library'
export type OpsImageLibraryTab = 'existing' | 'ai'

export interface OpsImageSourcePickerProps {
  contextLabel?: string
  selectionHint?: string
  topMode: OpsImageTopMode
  onTopModeChange: (mode: OpsImageTopMode) => void
  libraryTab: OpsImageLibraryTab
  onLibraryTabChange: (tab: OpsImageLibraryTab) => void
  uploading?: boolean
  uploadPercent?: number
  dragActive?: boolean
  onDragActiveChange?: (active: boolean) => void
  onPickUploadFile: (file: File) => void
  /** 直接上传区：source_type=upload 的暂存图 */
  uploadItems: AssetVO[]
  /** 素材库浏览列表 */
  libraryAssets: AssetVO[]
  loadingLibrary?: boolean
  /** upload 区选中 workflow source id */
  selectedUploadIds: Set<number>
  /** 素材库 asset id 是否已选（对应 library workflow source） */
  selectedLibraryAssetIds: Set<number>
  onToggleUpload: (workflowSourceId: number) => void
  onToggleLibraryAsset: (assetId: number) => void
  tags?: TagVO[]
  assetTagId?: number
  onAssetTagIdChange?: (id: number | undefined) => void
  assetKeywordInput?: string
  onAssetKeywordInputChange?: (value: string) => void
  schemes?: MattingSourceScheme[]
  loadingSchemes?: boolean
  onToggleScheme?: (schemeId: string, selected: boolean) => void
  onDeleteScheme?: (schemeId: string) => void
  onPreviewScheme?: (url: string, alt?: string) => void
  onAddSchemeToLibrary?: (scheme: MattingSourceScheme) => void | Promise<void>
  aiDock?: ReactNode
  panelFooter?: ReactNode
  uploadEmptyHint?: string
  libraryEmptyHint?: string
}

export default function OpsImageSourcePicker({
  contextLabel = '源图',
  selectionHint,
  topMode,
  onTopModeChange,
  libraryTab,
  onLibraryTabChange,
  uploading = false,
  uploadPercent = 0,
  dragActive = false,
  onDragActiveChange,
  onPickUploadFile,
  uploadItems,
  libraryAssets,
  loadingLibrary = false,
  selectedUploadIds,
  selectedLibraryAssetIds,
  onToggleUpload,
  onToggleLibraryAsset,
  tags = [],
  assetTagId,
  onAssetTagIdChange,
  assetKeywordInput = '',
  onAssetKeywordInputChange,
  schemes = [],
  loadingSchemes = false,
  onToggleScheme,
  onDeleteScheme,
  onPreviewScheme,
  onAddSchemeToLibrary,
  aiDock,
  panelFooter,
  uploadEmptyHint,
  libraryEmptyHint,
}: OpsImageSourcePickerProps) {
  const renderUploadGrid = (items: AssetVO[], emptyHint: string) => (
    <div className={styles.assetGrid}>
      {items.length === 0 && <p className={styles.emptyHint}>{emptyHint}</p>}
      {items.map((a) => (
        <label
          key={a.id}
          className={[styles.assetCell, selectedUploadIds.has(a.id) ? styles.assetCellActive : ''].join(' ')}
        >
          <input
            type="checkbox"
            className={styles.assetCheckbox}
            checked={selectedUploadIds.has(a.id)}
            onChange={() => onToggleUpload(a.id)}
          />
          <img src={normalizeMediaUrl(a.url)} alt={a.name} className={styles.assetThumb} />
          <span className={styles.assetName}>{a.name}</span>
        </label>
      ))}
    </div>
  )

  const renderLibraryGrid = (items: AssetVO[], emptyHint: string) => (
    <div className={styles.assetGrid}>
      {items.length === 0 && <p className={styles.emptyHint}>{emptyHint}</p>}
      {items.map((a) => (
        <label
          key={a.id}
          className={[
            styles.assetCell,
            selectedLibraryAssetIds.has(a.id) ? styles.assetCellActive : '',
          ].join(' ')}
        >
          <input
            type="checkbox"
            className={styles.assetCheckbox}
            checked={selectedLibraryAssetIds.has(a.id)}
            onChange={() => onToggleLibraryAsset(a.id)}
          />
          <img src={normalizeMediaUrl(a.url)} alt={a.name} className={styles.assetThumb} />
          <span className={styles.assetName}>{a.name}</span>
        </label>
      ))}
    </div>
  )

  const showPanelFooter =
    panelFooter && (topMode === 'upload' || (topMode === 'library' && libraryTab === 'existing'))

  return (
    <div className={styles.stage1}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.contextLabel}>{contextLabel}</span>
            {selectionHint ? <p className={styles.selectionHint}>{selectionHint}</p> : null}
          </div>
          <div className={styles.topSegment}>
            <button
              type="button"
              className={[styles.segment, topMode === 'upload' ? styles.segmentActive : ''].join(' ')}
              onClick={() => onTopModeChange('upload')}
            >
              直接上传
            </button>
            <button
              type="button"
              className={[styles.segment, topMode === 'library' ? styles.segmentActive : ''].join(' ')}
              onClick={() => onTopModeChange('library')}
            >
              素材库
            </button>
          </div>
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
              onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = 'image/png,image/jpeg,image/jpg,image/webp'
                input.onchange = () => {
                  const f = input.files?.[0]
                  if (f) onPickUploadFile(f)
                }
                input.click()
              }}
              onDragOver={(e) => {
                e.preventDefault()
                onDragActiveChange?.(true)
              }}
              onDragLeave={() => onDragActiveChange?.(false)}
              onDrop={(e) => {
                e.preventDefault()
                onDragActiveChange?.(false)
                if (uploading) return
                const file = e.dataTransfer.files?.[0]
                if (file) onPickUploadFile(file)
              }}
            >
              {uploading ? <Spin size="large" /> : <CloudUploadOutlined className={styles.dropzoneIcon} />}
              <span className={styles.dropzoneTitle}>
                {uploading ? '上传中…' : '拖拽或点击上传 PNG / JPG（可多次上传）'}
              </span>
              <span className={styles.dropzoneHint}>单文件 ≤ 10MB · 暂存工作流，不入素材库</span>
              {uploading && uploadPercent > 0 && (
                <Progress percent={uploadPercent} size="small" className={styles.uploadProgress} />
              )}
            </button>
            {uploadItems.length > 0 ? renderUploadGrid(uploadItems, uploadEmptyHint ?? '') : null}
          </div>
        )}

        {topMode === 'library' && (
          <>
            <div className={styles.librarySubSegment}>
              <button
                type="button"
                className={[styles.subSegment, libraryTab === 'existing' ? styles.subSegmentActive : ''].join(' ')}
                onClick={() => onLibraryTabChange('existing')}
              >
                已有素材
              </button>
              <button
                type="button"
                className={[styles.subSegment, libraryTab === 'ai' ? styles.subSegmentActive : ''].join(' ') }
                onClick={() => onLibraryTabChange('ai')}
              >
                AI 生图
              </button>
            </div>

            {libraryTab === 'existing' && (
              <div className={styles.scrollArea}>
                <div className={styles.assetFilters}>
                  <Input
                    className={styles.assetSearch}
                    placeholder="搜索素材"
                    prefix={<SearchOutlined />}
                    allowClear
                    value={assetKeywordInput}
                    onChange={(e) => onAssetKeywordInputChange?.(e.target.value)}
                  />
                  <Select
                    className={styles.assetTagSelect}
                    placeholder="按标签筛选"
                    allowClear
                    value={assetTagId}
                    onChange={(v) => onAssetTagIdChange?.(v)}
                    options={tags.map((t) => ({
                      value: t.id,
                      label: <TagOptionLabel tag={t} />,
                    }))}
                  />
                </div>
                <Spin spinning={loadingLibrary}>
                  {renderLibraryGrid(
                    libraryAssets,
                    libraryEmptyHint ??
                      (assetTagId ? '该标签下暂无素材' : '暂无素材，请先上传或使用 AI 生图'),
                  )}
                </Spin>
              </div>
            )}

            {libraryTab === 'ai' && (
              <div className={styles.aiLayout}>
                <div className={styles.scrollArea}>
                  <Spin spinning={loadingSchemes}>
                    <SourceSchemeGrid
                      schemes={schemes}
                      onToggleSelect={(id, selected) => onToggleScheme?.(id, selected)}
                      onDelete={(id) => onDeleteScheme?.(id)}
                      onPreview={(url, alt) => onPreviewScheme?.(url, alt)}
                      onAddToLibrary={onAddSchemeToLibrary}
                    />
                  </Spin>
                </div>
                {aiDock ? <div className={styles.dock}>{aiDock}</div> : null}
              </div>
            )}
          </>
        )}

        {showPanelFooter ? <div className={styles.panelFooter}>{panelFooter}</div> : null}
      </div>
    </div>
  )
}
