export type PreviewMediaPlatform = 'web' | 'mobile'

/** 返回每一行的图片数量，如 [3, 2] 表示第一行 3 张、第二行 2 张 */
export function getPreviewMediaRowSizes(count: number, platform: PreviewMediaPlatform): number[] {
  if (count <= 0) return []

  if (platform === 'web') {
    if (count <= 4) return [count]
    if (count === 5) return [3, 2]
    if (count === 6) return [3, 3]
    if (count === 7) return [3, 3, 1]
    if (count === 8) return [3, 3, 2]
    return [3, 3, 3]
  }

  if (count <= 3) return [count]
  if (count === 4) return [2, 2]
  if (count === 5) return [3, 2]
  if (count === 6) return [3, 3]
  if (count === 7) return [3, 3, 1]
  if (count === 8) return [3, 3, 2]
  return [3, 3, 3]
}

export function chunkUrlsIntoRows(urls: string[], rowSizes: number[]): string[][] {
  const rows: string[][] = []
  let offset = 0
  for (const size of rowSizes) {
    rows.push(urls.slice(offset, offset + size))
    offset += size
  }
  return rows
}

/** 单行 grid 列数：Web 1–4 单行用实际张数；其余按当行张数，最多 3 列 */
export function getRowColumnCount(rowSize: number, platform: PreviewMediaPlatform, totalCount: number): number {
  if (platform === 'web' && totalCount <= 4) return rowSize
  if (platform === 'mobile' && totalCount === 4) return 2
  return Math.min(rowSize, 3)
}
