import { Modal } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import {
  CROP_HANDLES,
  useMattingCropRegions,
  type CropHandle,
} from '@/hooks/useMattingCropRegions'
import type { CropRectPct } from '@/utils/cropImage'
import { buildNaturalAspectFrameStyle, shouldSuggestFullImageCut } from '@/utils/cropImage'
import styles from '@/components/ops/CropRegionEditor.module.css'

/** 按 URL 缓存 natural 尺寸，切任务回来可立刻恢复画框比例 */
const naturalSizeCache = new Map<string, { w: number; h: number }>()

interface CropRegionEditorProps {
  imageUrl: string
  regions: CropRectPct[]
  useOriginal: boolean
  onRegionsChange: (regions: CropRectPct[] | ((prev: CropRectPct[]) => CropRectPct[])) => void
  onUseOriginalChange: (v: boolean) => void
  variant?: 'default' | 'card'
  fullCutOpen?: boolean
  onFullCutOpenChange?: (open: boolean) => void
  onSuggestFullCutChange?: (suggest: boolean) => void
}

function RegionOverlay({
  regions,
  selectedRegionId,
  draftRect,
  draftStyle,
  useOriginal,
  getRegionStyle,
  onRegionPointerDown,
  onHandlePointerDown,
  onDelete,
}: {
  regions: CropRectPct[]
  selectedRegionId: string | null
  draftRect: CropRectPct | null
  draftStyle: React.CSSProperties | null
  useOriginal: boolean
  getRegionStyle: (r: CropRectPct) => React.CSSProperties
  onRegionPointerDown: (id: string, e: React.PointerEvent) => void
  onHandlePointerDown: (id: string, handle: CropHandle, e: React.PointerEvent) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className={styles.overlay}>
      {regions.map((r, idx) => {
        const selected = selectedRegionId === r.id
        return (
          <div
            key={r.id}
            className={[styles.regionBox, selected ? styles.regionSelected : ''].join(' ')}
            style={getRegionStyle(r)}
            onPointerDown={(e) => onRegionPointerDown(r.id, e)}
          >
            <span className={styles.regionBadge}>区域 {idx + 1}</span>
            {selected && !useOriginal && (
              <>
                <button
                  type="button"
                  className={styles.regionDelete}
                  aria-label="删除区域"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(r.id)
                  }}
                >
                  ×
                </button>
                {CROP_HANDLES.map((handle) => (
                  <button
                    key={handle}
                    type="button"
                    className={[styles.regionHandle, styles[`handle_${handle}`]].join(' ')}
                    aria-label="调整区域大小"
                    onPointerDown={(e) => onHandlePointerDown(r.id, handle, e)}
                  />
                ))}
              </>
            )}
          </div>
        )
      })}
      {draftRect && draftRect.wPct > 0 && draftStyle && (
        <div
          className={[styles.regionBox, styles.regionDraft].join(' ')}
          style={draftStyle}
        />
      )}
    </div>
  )
}

function CropCanvas({
  imageUrl,
  canvasRef,
  frameStyle,
  frameClassName,
  imgClassName,
  onImageLoad,
  onCanvasPointerDown,
  locked,
  children,
}: {
  imageUrl: string
  canvasRef: React.RefObject<HTMLDivElement | null>
  frameStyle?: React.CSSProperties
  frameClassName?: string
  imgClassName?: string
  onImageLoad: (w: number, h: number) => void
  onCanvasPointerDown: (e: React.PointerEvent) => void
  locked?: boolean
  children: React.ReactNode
}) {
  const handleImgRef = (el: HTMLImageElement | null) => {
    if (el?.complete && el.naturalWidth > 0 && el.naturalHeight > 0) {
      onImageLoad(el.naturalWidth, el.naturalHeight)
    }
  }

  return (
    <div
      ref={canvasRef}
      className={[
        styles.canvas,
        frameClassName ?? '',
        locked ? styles.canvasLocked : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={frameStyle}
      onPointerDown={onCanvasPointerDown}
    >
      <img
        ref={handleImgRef}
        src={imageUrl}
        alt="源图"
        className={[styles.sourceImg, imgClassName ?? ''].filter(Boolean).join(' ')}
        draggable={false}
        onLoad={(e) => {
          const t = e.currentTarget
          if (t.naturalWidth > 0 && t.naturalHeight > 0) {
            onImageLoad(t.naturalWidth, t.naturalHeight)
          }
        }}
      />
      {children}
    </div>
  )
}

export default function CropRegionEditor({
  imageUrl,
  regions,
  useOriginal,
  onRegionsChange,
  variant = 'default',
  fullCutOpen: controlledFullCutOpen,
  onFullCutOpenChange,
  onSuggestFullCutChange,
}: CropRegionEditorProps) {
  const cached = naturalSizeCache.get(imageUrl)
  const [naturalSize, setNaturalSize] = useState(cached ?? { w: 0, h: 0 })
  const [internalFullCutOpen, setInternalFullCutOpen] = useState(false)

  const fullCutOpen = controlledFullCutOpen ?? internalFullCutOpen
  const setFullCutOpen = onFullCutOpenChange ?? setInternalFullCutOpen

  const registerNaturalSize = useCallback(
    (w: number, h: number) => {
      const nw = Math.floor(w)
      const nh = Math.floor(h)
      if (nw <= 0 || nh <= 0) return
      naturalSizeCache.set(imageUrl, { w: nw, h: nh })
      setNaturalSize((prev) => (prev.w === nw && prev.h === nh ? prev : { w: nw, h: nh }))
    },
    [imageUrl],
  )

  const crop = useMattingCropRegions({
    regions,
    useOriginal,
    naturalSize,
    onRegionsChange,
  })

  const suggestFullCut =
    naturalSize.w > 0 && naturalSize.h > 0 && shouldSuggestFullImageCut(naturalSize.w, naturalSize.h)

  useEffect(() => {
    onSuggestFullCutChange?.(suggestFullCut)
  }, [suggestFullCut, onSuggestFullCutChange])

  const hasAspect = naturalSize.w > 0 && naturalSize.h > 0
  const fullFrameStyle = hasAspect
    ? buildNaturalAspectFrameStyle(naturalSize.w, naturalSize.h, {
        maxHeight: 'min(64vh, calc(100dvh - 260px))',
        maxWidth: 'min(92vw, calc(100vw - 40px))',
      })
    : undefined

  const inlineOverlayProps = {
    regions,
    selectedRegionId: crop.selectedRegionId,
    draftRect: crop.draftSurface === 'inline' ? crop.draftRect : null,
    draftStyle: crop.getDraftStyle('inline'),
    useOriginal,
    getRegionStyle: crop.getInlineRegionStyle,
    onRegionPointerDown: (id: string, e: React.PointerEvent) =>
      crop.startEdit(id, 'move', 'inline', e),
    onHandlePointerDown: (id: string, handle: CropHandle, e: React.PointerEvent) =>
      crop.startEdit(id, handle, 'inline', e),
    onDelete: crop.deleteRegion,
  }

  const fullOverlayProps = {
    ...inlineOverlayProps,
    draftRect: crop.draftSurface === 'full' ? crop.draftRect : null,
    draftStyle: crop.getDraftStyle('full'),
    getRegionStyle: crop.getFullRegionStyle,
    onRegionPointerDown: (id: string, e: React.PointerEvent) =>
      crop.startEdit(id, 'move', 'full', e),
    onHandlePointerDown: (id: string, handle: CropHandle, e: React.PointerEvent) =>
      crop.startEdit(id, handle, 'full', e),
  }

  const isCard = variant === 'card'

  return (
    <div className={[styles.wrap, isCard ? styles.wrapCard : ''].filter(Boolean).join(' ')}>
      {!useOriginal ? (
        <>
          {suggestFullCut && isCard && (
            <p className={styles.non916Hint}>
              当前图比例与 9:16 不一致，预览仅为局部放大。请使用「完整图裁剪」查看整张原图后再框选。
            </p>
          )}
          <CropCanvas
            imageUrl={imageUrl}
            canvasRef={crop.inlineCanvasRef}
            frameClassName={styles.canvasInline916}
            onImageLoad={registerNaturalSize}
            onCanvasPointerDown={(e) => crop.onCanvasPointerDown('inline', e)}
            locked={crop.isLimitReached}
          >
            <RegionOverlay {...inlineOverlayProps} />
          </CropCanvas>
          <p
            className={[
              styles.status,
              isCard ? styles.statusCard : '',
              crop.isLimitReached ? styles.statusLimit : '',
              useOriginal ? styles.statusOriginal : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {crop.statusText}
          </p>
        </>
      ) : (
        <div className={styles.originalPreview}>
          <CropCanvas
            imageUrl={imageUrl}
            canvasRef={crop.inlineCanvasRef}
            frameClassName={[styles.canvasInline916, styles.canvasReadonly].join(' ')}
            onImageLoad={registerNaturalSize}
            onCanvasPointerDown={() => {}}
          >
            <div className={styles.overlay}>
              <div className={[styles.regionBox, styles.regionOriginal].join(' ')} style={{ inset: 0 }}>
                <span className={[styles.regionBadge, styles.badgeOriginal].join(' ')}>原图</span>
              </div>
            </div>
          </CropCanvas>
          <p className={[styles.status, isCard ? styles.statusCard : '', styles.statusOriginal].join(' ')}>
            {crop.statusText}
          </p>
        </div>
      )}

      <Modal
        title="完整图裁剪"
        open={fullCutOpen}
        onCancel={() => setFullCutOpen(false)}
        footer={null}
        width="auto"
        centered
        destroyOnClose={false}
        className={styles.fullCutModal}
      >
        <p className={styles.modalHint}>
          下方区域按<strong>原图像素比例</strong>完整显示，可直接框选；与卡片 9:16 预览中的选区实时对应。
        </p>
        <CropCanvas
          imageUrl={imageUrl}
          canvasRef={crop.fullCanvasRef}
          frameStyle={fullFrameStyle}
          frameClassName={[styles.canvasFull, hasAspect ? styles.canvasAspect : styles.canvasPlaceholder].join(' ')}
          imgClassName={styles.sourceImgFill}
          onImageLoad={registerNaturalSize}
          onCanvasPointerDown={(e) => crop.onCanvasPointerDown('full', e)}
          locked={crop.isLimitReached}
        >
          <RegionOverlay {...fullOverlayProps} />
        </CropCanvas>
        <p className={styles.modalFoot}>{crop.statusText}</p>
      </Modal>
    </div>
  )
}
