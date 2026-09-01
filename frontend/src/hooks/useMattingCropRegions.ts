import { useCallback, useEffect, useRef, useState } from 'react'
import type { CropRectPct } from '@/utils/cropImage'
import {
  framePctRectToImagePct,
  imagePctRectToFramePct,
  pctRectToCssStyle,
} from '@/utils/cropImage'

export const MAX_CROP_REGIONS = 6

export type CropHandle = 'n' | 's' | 'w' | 'e' | 'nw' | 'ne' | 'sw' | 'se'

export const CROP_HANDLES: CropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

type Surface = 'inline' | 'full'
type CoordSpace = 'frame' | 'image'

function genRegionId() {
  return `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function toPct(value: number, total: number) {
  return total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0
}

function clampRegionForEdit(
  value: Pick<CropRectPct, 'xPct' | 'yPct' | 'wPct' | 'hPct'>,
  canvasEl: HTMLElement | null,
): Pick<CropRectPct, 'xPct' | 'yPct' | 'wPct' | 'hPct'> {
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
  return { xPct, yPct, wPct, hPct }
}

export interface UseMattingCropRegionsOptions {
  regions: CropRectPct[]
  useOriginal: boolean
  naturalSize: { w: number; h: number }
  onRegionsChange: (regions: CropRectPct[] | ((prev: CropRectPct[]) => CropRectPct[])) => void
}

/**
 * 框选交互（对齐美术机台 useCutRegions）：
 * - state/API 存原图 0–100% natural pct
 * - 内联 9:16 cover：显示/绘制用 frame pct，提交时转 natural
 * - 完整图弹层：直接 natural pct
 */
export function useMattingCropRegions({
  regions,
  useOriginal,
  naturalSize,
  onRegionsChange,
}: UseMattingCropRegionsOptions) {
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)
  const [fullCutOpen, setFullCutOpen] = useState(false)
  const inlineCanvasRef = useRef<HTMLDivElement>(null)
  const fullCanvasRef = useRef<HTMLDivElement>(null)
  const regionsRef = useRef(regions)
  const naturalSizeRef = useRef(naturalSize)

  useEffect(() => {
    regionsRef.current = regions
  }, [regions])

  useEffect(() => {
    naturalSizeRef.current = naturalSize
  }, [naturalSize])

  const drawingRef = useRef<{
    surface: Surface
    startXPct: number
    startYPct: number
    currentXPct: number
    currentYPct: number
    id: string
  } | null>(null)
  const [draftRect, setDraftRect] = useState<CropRectPct | null>(null)
  const [draftSurface, setDraftSurface] = useState<Surface | null>(null)

  const editingRef = useRef<{
    regionId: string
    mode: 'move' | CropHandle
    surface: Surface
    coordSpace: CoordSpace
    startXPct: number
    startYPct: number
    initial: Pick<CropRectPct, 'xPct' | 'yPct' | 'wPct' | 'hPct'>
  } | null>(null)

  const getCanvas = (surface: Surface) =>
    surface === 'full' ? fullCanvasRef.current : inlineCanvasRef.current

  const hasNaturalSize = () => {
    const { w, h } = naturalSizeRef.current
    return w > 0 && h > 0
  }

  const pointFromEvent = (surface: Surface, clientX: number, clientY: number) => {
    const el = getCanvas(surface)
    if (!el) return { xPct: 0, yPct: 0 }
    const rect = el.getBoundingClientRect()
    return {
      xPct: toPct(clientX - rect.left, rect.width),
      yPct: toPct(clientY - rect.top, rect.height),
    }
  }

  const frameBoxToNatural = (
    box: Pick<CropRectPct, 'xPct' | 'yPct' | 'wPct' | 'hPct'>,
  ): Pick<CropRectPct, 'xPct' | 'yPct' | 'wPct' | 'hPct'> => {
    const { w, h } = naturalSizeRef.current
    if (w <= 0 || h <= 0) return box
    return framePctRectToImagePct(box.xPct, box.yPct, box.wPct, box.hPct, w, h)
  }

  const naturalToFrameBox = (
    box: Pick<CropRectPct, 'xPct' | 'yPct' | 'wPct' | 'hPct'>,
  ): Pick<CropRectPct, 'xPct' | 'yPct' | 'wPct' | 'hPct'> => {
    const { w, h } = naturalSizeRef.current
    if (w <= 0 || h <= 0) return box
    return imagePctRectToFramePct(box.xPct, box.yPct, box.wPct, box.hPct, w, h)
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
    setDraftSurface(surface)
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

    const coordSpace: CoordSpace = surface === 'full' ? 'image' : 'frame'
    let initial: Pick<CropRectPct, 'xPct' | 'yPct' | 'wPct' | 'hPct'> = {
      xPct: target.xPct,
      yPct: target.yPct,
      wPct: target.wPct,
      hPct: target.hPct,
    }
    if (surface === 'full') {
      if (!hasNaturalSize()) return
      initial = { ...target }
    } else if (surface === 'inline') {
      if (!hasNaturalSize()) return
      initial = naturalToFrameBox(target)
    }

    editingRef.current = {
      regionId,
      mode,
      surface,
      coordSpace,
      startXPct: pt.xPct,
      startYPct: pt.yPct,
      initial,
    }
  }

  const onGlobalPointerMove = useCallback(
    (ev: PointerEvent) => {
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
      let next = { ...init }

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

      const normalized = clampRegionForEdit(next, el)
      let toWrite = normalized
      if (edit.coordSpace === 'frame') {
        toWrite = frameBoxToNatural(normalized)
      }
      updateRegion(edit.regionId, (region) => ({ ...region, ...toWrite }))
    },
    [updateRegion],
  )

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

    setDraftRect(null)
    setDraftSurface(null)

    if (wPct < 2 || hPct < 2) return

    const raw = clampRegionForEdit({ xPct, yPct, wPct, hPct }, el)
    if (raw.wPct < 2 || raw.hPct < 2) return
    if (regionsRef.current.length >= MAX_CROP_REGIONS) return

    let naturalBox = raw
    if (draw.surface === 'inline') {
      if (!hasNaturalSize()) return
      naturalBox = frameBoxToNatural(raw)
    }

    const next: CropRectPct = { id: draw.id, ...naturalBox }
    onRegionsChange((prev) => [...prev, next])
    setSelectedRegionId(next.id)
  }, [onRegionsChange])

  useEffect(() => {
    window.addEventListener('pointermove', onGlobalPointerMove)
    window.addEventListener('pointerup', onGlobalPointerUp)
    return () => {
      window.removeEventListener('pointermove', onGlobalPointerMove)
      window.removeEventListener('pointerup', onGlobalPointerUp)
    }
  }, [onGlobalPointerMove, onGlobalPointerUp])

  const getInlineRegionStyle = useCallback(
    (r: CropRectPct) => {
      const { w, h } = naturalSizeRef.current
      if (w <= 0 || h <= 0) return pctRectToCssStyle(r)
      const frame = imagePctRectToFramePct(r.xPct, r.yPct, r.wPct, r.hPct, w, h)
      return pctRectToCssStyle({ ...r, ...frame })
    },
    [],
  )

  const getFullRegionStyle = useCallback((r: CropRectPct) => pctRectToCssStyle(r), [])

  const getDraftStyle = useCallback(
    (surface: Surface) => {
      if (!draftRect || draftSurface !== surface) return null
      return pctRectToCssStyle(draftRect)
    },
    [draftRect, draftSurface],
  )

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
    draftSurface,
    onCanvasPointerDown,
    startEdit,
    deleteRegion,
    getInlineRegionStyle,
    getFullRegionStyle,
    getDraftStyle,
    isLimitReached,
    statusText,
  }
}
