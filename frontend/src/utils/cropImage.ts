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

/**
 * 与美术机台 Stage2CutPanel `.cut-canvas__frame` 一致：9:16 + object-fit:cover。
 * 下列 frame 百分比需经 cover 映射才能对应 natural 像素。
 */
export const CUT_FRAME_NORM_W = 9
export const CUT_FRAME_NORM_H = 16
const TARGET_CUT_ASPECT = CUT_FRAME_NORM_W / CUT_FRAME_NORM_H

function coverLayout(nw: number, nh: number, fw: number, fh: number) {
  const scale = Math.max(fw / nw, fh / nh)
  const dispW = nw * scale
  const dispH = nh * scale
  const ox = (fw - dispW) / 2
  const oy = (fh - dispH) / 2
  return { scale, ox, oy }
}

/** 9:16 cover 画框百分比 → 图源裁切像素 */
export function framePctRectToNaturalPixels(
  xPct: number,
  yPct: number,
  wPct: number,
  hPct: number,
  nw: number,
  nh: number,
) {
  const W = Math.max(1, nw)
  const H = Math.max(1, nh)
  const fw = CUT_FRAME_NORM_W
  const fh = CUT_FRAME_NORM_H
  const { scale, ox, oy } = coverLayout(W, H, fw, fh)
  const fx0 = (xPct / 100) * fw
  const fy0 = (yPct / 100) * fh
  const fww = (wPct / 100) * fw
  const fhh = (hPct / 100) * fh
  let sx = (fx0 - ox) / scale
  let sy = (fy0 - oy) / scale
  let sw = fww / scale
  let sh = fhh / scale
  sx = Math.max(0, Math.min(sx, W))
  sy = Math.max(0, Math.min(sy, H))
  sw = Math.max(0, Math.min(sw, W - sx))
  sh = Math.max(0, Math.min(sh, H - sy))
  return { sx, sy, sw, sh }
}

/** 图源像素矩形 → 9:16 cover 画框百分比 */
export function naturalPixelRectToFramePct(
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  nw: number,
  nh: number,
) {
  const W = Math.max(1, nw)
  const H = Math.max(1, nh)
  const fw = CUT_FRAME_NORM_W
  const fh = CUT_FRAME_NORM_H
  const { scale, ox, oy } = coverLayout(W, H, fw, fh)
  const fx0 = ox + sx * scale
  const fy0 = oy + sy * scale
  const fww = sw * scale
  const fhh = sh * scale
  return {
    xPct: (fx0 / fw) * 100,
    yPct: (fy0 / fh) * 100,
    wPct: (fww / fw) * 100,
    hPct: (fhh / fh) * 100,
  }
}

/** 图源内 0–100% → 9:16 cover 画框百分比（内联显示） */
export function imagePctRectToFramePct(
  xPct: number,
  yPct: number,
  wPct: number,
  hPct: number,
  nw: number,
  nh: number,
) {
  const W = Math.max(1, nw)
  const H = Math.max(1, nh)
  const sx = (xPct / 100) * W
  const sy = (yPct / 100) * H
  const sw = (wPct / 100) * W
  const sh = (hPct / 100) * H
  return naturalPixelRectToFramePct(sx, sy, sw, sh, W, H)
}

/** 9:16 cover 画框百分比 → 图源内 0–100%（内联框选写回 state） */
export function framePctRectToImagePct(
  xPct: number,
  yPct: number,
  wPct: number,
  hPct: number,
  nw: number,
  nh: number,
) {
  const { sx, sy, sw, sh } = framePctRectToNaturalPixels(xPct, yPct, wPct, hPct, nw, nh)
  const W = Math.max(1, nw)
  const H = Math.max(1, nh)
  return {
    xPct: (sx / W) * 100,
    yPct: (sy / H) * 100,
    wPct: (sw / W) * 100,
    hPct: (sh / H) * 100,
  }
}

export function isRoughlyNineSixteen(nw: number, nh: number, tol = 0.02) {
  if (nw <= 0 || nh <= 0) return true
  const r = nw / nh
  return Math.abs(r - TARGET_CUT_ASPECT) <= tol
}

export function shouldSuggestFullImageCut(nw: number, nh: number) {
  if (nw <= 0 || nh <= 0) return false
  return !isRoughlyNineSixteen(nw, nh)
}

/** 画框按原图 natural 宽高比布局时的 frame 样式（完整图弹层） */
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
