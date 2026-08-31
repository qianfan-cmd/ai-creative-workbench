import { BorderOutlined, DeleteOutlined } from '@ant-design/icons'
import { Button, Checkbox, message } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CropRectPct } from '@/utils/cropImage'
import { displayPointToImagePct, imagePctRectToDisplayStyle } from '@/utils/cropImage'
import styles from '@/components/ops/CropRegionEditor.module.css'

const MAX_REGIONS = 6

interface CropRegionEditorProps {
  imageUrl: string
  regions: CropRectPct[]
  useOriginal: boolean
  onRegionsChange: (regions: CropRectPct[]) => void
  onUseOriginalChange: (v: boolean) => void
}

function genId() {
  return `r_${Math.random().toString(36).slice(2, 9)}`
}

export default function CropRegionEditor({
  imageUrl,
  regions,
  useOriginal,
  onRegionsChange,
  onUseOriginalChange,
}: CropRegionEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [naturalSize, setNaturalSize] = useState({ w: 1, h: 1 })
  const [containerSize, setContainerSize] = useState({ w: 400, h: 300 })
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; id: string } | null>(null)
  const [draftRect, setDraftRect] = useState<CropRectPct | null>(null)

  useEffect(() => {
    const img = new Image()
    img.onload = () => setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = imageUrl
  }, [imageUrl])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setContainerSize({ w: el.clientWidth, h: el.clientHeight })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const onMouseDown = (e: React.MouseEvent) => {
    if (useOriginal || !canvasRef.current) return
    const pt = displayPointToImagePct(e.clientX, e.clientY, canvasRef.current, naturalSize.w, naturalSize.h)
    const id = genId()
    setDrawing({ startX: pt.xPct, startY: pt.yPct, id })
    setDraftRect({ id, xPct: pt.xPct, yPct: pt.yPct, wPct: 0, hPct: 0 })
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (!drawing || !canvasRef.current) return
    const pt = displayPointToImagePct(e.clientX, e.clientY, canvasRef.current, naturalSize.w, naturalSize.h)
    const xPct = Math.min(drawing.startX, pt.xPct)
    const yPct = Math.min(drawing.startY, pt.yPct)
    const wPct = Math.abs(pt.xPct - drawing.startX)
    const hPct = Math.abs(pt.yPct - drawing.startY)
    setDraftRect({ id: drawing.id, xPct, yPct, wPct, hPct })
  }

  const onMouseUp = () => {
    if (!draftRect || draftRect.wPct < 2 || draftRect.hPct < 2) {
      setDrawing(null)
      setDraftRect(null)
      return
    }
    if (regions.length >= MAX_REGIONS) {
      message.warning(`最多 ${MAX_REGIONS} 个区域`)
    } else {
      onRegionsChange([...regions, draftRect])
    }
    setDrawing(null)
    setDraftRect(null)
  }

  const removeRegion = (id: string) => {
    onRegionsChange(regions.filter((r) => r.id !== id))
  }

  const rectStyle = useCallback(
    (r: CropRectPct) =>
      imagePctRectToDisplayStyle(r, naturalSize.w, naturalSize.h, containerSize.w, containerSize.h),
    [naturalSize, containerSize],
  )

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <Checkbox checked={useOriginal} onChange={(e) => onUseOriginalChange(e.target.checked)}>
          使用原图（不框选）
        </Checkbox>
        {!useOriginal && (
          <span className={styles.hint}>
            <BorderOutlined /> 在图上拖拽绘制区域（{regions.length}/{MAX_REGIONS}）
          </span>
        )}
      </div>

      {!useOriginal && (
        <>
          <div
            ref={canvasRef}
            className={styles.canvas}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            <img src={imageUrl} alt="源图" className={styles.sourceImg} draggable={false} />
            {regions.map((r) => (
              <div key={r.id} className={styles.regionBox} style={rectStyle(r)}>
                <button type="button" className={styles.regionDelete} onClick={() => removeRegion(r.id)}>
                  <DeleteOutlined />
                </button>
              </div>
            ))}
            {draftRect && draftRect.wPct > 0 && (
              <div className={[styles.regionBox, styles.regionDraft].join(' ')} style={rectStyle(draftRect)} />
            )}
          </div>

          {/* {regions.length > 0 && (
            <ul className={styles.regionList}>
              {regions.map((r, i) => (
                <li key={r.id}>
                  区域 {i + 1} — {r.wPct.toFixed(0)}% × {r.hPct.toFixed(0)}%
                  <Button type="link" size="small" danger onClick={() => removeRegion(r.id)}>
                    删除
                  </Button>
                </li>
              ))}
            </ul>
          )} */}
        </>
      )}

      {useOriginal && (
        <div className={styles.originalPreview}>
          <img src={imageUrl} alt="原图" className={styles.sourceImgSmall} />
        </div>
      )}
    </div>
  )
}
