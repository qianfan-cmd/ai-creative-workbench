import { useCallback, useEffect, useRef } from 'react'
import { saveMattingCropRegionsApi } from '@/api/ops'
import type { CropRectPct } from '@/utils/cropImage'

const DEBOUNCE_MS = 500

export interface CropDraftPayload {
  draft: true
  useOriginal: boolean
  regions?: {
    id: string
    xPct: number
    yPct: number
    wPct: number
    hPct: number
  }[]
}

/** 序列化草稿 PUT body，用于去重与 hydrate 后同步 */
export function serializeCropDraftPayload(
  taskId: number,
  regions: CropRectPct[],
  useOriginal: boolean,
): string {
  const payload: CropDraftPayload & { taskId: number } = {
    taskId,
    draft: true,
    useOriginal,
    regions: useOriginal
      ? undefined
      : regions.map((item) => ({
          id: item.id,
          xPct: item.xPct,
          yPct: item.yPct,
          wPct: item.wPct,
          hPct: item.hPct,
        })),
  }
  return JSON.stringify(payload)
}

export interface UseMattingCropDraftPersistOptions {
  taskId: number | null
  regions: CropRectPct[]
  useOriginal: boolean
  /** 已选源图时才向服务端同步 */
  enabled: boolean
  /** GET crop-regions 完成后再允许回写，避免用空数组覆盖服务端草稿 */
  hydrated: boolean
  /** 草稿保存成功后同步 task.configJson（请用 useCallback 保持稳定引用） */
  onSaved?: (configJson: string) => void
}

/**
 * 框选坐标草稿持久化（参考美术机台 crop/save + crop/list 分离思路）：
 * - 编辑时 debounce PUT draft=true（同路径 GET 只读，由 MattingPage hydrate 触发）
 * - payload 去重 + 稳定 persist 引用，避免 render 循环导致 PUT 风暴
 */
export function useMattingCropDraftPersist({
  taskId,
  regions,
  useOriginal,
  enabled,
  hydrated,
  onSaved,
}: UseMattingCropDraftPersistOptions) {
  const skipRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedPayloadRef = useRef('')
  const latestRef = useRef({ taskId, regions, useOriginal, enabled, hydrated })
  const onSavedRef = useRef(onSaved)
  useEffect(() => {
    onSavedRef.current = onSaved
  }, [onSaved])

  useEffect(() => {
    latestRef.current = { taskId, regions, useOriginal, enabled, hydrated }
  }, [taskId, regions, useOriginal, enabled, hydrated])

  useEffect(() => {
    lastSavedPayloadRef.current = ''
  }, [taskId])

  const buildPayload = (r: CropRectPct[], original: boolean): CropDraftPayload => ({
    draft: true,
    useOriginal: original,
    regions: original
      ? undefined
      : r.map((item) => ({
          id: item.id,
          xPct: item.xPct,
          yPct: item.yPct,
          wPct: item.wPct,
          hPct: item.hPct,
        })),
  })

  const persistDraft = useCallback(async () => {
    const { taskId: id, regions: r, useOriginal: original, enabled: ok, hydrated: ready } =
      latestRef.current
    if (!ok || !id || !ready || skipRef.current) return
    if (!original && r.length === 0) return

    const payloadKey = serializeCropDraftPayload(id, r, original)
    if (payloadKey === lastSavedPayloadRef.current) return

    try {
      const updated = await saveMattingCropRegionsApi(id, buildPayload(r, original))
      lastSavedPayloadRef.current = payloadKey
      if (updated.configJson) {
        onSavedRef.current?.(updated.configJson)
      }
      if (import.meta.env.DEV) {
        console.debug(`[crop] PUT draft task=${id} regions=${r.length}`)
      }
    } catch {
      // 草稿失败不打断编辑；用户确认框选时会再次正式保存
    }
  }, [])

  const flushDraft = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    await persistDraft()
  }, [persistDraft])

  const pausePersist = useCallback(() => {
    skipRef.current = true
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const resumePersist = useCallback(() => {
    skipRef.current = false
  }, [])

  /** GET hydrate 完成后调用，避免紧接着触发无意义 PUT */
  const syncLastSavedPayload = useCallback(
    (override?: { regions: CropRectPct[]; useOriginal: boolean }) => {
      const { taskId: id, regions: r, useOriginal: original } = latestRef.current
      if (!id) return
      const regions = override?.regions ?? r
      const useOrig = override?.useOriginal ?? original
      lastSavedPayloadRef.current = serializeCropDraftPayload(id, regions, useOrig)
    },
    [],
  )

  useEffect(() => {
    if (!enabled || !taskId || !hydrated || skipRef.current) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void persistDraft()
    }, DEBOUNCE_MS)
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [taskId, regions, useOriginal, enabled, hydrated])

  return { flushDraft, pausePersist, resumePersist, syncLastSavedPayload }
}
