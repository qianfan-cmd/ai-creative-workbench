import { CheckOutlined, ExpandOutlined, LoadingOutlined, PlusOutlined } from '@ant-design/icons'
import { useState } from 'react'
import type { MattingExtractStatusVO } from '@/api/ops'
import ImageLightbox from '@/components/common/ImageLightbox'
import styles from '@/components/ops/ElementCandidateGallery.module.css'

const MAX_CANDIDATES_PER_ELEMENT = 8

interface ElementCandidateGalleryProps {
  status: MattingExtractStatusVO | null
  loading?: boolean
  onSelectSlot: (elementId: string, slotIndex: number) => void
  onRetryElement?: (elementId: string) => void
}

export default function ElementCandidateGallery({
  status,
  loading,
  onSelectSlot,
  onRetryElement,
}: ElementCandidateGalleryProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewAlt, setPreviewAlt] = useState('')
  if (loading && !status?.elements?.length) {
    return (
      <div className={styles.shell}>
        <div className={styles.loadingSlot}>
          <LoadingOutlined spin />
          <span>正在提取元素候选…</span>
        </div>
      </div>
    )
  }

  if (!status || status.elements.length === 0) {
    return <div className={styles.empty}>暂无提取结果，请先在元素步骤确认清单。</div>
  }

  const isRunning = status.extractStatus === 'running'
  const doneCount = status.elements.filter(
    (el) => el.status === 'done' || el.status === 'partial_failed' || el.status === 'failed',
  ).length
  const allDone = !isRunning && doneCount === status.elements.length
  const isExtractBusy =
    isRunning ||
    status.elements.some((el) => el.images.some((img) => img.status === 'pending'))

  const showRegionDivider = status.elements.map((el, index) => {
    const regionKey = el.groupName ?? ''
    if (!regionKey) return false
    const prevKey = index > 0 ? (status.elements[index - 1].groupName ?? '') : ''
    return regionKey !== prevKey
  })

  return (
    <div className={styles.shell}>
      <div className={styles.progRow}>
        <span className={styles.progSource}>
          共 {status.elements.length} 个元素 · 已完成 {doneCount}/{status.elements.length}
        </span>
        {allDone && (
          <span className={styles.badgeDone}>
            <CheckOutlined />
            提取完成
          </span>
        )}
      </div>

      {status.extractError && <div className={styles.errorBox}>{status.extractError}</div>}

      <div className={styles.scroll}>
        {status.elements.map((el, index) => {
          const regionKey = el.groupName ?? ''
          const showDivider = showRegionDivider[index]

          const hasDoneImages = el.images.some((img) => img.status === 'done' && img.url)
          const hasPendingSlot = el.images.some((img) => img.status === 'pending')
          const showRegen =
            hasDoneImages &&
            el.images.length < MAX_CANDIDATES_PER_ELEMENT &&
            !(isRunning && !hasDoneImages)
          const regenDisabled = isExtractBusy || hasPendingSlot

          return (
            <div key={el.elementId}>
              {showDivider && <div className={styles.regionDivider}>{regionKey}</div>}
              <div className={styles.elemCard}>
                <div className={styles.elemName}>{el.elementName}</div>
                <div className={styles.thumbRow}>
                  {el.images.map((img) => {
                    if (img.status === 'pending') {
                      return (
                        <div
                          key={`${el.elementId}-${img.slotIndex}`}
                          className={styles.loadingSlot}
                        >
                          <LoadingOutlined spin />
                          <span>提取中…</span>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={`${el.elementId}-${img.slotIndex}`}
                        className={[
                          styles.thumb,
                          img.selected ? styles.thumb_selected : '',
                          img.status === 'failed' ? styles.thumb_failed : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {img.url && img.status === 'done' ? (
                          <>
                            <button
                              type="button"
                              className={styles.thumbDetail}
                              aria-label="预览大图"
                              onClick={(e) => {
                                e.stopPropagation()
                                setPreviewUrl(img.url!)
                                setPreviewAlt(el.elementName)
                              }}
                            >
                              <ExpandOutlined />
                            </button>
                            <img src={img.url} alt="" className={styles.thumbImg} />
                          </>
                        ) : (
                          <div className={styles.checkerboard} title="生成失败" />
                        )}
                        {img.selected && img.status === 'done' && (
                          <span className={styles.thumbCheck}>
                            <CheckOutlined />
                          </span>
                        )}
                        <button
                          type="button"
                          className={styles.thumbHit}
                          disabled={img.status !== 'done' || !img.url}
                          onClick={() => img.url && onSelectSlot(el.elementId, img.slotIndex!)}
                          aria-label={`选择候选 ${(img.slotIndex ?? 0) + 1}`}
                        />
                      </div>
                    )
                  })}
                  {showRegen && (
                    <button
                      type="button"
                      className={styles.regenSlot}
                      disabled={regenDisabled}
                      onClick={() => onRetryElement?.(el.elementId)}
                    >
                      <PlusOutlined />
                      再生成
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <ImageLightbox
        url={previewUrl}
        alt={previewAlt}
        onClose={() => setPreviewUrl(null)}
      />
    </div>
  )
}
