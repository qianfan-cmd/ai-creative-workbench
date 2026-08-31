import { BorderOutlined, ExpandOutlined } from '@ant-design/icons'
import { Button, Checkbox, Modal } from 'antd'
import { useCallback, useState } from 'react'
import {
  CROP_HANDLES,
  useMattingCropRegions,
  type CropHandle,
} from '@/hooks/useMattingCropRegions'
import type { CropRectPct } from '@/utils/cropImage'
import { buildNaturalAspectFrameStyle } from '@/utils/cropImage'
import styles from '@/components/ops/CropRegionEditor.module.css'

/** 按 URL 缓存 natural 尺寸，切任务回来可立刻恢复画框比例（对齐机台 registerCutImageNaturalSize） */
const naturalSizeCache = new Map<string, { w: number; h: number }>()

interface CropRegionEditorProps {
  imageUrl: string
  regions: CropRectPct[]
  useOriginal: boolean
  onRegionsChange: (regions: CropRectPct[] | ((prev: CropRectPct[]) => CropRectPct[])) => void
  onUseOriginalChange: (v: boolean) => void
}

function RegionOverlay({
  regions,
  selectedRegionId,
  draftRect,
  useOriginal,
  getRegionStyle,
  onRegionPointerDown,
  onHandlePointerDown,
  onDelete,
}: {
  regions: CropRectPct[]
  selectedRegionId: string | null
  draftRect: CropRectPct | null
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
      {draftRect && draftRect.wPct > 0 && (
        <div
          className={[styles.regionBox, styles.regionDraft].join(' ')}
          style={getRegionStyle(draftRect)}
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
  onImageLoad,
  onCanvasPointerDown,
  children,
}: {
  imageUrl: string
  canvasRef: React.RefObject<HTMLDivElement | null>
  frameStyle?: React.CSSProperties
  frameClassName?: string
  onImageLoad: (w: number, h: number) => void
  onCanvasPointerDown: (e: React.PointerEvent) => void
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
      className={[styles.canvas, frameClassName ?? ''].filter(Boolean).join(' ')}
      style={frameStyle}
      onPointerDown={onCanvasPointerDown}
    >
      <img
        ref={handleImgRef}
        src={imageUrl}
        alt="源图"
        className={styles.sourceImg}
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
  onUseOriginalChange,
}: CropRegionEditorProps) {
  const cached = naturalSizeCache.get(imageUrl)
  const [naturalSize, setNaturalSize] = useState(cached ?? { w: 0, h: 0 })

  /** 对齐 Stage2CutPanel.onCardImageLoad → registerCutImageNaturalSize */
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
    onRegionsChange,
  })

  const hasAspect = naturalSize.w > 0 && naturalSize.h > 0
  const inlineFrameStyle = hasAspect
    ? buildNaturalAspectFrameStyle(naturalSize.w, naturalSize.h, {
        maxHeight: 'min(360px, 50vh)',
      })
    : undefined
  const fullFrameStyle = hasAspect
    ? buildNaturalAspectFrameStyle(naturalSize.w, naturalSize.h, {
        maxHeight: 'min(64vh, calc(100dvh - 260px))',
        maxWidth: 'min(92vw, calc(100vw - 40px))',
      })
    : undefined

  const overlayProps = {
    regions,
    selectedRegionId: crop.selectedRegionId,
    draftRect: crop.draftRect,
    useOriginal,
    getRegionStyle: crop.getRegionStyle,
    onRegionPointerDown: (id: string, e: React.PointerEvent) =>
      crop.startEdit(id, 'move', 'inline', e),
    onHandlePointerDown: (id: string, handle: CropHandle, e: React.PointerEvent) =>
      crop.startEdit(id, handle, 'inline', e),
    onDelete: crop.deleteRegion,
  }

  const fullOverlayProps = {
    ...overlayProps,
    onRegionPointerDown: (id: string, e: React.PointerEvent) =>
      crop.startEdit(id, 'move', 'full', e),
    onHandlePointerDown: (id: string, handle: CropHandle, e: React.PointerEvent) =>
      crop.startEdit(id, handle, 'full', e),
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <Checkbox
          checked={useOriginal}
          onChange={(e) => {
            onUseOriginalChange(e.target.checked)
            if (e.target.checked) onRegionsChange([])
          }}
        >
          使用原图（不框选）
        </Checkbox>
        {!useOriginal && (
          <>
            <Button type="link" icon={<ExpandOutlined />} onClick={() => crop.setFullCutOpen(true)}>
              完整图裁剪
            </Button>
            <span className={styles.hint}>
              <BorderOutlined /> 拖拽绘制 · 拖动移动 · 控点缩放（{regions.length}/{6}）
            </span>
          </>
        )}
      </div>

      {!useOriginal ? (
        <>
          <CropCanvas
            imageUrl={imageUrl}
            canvasRef={crop.inlineCanvasRef}
            frameStyle={inlineFrameStyle}
            frameClassName={hasAspect ? styles.canvasAspect : styles.canvasPlaceholder}
            onImageLoad={registerNaturalSize}
            onCanvasPointerDown={(e) => crop.onCanvasPointerDown('inline', e)}
          >
            <RegionOverlay {...overlayProps} />
          </CropCanvas>
          <p
            className={[
              styles.status,
              crop.isLimitReached ? styles.statusLimit : '',
            ].join(' ')}
          >
            {crop.statusText}
          </p>
        </>
      ) : (
        <div className={styles.originalPreview}>
          <CropCanvas
            imageUrl={imageUrl}
            canvasRef={crop.inlineCanvasRef}
            frameStyle={inlineFrameStyle}
            frameClassName={[styles.canvasReadonly, hasAspect ? styles.canvasAspect : ''].join(' ')}
            onImageLoad={registerNaturalSize}
            onCanvasPointerDown={() => {}}
          >
            <div className={styles.overlay}>
              <div className={[styles.regionBox, styles.regionOriginal].join(' ')} style={{ inset: 0 }}>
                <span className={[styles.regionBadge, styles.badgeOriginal].join(' ')}>原图</span>
              </div>
            </div>
          </CropCanvas>
          <p className={styles.status}>{crop.statusText}</p>
        </div>
      )}

      <Modal
        title="完整图裁剪"
        open={crop.fullCutOpen}
        onCancel={() => crop.setFullCutOpen(false)}
        footer={null}
        width="auto"
        centered
        destroyOnClose={false}
      >
        <p className={styles.modalHint}>在大图模式下框选、拖动或缩放区域，关闭后保留已选区域。</p>
        <CropCanvas
          imageUrl={imageUrl}
          canvasRef={crop.fullCanvasRef}
          frameStyle={fullFrameStyle}
          frameClassName={[styles.canvasFull, hasAspect ? styles.canvasAspect : styles.canvasPlaceholder].join(' ')}
          onImageLoad={registerNaturalSize}
          onCanvasPointerDown={(e) => crop.onCanvasPointerDown('full', e)}
        >
          <RegionOverlay {...fullOverlayProps} />
        </CropCanvas>
      </Modal>
    </div>
  )
}
