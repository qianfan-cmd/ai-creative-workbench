/** 按相对原图 0–100% 矩形裁切，返回 PNG File */
import type { CSSProperties } from 'react'

export interface CropRectPct {
  id: string
  xPct: number
  yPct: number
  wPct: number
  hPct: number
}

/** 将 API / config_json 中的区域字段规范化为 CropRectPct（兼容缺失字段与越界值） */
export function normalizeCropRegion(
  raw: Record<string, unknown>,
  index: number,
): CropRectPct | null {
  const xPct = clampPct(Number(raw.xPct ?? raw.x_pct ?? 0))
  const yPct = clampPct(Number(raw.yPct ?? raw.y_pct ?? 0))
  let wPct = clampPct(Number(raw.wPct ?? raw.w_pct ?? 0))
  let hPct = clampPct(Number(raw.hPct ?? raw.h_pct ?? 0))
  if (!Number.isFinite(xPct) || !Number.isFinite(yPct) || !Number.isFinite(wPct) || !Number.isFinite(hPct)) {
    return null
  }
  if (wPct <= 0 || hPct <= 0) return null
  if (xPct + wPct > 100) wPct = 100 - xPct
  if (yPct + hPct > 100) hPct = 100 - yPct
  if (wPct <= 0 || hPct <= 0) return null
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id : `r_restored_${index}`
  return { id, xPct, yPct, wPct, hPct }
}

function clampPct(v: number) {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(100, v))
}

export async function cropImageToFile(
  imageUrl: string,
  rect: CropRectPct,
  fileName: string,
): Promise<File> {
  const img = await loadImage(imageUrl)
  const sx = Math.round((rect.xPct / 100) * img.naturalWidth)
  const sy = Math.round((rect.yPct / 100) * img.naturalHeight)
  const sw = Math.max(1, Math.round((rect.wPct / 100) * img.naturalWidth))
  const sh = Math.max(1, Math.round((rect.hPct / 100) * img.naturalHeight))

  const canvas = document.createElement('canvas')
  canvas.width = sw
  canvas.height = sh
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('裁切失败'))), 'image/png')
  })
  return new File([blob], fileName, { type: 'image/png' })
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = url
  })
}

/** 显示区域（object-fit: contain）上的鼠标坐标 → 原图 0–100% */
export function displayPointToImagePct(
  clientX: number,
  clientY: number,
  container: HTMLElement,
  naturalW: number,
  naturalH: number,
): { xPct: number; yPct: number } {
  const rect = container.getBoundingClientRect()
  const cw = rect.width
  const ch = rect.height
  if (cw <= 0 || ch <= 0 || naturalW <= 0 || naturalH <= 0) {
    return { xPct: 0, yPct: 0 }
  }
  const scale = Math.min(cw / naturalW, ch / naturalH)
  const dispW = naturalW * scale
  const dispH = naturalH * scale
  if (dispW <= 0 || dispH <= 0) {
    return { xPct: 0, yPct: 0 }
  }
  const ox = (cw - dispW) / 2
  const oy = (ch - dispH) / 2
  const lx = clientX - rect.left - ox
  const ly = clientY - rect.top - oy
  const xPct = Math.max(0, Math.min(100, (lx / dispW) * 100))
  const yPct = Math.max(0, Math.min(100, (ly / dispH) * 100))
  return { xPct, yPct }
}

/** 与美术机台 getRegionStyle 一致：overlay 内 CSS 百分比定位 */
export function pctRectToCssStyle(r: CropRectPct): CSSProperties {
  return {
    left: `${r.xPct}%`,
    top: `${r.yPct}%`,
    width: `${r.wPct}%`,
    height: `${r.hPct}%`,
  }
}

/** 画框按原图 natural 宽高比布局时的 frame 样式（inline / 完整图弹层共用） */
export function buildNaturalAspectFrameStyle(
  naturalW: number,
  naturalH: number,
  opts?: { maxHeight?: string; maxWidth?: string },
): CSSProperties | undefined {
  if (naturalW <= 0 || naturalH <= 0) return undefined
  const maxH = opts?.maxHeight ?? 'min(360px, 50vh)'
  const maxW = opts?.maxWidth ?? '100%'
  return {
    aspectRatio: `${naturalW} / ${naturalH}`,
    width: `min(${maxW}, calc(${maxH} * ${naturalW} / ${naturalH}))`,
    maxHeight: maxH,
    height: 'auto',
  }
}
