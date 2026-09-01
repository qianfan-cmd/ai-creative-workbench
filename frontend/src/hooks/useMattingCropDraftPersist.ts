import { useCallback, useEffect, useRef } from 'react'
import { saveMattingCropRegionsApi } from '@/api/ops'
import type { CropRectPct } from '@/utils/cropImage'

const DEBOUNCE_MS = 500

export interface CropDraftPayload {
  draft: true
  sourceId: string
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
  sourceId: string,
  regions: CropRectPct[],
  useOriginal: boolean,
): string {
  const payload: CropDraftPayload & { taskId: number } = {
    taskId,
    draft: true,
    sourceId,
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
  sourceId: string
  regions: CropRectPct[]
  useOriginal: boolean
  enabled: boolean
  hydrated: boolean
  onSaved?: (configJson: string) => void
}

export function useMattingCropDraftPersist({
  taskId,
  sourceId,
  regions,
  useOriginal,
  enabled,
  hydrated,
  onSaved,
}: UseMattingCropDraftPersistOptions) {
  const skipRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedPayloadRef = useRef('')
  const latestRef = useRef({ taskId, sourceId, regions, useOriginal, enabled, hydrated })
  const onSavedRef = useRef(onSaved)

  useEffect(() => {
    onSavedRef.current = onSaved
  }, [onSaved])

  useEffect(() => {
    latestRef.current = { taskId, sourceId, regions, useOriginal, enabled, hydrated }
  }, [taskId, sourceId, regions, useOriginal, enabled, hydrated])

  useEffect(() => {
    lastSavedPayloadRef.current = ''
  }, [taskId, sourceId])

  const buildPayload = (r: CropRectPct[], original: boolean): CropDraftPayload => ({
    draft: true,
    sourceId,
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
    const {
      taskId: id,
      sourceId: sid,
      regions: r,
      useOriginal: original,
      enabled: ok,
      hydrated: ready,
    } = latestRef.current
    if (!ok || !id || !sid || !ready || skipRef.current) return
    if (!original && r.length === 0) return

    const payloadKey = serializeCropDraftPayload(id, sid, r, original)
    if (payloadKey === lastSavedPayloadRef.current) return

    try {
      const updated = await saveMattingCropRegionsApi(id, buildPayload(r, original))
      lastSavedPayloadRef.current = payloadKey
      if (updated.configJson) {
        onSavedRef.current?.(updated.configJson)
      }
    } catch {
      /* 草稿失败不打断编辑 */
    }
  }, [sourceId])

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

  const syncLastSavedPayload = useCallback(
    (override?: { regions: CropRectPct[]; useOriginal: boolean }) => {
      const { taskId: id, sourceId: sid, regions: r, useOriginal: original } = latestRef.current
      if (!id || !sid) return
      const reg = override?.regions ?? r
      const useOrig = override?.useOriginal ?? original
      lastSavedPayloadRef.current = serializeCropDraftPayload(id, sid, reg, useOrig)
    },
    [],
  )

  useEffect(() => {
    if (!enabled || !taskId || !sourceId || !hydrated || skipRef.current) return
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
  }, [taskId, sourceId, regions, useOriginal, enabled, hydrated, persistDraft])

  return { flushDraft, pausePersist, resumePersist, syncLastSavedPayload }
}
