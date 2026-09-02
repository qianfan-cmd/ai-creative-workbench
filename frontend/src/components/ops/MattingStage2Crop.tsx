import { Button, message } from 'antd'

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'

import {

  confirmMattingCropApi,

  getMattingCropRegionsApi,

  saveMattingCropRegionsApi,

  type MattingConfirmedSourceVO,

  type MattingTaskVO,

} from '@/api/ops'

import CropRegionEditor from '@/components/ops/CropRegionEditor'

import styles from '@/components/ops/MattingStage2Crop.module.css'

import { MAX_CROP_REGIONS } from '@/hooks/useMattingCropRegions'

import { useMattingCropDraftPersist } from '@/hooks/useMattingCropDraftPersist'

import { normalizeCropRegion, type CropRectPct } from '@/utils/cropImage'



export interface SourceCropState {

  regions: CropRectPct[]

  useOriginal: boolean

  hydrated: boolean

}



interface SourceCropPanelProps {

  taskId: number

  source: MattingConfirmedSourceVO

  state: SourceCropState

  onStateChange: (sourceId: string, patch: Partial<SourceCropState>) => void

  onDraftSaved: (configJson: string) => void

  draftRef: MutableRefObject<Map<string, ReturnType<typeof useMattingCropDraftPersist>>>

}



function SourceCropPanel({

  taskId,

  source,

  state,

  onStateChange,

  onDraftSaved,

  draftRef,

}: SourceCropPanelProps) {

  const [fullCutOpen, setFullCutOpen] = useState(false)

  const [suggestFullCut, setSuggestFullCut] = useState(false)



  const draft = useMattingCropDraftPersist({

    taskId,

    sourceId: source.id,

    regions: state.regions,

    useOriginal: state.useOriginal,

    enabled: !!source.sourceAssetUrl,

    hydrated: state.hydrated,

    onSaved: onDraftSaved,

  })



  useEffect(() => {

    draftRef.current.set(source.id, draft)

    return () => {

      draftRef.current.delete(source.id)

    }

  }, [source.id, draft, draftRef])



  const label = source.label ?? source.id



  if (!source.sourceAssetUrl) {

    return (

      <article className={styles.cutCard}>

        <p className={styles.cardUnavailable}>{label}：源图不可用</p>

      </article>

    )

  }



  const toggleUseOriginal = () => {

    const next = !state.useOriginal

    onStateChange(source.id, { useOriginal: next, regions: next ? [] : state.regions })

  }



  return (

    <article className={styles.cutCard}>

      <header className={styles.cutCardHead}>

        <p className={styles.cutCardTitle} title={label}>

          {label}

        </p>

        <button

          type="button"

          className={[styles.useOriginalBtn, state.useOriginal ? styles.useOriginalOn : ''].join(' ')}

          onClick={toggleUseOriginal}

        >

          {state.useOriginal && <span className={styles.useOriginalCheck} aria-hidden="true">✓</span>}

          {state.useOriginal ? '使用原图（全部覆盖）' : '使用原图'}

        </button>

        {suggestFullCut && !state.useOriginal && (

          <button

            type="button"

            className={styles.fullCutBtn}

            title="卡片内为 9:16 缩略视野，点此按原图完整显示并框选"

            onClick={() => setFullCutOpen(true)}

          >

            完整图裁剪

          </button>

        )}

      </header>



      <CropRegionEditor

        variant="card"

        imageUrl={source.sourceAssetUrl}

        regions={state.regions}

        useOriginal={state.useOriginal}

        fullCutOpen={fullCutOpen}

        onFullCutOpenChange={setFullCutOpen}

        onSuggestFullCutChange={setSuggestFullCut}

        onRegionsChange={(regions) =>

          onStateChange(source.id, {

            regions: typeof regions === 'function' ? regions(state.regions) : regions,

          })

        }

        onUseOriginalChange={(useOriginal) => onStateChange(source.id, { useOriginal })}

      />

    </article>

  )

}



interface MattingStage2CropProps {
  task: MattingTaskVO
  onBeforeConfirm?: () => Promise<boolean>
  onConfirmed: (task: MattingTaskVO) => void
  onDraftSaved: (configJson: string) => void
  hideFooter?: boolean
  onRegisterConfirm?: (api: {
    runConfirm: () => Promise<void>
    confirming: boolean
    detecting: boolean
    disabled: boolean
  }) => void
}



function emptyState(): SourceCropState {

  return { regions: [], useOriginal: false, hydrated: false }

}



function buildCutSummary(

  total: number,

  regionCount: number,

  undefinedCount: number,

): string {

  if (undefinedCount > 0) {

    return `单张最多 ${MAX_CROP_REGIONS} 个区域。已确认 ${total} 张来源整图 · 累计 ${regionCount} 个切割区域 · 尚有 ${undefinedCount} 张未定义切割（请框选区域或点「使用原图」）。`

  }

  return `单张最多 ${MAX_CROP_REGIONS} 个区域。已确认 ${total} 张来源整图 · 累计 ${regionCount} 个切割区域 · 均已满足条件，可确认进入下一步。`

}



export default function MattingStage2Crop({
  task,
  onBeforeConfirm,
  onConfirmed,
  onDraftSaved,
  hideFooter = false,
  onRegisterConfirm,
}: MattingStage2CropProps) {

  const sources = task.confirmedSources ?? []

  const [sourceStates, setSourceStates] = useState<Record<string, SourceCropState>>({})

  const [confirming, setConfirming] = useState(false)

  const [detecting, setDetecting] = useState(false)

  const draftRef = useRef<Map<string, ReturnType<typeof useMattingCropDraftPersist>>>(new Map())

  const loadSeqRef = useRef(0)



  const patchSourceState = useCallback((sourceId: string, patch: Partial<SourceCropState>) => {

    setSourceStates((prev) => ({

      ...prev,

      [sourceId]: { ...(prev[sourceId] ?? emptyState()), ...patch },

    }))

  }, [])



  const sourceIdsKey = sources.map((s) => s.id).join(',')



  const hydrate = useCallback(async () => {

    const seq = ++loadSeqRef.current

    for (const d of draftRef.current.values()) {

      d.pausePersist()

    }



    const initial: Record<string, SourceCropState> = {}

    for (const s of sources) {

      initial[s.id] = emptyState()

    }

    setSourceStates(initial)



    try {

      const data = await getMattingCropRegionsApi(task.id)

      if (seq !== loadSeqRef.current) return



      const next: Record<string, SourceCropState> = {}

      for (const s of sources) {

        const crop = data.sources?.find((x) => x.sourceId === s.id)

        const restored = (crop?.regions ?? [])

          .map((r, idx) => normalizeCropRegion(r as unknown as Record<string, unknown>, idx))

          .filter((r): r is CropRectPct => r != null)

        next[s.id] = {

          regions: restored,

          useOriginal: !!crop?.useOriginal,

          hydrated: true,

        }

      }

      setSourceStates(next)



      if (seq !== loadSeqRef.current) return

      for (const s of sources) {

        const st = next[s.id]

        draftRef.current.get(s.id)?.syncLastSavedPayload({

          regions: st.regions,

          useOriginal: st.useOriginal,

        })

      }

    } catch {

      if (seq !== loadSeqRef.current) return

      const next: Record<string, SourceCropState> = {}

      for (const s of sources) {

        next[s.id] = { ...emptyState(), hydrated: true }

      }

      setSourceStates(next)

    }



    if (seq !== loadSeqRef.current) return

    for (const d of draftRef.current.values()) {

      d.resumePersist()

    }

  }, [task.id, sourceIdsKey, sources])



  useEffect(() => {

    if (sources.length === 0) return

    void hydrate()

  }, [hydrate, sources.length, sourceIdsKey])



  const allSourcesReady = sources.every((s) => {

    const st = sourceStates[s.id]

    if (!st) return false

    return st.useOriginal || st.regions.length > 0

  })



  const allHydrated = sources.every((s) => sourceStates[s.id]?.hydrated)



  const cutSummary = useMemo(() => {

    const total = sources.length

    const regionCount = sources.reduce((sum, s) => sum + (sourceStates[s.id]?.regions.length ?? 0), 0)

    const undefinedCount = sources.filter((s) => {

      const st = sourceStates[s.id]

      if (!st) return true

      return !st.useOriginal && st.regions.length === 0

    }).length

    return buildCutSummary(total, regionCount, undefinedCount)

  }, [sources, sourceStates])

  const confirmDisabled = !allSourcesReady || !allHydrated

  const handleConfirm = async () => {

    if (!allSourcesReady) {

      message.warning('请为每张来源整图框选至少一个区域，或勾选使用原图')

      return

    }

    if (onBeforeConfirm && !(await onBeforeConfirm())) return



    setConfirming(true)

    try {

      for (const d of draftRef.current.values()) {

        await d.flushDraft()

      }



      const sourcesPayload: {
        sourceId: string
        useOriginal?: boolean
        regions?: {
          id: string
          xPct: number
          yPct: number
          wPct: number
          hPct: number
        }[]
      }[] = []

      for (const s of sources) {
        const st = sourceStates[s.id]
        if (!st) continue
        if (st.useOriginal) {
          sourcesPayload.push({ sourceId: s.id, useOriginal: true })
          continue
        }
        sourcesPayload.push({
          sourceId: s.id,
          useOriginal: false,
          regions: st.regions.map((r) => ({
            id: r.id,
            xPct: r.xPct,
            yPct: r.yPct,
            wPct: r.wPct,
            hPct: r.hPct,
          })),
        })
      }

      await saveMattingCropRegionsApi(task.id, { sources: sourcesPayload })

      setDetecting(true)

      const updated = await confirmMattingCropApi(task.id)

      onConfirmed(updated)

      message.success('元素识别完成')

    } catch (e) {

      message.error(e instanceof Error ? e.message : '框选确认失败')

    } finally {

      setDetecting(false)

      setConfirming(false)

    }

  }

  useEffect(() => {
    onRegisterConfirm?.({
      runConfirm: handleConfirm,
      confirming,
      detecting,
      disabled: confirmDisabled,
    })
  }, [confirming, detecting, confirmDisabled, onRegisterConfirm, handleConfirm])

  if (sources.length === 0) {

    return <p className={styles.hint}>暂无已确认来源，请返回步骤①选择源图。</p>

  }



  return (

    <div className={styles.panel}>

      <p className={styles.cutSummary}>{cutSummary}</p>



      <div className={styles.grid}>

        {sources.map((s) => (

          <SourceCropPanel

            key={s.id}

            taskId={task.id}

            source={s}

            state={sourceStates[s.id] ?? emptyState()}

            onStateChange={patchSourceState}

            onDraftSaved={onDraftSaved}

            draftRef={draftRef}

          />

        ))}

      </div>



      {!hideFooter && (
      <div className={styles.footer}>

        <Button

          type="primary"

          loading={confirming || detecting}

          disabled={!allSourcesReady || !allHydrated}

          onClick={() => void handleConfirm()}

        >

          确认切割，进入下一步 →

        </Button>

      </div>
      )}

    </div>

  )

}


