/** 按相对原图 0–100% 矩形裁切，返回 PNG File */
import type { CSSProperties } from 'react'

export interface CropRectPct {
  id: string
  xPct: number
  yPct: number
  wPct: number
  hPct: number
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
  const scale = Math.min(cw / naturalW, ch / naturalH)
  const dispW = naturalW * scale
  const dispH = naturalH * scale
  const ox = (cw - dispW) / 2
  const oy = (ch - dispH) / 2
  const lx = clientX - rect.left - ox
  const ly = clientY - rect.top - oy
  const xPct = Math.max(0, Math.min(100, (lx / dispW) * 100))
  const yPct = Math.max(0, Math.min(100, (ly / dispH) * 100))
  return { xPct, yPct }
}

export function imagePctRectToDisplayStyle(
  r: CropRectPct,
  naturalW: number,
  naturalH: number,
  containerW: number,
  containerH: number,
): CSSProperties {
  const scale = Math.min(containerW / naturalW, containerH / naturalH)
  const dispW = naturalW * scale
  const dispH = naturalH * scale
  const ox = (containerW - dispW) / 2
  const oy = (containerH - dispH) / 2
  return {
    left: `${ox + (r.xPct / 100) * dispW}px`,
    top: `${oy + (r.yPct / 100) * dispH}px`,
    width: `${(r.wPct / 100) * dispW}px`,
    height: `${(r.hPct / 100) * dispH}px`,
  }
}
