import { useCallback, useEffect, useRef, useState } from 'react'
import type { CropRectPct } from '@/utils/cropImage'
import { pctRectToCssStyle } from '@/utils/cropImage'

export const MAX_CROP_REGIONS = 6

export type CropHandle = 'n' | 's' | 'w' | 'e' | 'nw' | 'ne' | 'sw' | 'se'

export const CROP_HANDLES: CropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

type Surface = 'inline' | 'full'

function genRegionId() {
  return `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

/** 与美术机台 useCutRegions.toPct 一致：相对画框 0–100% */
function toPct(value: number, total: number) {
  return total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0
}

function clampRegionForEdit(
  value: CropRectPct,
  canvasEl: HTMLElement | null,
): CropRectPct {
  if (!canvasEl) return value
  const rect = canvasEl.getBoundingClientRect()
  const minWPct = (10 / Math.max(rect.width, 1)) * 100
  const minHPct = (10 / Math.max(rect.height, 1)) * 100
  let { xPct, yPct, wPct, hPct } = value
  wPct = Math.max(minWPct, wPct)
  hPct = Math.max(minHPct, hPct)
  if (xPct < 0) xPct = 0
  if (yPct < 0) yPct = 0
  if (xPct + wPct > 100) xPct = 100 - wPct
  if (yPct + hPct > 100) yPct = 100 - hPct
  if (xPct < 0) xPct = 0
  if (yPct < 0) yPct = 0
  return { ...value, xPct, yPct, wPct, hPct }
}

export interface UseMattingCropRegionsOptions {
  regions: CropRectPct[]
  useOriginal: boolean
  onRegionsChange: (regions: CropRectPct[] | ((prev: CropRectPct[]) => CropRectPct[])) => void
}

/**
 * 框选交互（对齐美术机台 useCutRegions 单图版）：
 * - 画框坐标 = 相对 canvas 的 0–100%（画框与原图同宽高比时等同原图百分比，与 cropImage 一致）
 * - overlay 用 CSS % 定位，不等待 hidden Image 预加载
 * - window 级 pointermove/up，拖出画布仍可编辑
 */
export function useMattingCropRegions({
  regions,
  useOriginal,
  onRegionsChange,
}: UseMattingCropRegionsOptions) {
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)
  const [fullCutOpen, setFullCutOpen] = useState(false)
  const inlineCanvasRef = useRef<HTMLDivElement>(null)
  const fullCanvasRef = useRef<HTMLDivElement>(null)
  const regionsRef = useRef(regions)

  useEffect(() => {
    regionsRef.current = regions
  }, [regions])

  const drawingRef = useRef<{
    surface: Surface
    startXPct: number
    startYPct: number
    currentXPct: number
    currentYPct: number
    id: string
  } | null>(null)
  const [draftRect, setDraftRect] = useState<CropRectPct | null>(null)

  const editingRef = useRef<{
    regionId: string
    mode: 'move' | CropHandle
    surface: Surface
    startXPct: number
    startYPct: number
    initial: CropRectPct
  } | null>(null)

  const getCanvas = (surface: Surface) =>
    surface === 'full' ? fullCanvasRef.current : inlineCanvasRef.current

  const pointFromEvent = (surface: Surface, clientX: number, clientY: number) => {
    const el = getCanvas(surface)
    if (!el) return { xPct: 0, yPct: 0 }
    const rect = el.getBoundingClientRect()
    return {
      xPct: toPct(clientX - rect.left, rect.width),
      yPct: toPct(clientY - rect.top, rect.height),
    }
  }

  const updateRegion = useCallback(
    (regionId: string, updater: (r: CropRectPct) => CropRectPct) => {
      onRegionsChange((prev) => prev.map((r) => (r.id === regionId ? updater(r) : r)))
    },
    [onRegionsChange],
  )

  const deleteRegion = useCallback(
    (regionId: string) => {
      onRegionsChange((prev) => prev.filter((r) => r.id !== regionId))
      setSelectedRegionId((id) => (id === regionId ? null : id))
    },
    [onRegionsChange],
  )

  const onCanvasPointerDown = (surface: Surface, e: React.PointerEvent) => {
    if (useOriginal) return
    if (regionsRef.current.length >= MAX_CROP_REGIONS) return
    const el = getCanvas(surface)
    if (!el) return
    setSelectedRegionId(null)
    const pt = pointFromEvent(surface, e.clientX, e.clientY)
    const id = genRegionId()
    drawingRef.current = {
      surface,
      startXPct: pt.xPct,
      startYPct: pt.yPct,
      currentXPct: pt.xPct,
      currentYPct: pt.yPct,
      id,
    }
    setDraftRect({ id, xPct: pt.xPct, yPct: pt.yPct, wPct: 0, hPct: 0 })
  }

  const startEdit = (
    regionId: string,
    mode: 'move' | CropHandle,
    surface: Surface,
    e: React.PointerEvent,
  ) => {
    if (useOriginal) return
    const target = regionsRef.current.find((r) => r.id === regionId)
    if (!target) return
    const el = getCanvas(surface)
    if (!el) return
    e.stopPropagation()
    setSelectedRegionId(regionId)
    const pt = pointFromEvent(surface, e.clientX, e.clientY)
    editingRef.current = {
      regionId,
      mode,
      surface,
      startXPct: pt.xPct,
      startYPct: pt.yPct,
      initial: { ...target },
    }
  }

  const onGlobalPointerMove = useCallback((ev: PointerEvent) => {
    const draw = drawingRef.current
    if (draw) {
      const el = getCanvas(draw.surface)
      if (!el) return
      const rect = el.getBoundingClientRect()
      const pt = {
        xPct: toPct(ev.clientX - rect.left, rect.width),
        yPct: toPct(ev.clientY - rect.top, rect.height),
      }
      draw.currentXPct = pt.xPct
      draw.currentYPct = pt.yPct
      const xPct = Math.min(draw.startXPct, draw.currentXPct)
      const yPct = Math.min(draw.startYPct, draw.currentYPct)
      const wPct = Math.abs(draw.currentXPct - draw.startXPct)
      const hPct = Math.abs(draw.currentYPct - draw.startYPct)
      setDraftRect({ id: draw.id, xPct, yPct, wPct, hPct })
      return
    }

    const edit = editingRef.current
    if (!edit) return
    const el = getCanvas(edit.surface)
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pt = {
      xPct: toPct(ev.clientX - rect.left, rect.width),
      yPct: toPct(ev.clientY - rect.top, rect.height),
    }
    const dx = pt.xPct - edit.startXPct
    const dy = pt.yPct - edit.startYPct
    const init = edit.initial
    let next: CropRectPct = { ...init }

    switch (edit.mode) {
      case 'move':
        next = { ...init, xPct: init.xPct + dx, yPct: init.yPct + dy }
        break
      case 'n':
        next = { ...init, yPct: init.yPct + dy, hPct: init.hPct - dy }
        break
      case 's':
        next = { ...init, hPct: init.hPct + dy }
        break
      case 'w':
        next = { ...init, xPct: init.xPct + dx, wPct: init.wPct - dx }
        break
      case 'e':
        next = { ...init, wPct: init.wPct + dx }
        break
      case 'nw':
        next = {
          ...init,
          xPct: init.xPct + dx,
          wPct: init.wPct - dx,
          yPct: init.yPct + dy,
          hPct: init.hPct - dy,
        }
        break
      case 'ne':
        next = { ...init, wPct: init.wPct + dx, yPct: init.yPct + dy, hPct: init.hPct - dy }
        break
      case 'sw':
        next = { ...init, xPct: init.xPct + dx, wPct: init.wPct - dx, hPct: init.hPct + dy }
        break
      case 'se':
        next = { ...init, wPct: init.wPct + dx, hPct: init.hPct + dy }
        break
    }

    next = clampRegionForEdit(next, el)
    updateRegion(edit.regionId, () => next)
  }, [updateRegion])

  const onGlobalPointerUp = useCallback(() => {
    if (editingRef.current) {
      editingRef.current = null
      return
    }

    const draw = drawingRef.current
    if (!draw) return
    drawingRef.current = null

    const el = getCanvas(draw.surface)
    const xPct = Math.min(draw.startXPct, draw.currentXPct)
    const yPct = Math.min(draw.startYPct, draw.currentYPct)
    const wPct = Math.abs(draw.currentXPct - draw.startXPct)
    const hPct = Math.abs(draw.currentYPct - draw.startYPct)

    if (wPct < 2 || hPct < 2) {
      setDraftRect(null)
      return
    }
    const raw: CropRectPct = { id: draw.id, xPct, yPct, wPct, hPct }
    const next = clampRegionForEdit(raw, el)
    if (next.wPct < 2 || next.hPct < 2) {
      setDraftRect(null)
      return
    }
    if (regionsRef.current.length >= MAX_CROP_REGIONS) {
      setDraftRect(null)
      return
    }
    onRegionsChange((prev) => [...prev, next])
    setSelectedRegionId(next.id)
    setDraftRect(null)
  }, [onRegionsChange])

  useEffect(() => {
    window.addEventListener('pointermove', onGlobalPointerMove)
    window.addEventListener('pointerup', onGlobalPointerUp)
    return () => {
      window.removeEventListener('pointermove', onGlobalPointerMove)
      window.removeEventListener('pointerup', onGlobalPointerUp)
    }
  }, [onGlobalPointerMove, onGlobalPointerUp])

  /** 与美术机台 getRegionStyle：CSS 百分比，首帧即可渲染 */
  const getRegionStyle = useCallback((r: CropRectPct) => pctRectToCssStyle(r), [])

  const isLimitReached = regions.length >= MAX_CROP_REGIONS

  const statusText = useOriginal
    ? '使用原图（全部覆盖）'
    : regions.length === 0
      ? '尚未定义切割区域'
      : isLimitReached
        ? `本图已选满 ${MAX_CROP_REGIONS} 个区域。删除某块区域后可再框选`
        : `已定义 ${regions.length} 个切割区域 · 最多 ${MAX_CROP_REGIONS} 个 · 点击图片空白处继续绘制`

  return {
    selectedRegionId,
    setSelectedRegionId,
    fullCutOpen,
    setFullCutOpen,
    inlineCanvasRef,
    fullCanvasRef,
    draftRect,
    onCanvasPointerDown,
    startEdit,
    deleteRegion,
    getRegionStyle,
    isLimitReached,
    statusText,
  }
}
