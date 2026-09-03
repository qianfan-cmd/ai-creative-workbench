import { describe, expect, it } from 'vitest'
import {
  chunkUrlsIntoRows,
  getPreviewMediaRowSizes,
  getRowColumnCount,
} from '@/components/ops/campaignPreviewMediaLayout'

describe('getPreviewMediaRowSizes', () => {
  it('web 1-4 single row', () => {
    expect(getPreviewMediaRowSizes(1, 'web')).toEqual([1])
    expect(getPreviewMediaRowSizes(4, 'web')).toEqual([4])
  })

  it('web 5-9 multi row', () => {
    expect(getPreviewMediaRowSizes(5, 'web')).toEqual([3, 2])
    expect(getPreviewMediaRowSizes(6, 'web')).toEqual([3, 3])
    expect(getPreviewMediaRowSizes(7, 'web')).toEqual([3, 3, 1])
    expect(getPreviewMediaRowSizes(8, 'web')).toEqual([3, 3, 2])
    expect(getPreviewMediaRowSizes(9, 'web')).toEqual([3, 3, 3])
  })

  it('mobile 1-3 single row', () => {
    expect(getPreviewMediaRowSizes(1, 'mobile')).toEqual([1])
    expect(getPreviewMediaRowSizes(3, 'mobile')).toEqual([3])
  })

  it('mobile 4-9', () => {
    expect(getPreviewMediaRowSizes(4, 'mobile')).toEqual([2, 2])
    expect(getPreviewMediaRowSizes(5, 'mobile')).toEqual([3, 2])
    expect(getPreviewMediaRowSizes(9, 'mobile')).toEqual([3, 3, 3])
  })
})

describe('chunkUrlsIntoRows', () => {
  it('splits urls by row sizes', () => {
    const urls = ['a', 'b', 'c', 'd', 'e']
    expect(chunkUrlsIntoRows(urls, [3, 2])).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e'],
    ])
  })
})

describe('getRowColumnCount', () => {
  it('web 4 uses 4 columns', () => {
    expect(getRowColumnCount(4, 'web', 4)).toBe(4)
  })

  it('mobile 4 uses 2 columns', () => {
    expect(getRowColumnCount(2, 'mobile', 4)).toBe(2)
  })
})
