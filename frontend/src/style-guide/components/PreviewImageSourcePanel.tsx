import { CloudUploadOutlined, SearchOutlined } from '@ant-design/icons'
import PreviewCandidateGallery from './PreviewCandidateGallery'
import styles from './PreviewImageSourcePanel.module.css'

export type ImageSourceMode = 'upload' | 'library-existing' | 'library-ai'

const LIBRARY_ASSETS = [
  { id: '1', name: 'mascot-matted.png', tag: 'matted', color: '#0D9488', selected: true },
  { id: '2', name: 'hero-ref.png', tag: 'reference', color: '#334155' },
  { id: '3', name: 'banner-src.png', tag: 'reference', checkerboard: true },
  { id: '4', name: 'icon-batch.png', tag: 'matted', color: '#71717A' },
]

const AI_CANDIDATES = [
  { id: '1', label: '候选 A', selected: true, previewColor: '#0D9488' },
  { id: '2', label: '候选 B', previewColor: '#18181B' },
  { id: '3', label: '候选 C', previewColor: '#71717A' },
  { id: '4', label: '候选 D', previewColor: '#E4E4E7' },
]

interface PreviewImageSourcePanelProps {
  contextLabel?: string
  mode?: ImageSourceMode
  selectedAssetName?: string
  compact?: boolean
  className?: string
}

export default function PreviewImageSourcePanel({
  contextLabel = '源图',
  mode = 'upload',
  selectedAssetName = 'hero-mascot.png',
  compact = false,
  className,
}: PreviewImageSourcePanelProps) {
  const isUpload = mode === 'upload'
  const isLibraryExisting = mode === 'library-existing'
  const isLibraryAi = mode === 'library-ai'

  return (
    <div className={`${styles.panel} ${compact ? styles.panel_compact : ''} ${className ?? ''}`}>
      <div className={styles.header}>
        <span className={styles.contextLabel}>{contextLabel}</span>
        <div className={styles.topSegment}>
          <span className={`${styles.segment} ${isUpload ? styles.segment_active : ''}`}>
            直接上传
          </span>
          <span className={`${styles.segment} ${!isUpload ? styles.segment_active : ''}`}>
            素材库
          </span>
        </div>
      </div>

      {isUpload && (
        <div className={styles.uploadSection}>
          <div className={styles.dropzone}>
            <CloudUploadOutlined className={styles.dropzoneIcon} />
            <span className={styles.dropzoneTitle}>拖拽或点击上传 PNG / JPG</span>
            <span className={styles.dropzoneHint}>单文件 ≤ 10MB</span>
          </div>
          {selectedAssetName && (
            <div className={styles.selectedRow}>
              <div className={styles.selectedThumb}>
                <div className={styles.checkerboard} />
              </div>
              <div className={styles.selectedMeta}>
                <span className={styles.selectedName}>{selectedAssetName}</span>
                <span className={styles.selectedHint}>已选 · 直接上传</span>
              </div>
            </div>
          )}
        </div>
      )}

      {!isUpload && (
        <div className={styles.librarySection}>
          <div className={styles.subSegment}>
            <span className={`${styles.subSegmentItem} ${isLibraryExisting ? styles.subSegmentItem_active : ''}`}>
              已有素材
            </span>
            <span className={`${styles.subSegmentItem} ${isLibraryAi ? styles.subSegmentItem_active : ''}`}>
              AI 生图入库
            </span>
          </div>

          {isLibraryExisting && (
            <>
              <div className={styles.searchMock}>
                <SearchOutlined />
                搜索素材库…
              </div>
              <div className={styles.miniGrid}>
                {LIBRARY_ASSETS.map((asset) => (
                  <div
                    key={asset.id}
                    className={`${styles.miniCard} ${asset.selected ? styles.miniCard_selected : ''}`}
                  >
                    <div className={styles.miniThumb}>
                      {asset.checkerboard ? (
                        <div className={styles.checkerboard} />
                      ) : (
                        <div className={styles.previewFill} style={{ backgroundColor: asset.color }} />
                      )}
                      <span className={styles.assetTag}>{asset.tag}</span>
                    </div>
                    <span className={styles.miniName}>{asset.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {isLibraryAi && (
            <>
              <div className={styles.aiForm}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Prompt / 风格</label>
                  <div className={styles.inputMock}>夏日活动宣传图，清新明亮，含品牌吉祥物</div>
                </div>
                <button type="button" className={styles.generateBtn}>生成 4 张</button>
              </div>
              <PreviewCandidateGallery items={AI_CANDIDATES} />
              <button type="button" className={styles.tagBtn}>打标入库</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
