import { ScissorOutlined } from '@ant-design/icons'
import { Alert, Button, message, Modal } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AssetVO } from '@/types/api'
import type {
  MattingElementsVO,
  MattingExtractStatusVO,
  MattingTaskVO,
} from '@/api/ops'
import {
  confirmMattingCropApi,
  confirmMattingExtractApi,
  createMattingTaskApi,
  getMattingCropRegionsApi,
  getMattingElementsApi,
  getMattingExtractStatusApi,
  getMattingTaskApi,
  listMattingTasksApi,
  patchMattingElementsApi,
  patchMattingTaskApi,
  reDetectMattingRegionApi,
  saveMattingCropRegionsApi,
  saveMattingElementsApi,
} from '@/api/ops'
import { uploadAssetApi } from '@/api/assets'
import CropRegionEditor from '@/components/ops/CropRegionEditor'
import ElementCandidateGallery from '@/components/ops/ElementCandidateGallery'
import ElementListPanel from '@/components/ops/ElementListPanel'
import ImageSourcePanel from '@/components/ops/ImageSourcePanel'
import StepNav from '@/components/ops/StepNav'
import TaskSidebar from '@/components/ops/TaskSidebar'
import { useMattingCropDraftPersist } from '@/hooks/useMattingCropDraftPersist'
import { cropImageToFile, normalizeCropRegion, type CropRectPct } from '@/utils/cropImage'
import styles from '@/pages/MattingPage.module.css'

const POLL_MS = 5000
const MAX_POLL = 500
const SESSION_KEY = 'matting:activeTaskId'

function parseConfigSummary(configJson?: string | null) {
  if (!configJson) {
    return { hasElements: false, hasExtract: false, hasCrop: false }
  }
  try {
    const cfg = JSON.parse(configJson) as {
      elements?: unknown[]
      elementImages?: unknown[]
      cropRegions?: unknown[]
    }
    return {
      hasElements: (cfg.elements?.length ?? 0) > 0,
      hasExtract: (cfg.elementImages?.length ?? 0) > 0,
      hasCrop: (cfg.cropRegions?.length ?? 0) > 0,
    }
  } catch {
    return { hasElements: false, hasExtract: false, hasCrop: false }
  }
}

function confirmDestructive(title: string, content: string): Promise<boolean> {
  return new Promise((resolve) => {
    Modal.confirm({
      title,
      content,
      okText: '确认清空并继续',
      cancelText: '取消',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
}

export default function MattingPage() {
  const [tasks, setTasks] = useState<MattingTaskVO[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [task, setTask] = useState<MattingTaskVO | null>(null)
  const [viewStage, setViewStage] = useState(1)
  const [elements, setElements] = useState<MattingElementsVO | null>(null)
  const [extractStatus, setExtractStatus] = useState<MattingExtractStatusVO | null>(null)
  const [cropRegions, setCropRegions] = useState<CropRectPct[]>([])
  const [useOriginal, setUseOriginal] = useState(false)
  /** GET crop-regions 完成后才允许草稿回写，避免刷新/loadTask 时用 [] 覆盖服务端 */
  const [cropHydrated, setCropHydrated] = useState(false)
  const [candidateCount, setCandidateCount] = useState(2)
  const [detecting, setDetecting] = useState(false)
  const [confirmingCrop, setConfirmingCrop] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingElements, setLoadingElements] = useState(false)
  const pollRef = useRef(0)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const renameTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const activeIdRef = useRef<number | null>(null)
  const cropDraftRef = useRef<ReturnType<typeof useMattingCropDraftPersist> | null>(null)
  const cropLoadSeqRef = useRef(0)
  const initialSessionRestoreRef = useRef(false)

  const farthestStage = task?.stage ?? 1
  const canPreviewSave =
    farthestStage >= 4 &&
    (extractStatus?.extractStatus === 'done' || extractStatus?.extractStatus === 'partial_failed')

  const refreshTasks = useCallback(async () => {
    const list = await listMattingTasksApi()
    setTasks(list)
  }, [])

  /** 仅解析与框选无关的 config 字段（框选坐标走 GET crop-regions） */
  const applyTaskMetaFromConfig = useCallback((t: MattingTaskVO) => {
    if (!t.configJson) return
    try {
      const cfg = JSON.parse(t.configJson) as { candidateCount?: number }
      if (cfg.candidateCount) setCandidateCount(cfg.candidateCount)
    } catch {
      /* ignore */
    }
  }, [])

  const handleCropDraftSaved = useCallback((configJson: string) => {
    setTask((prev) => (prev ? { ...prev, configJson } : prev))
  }, [])

  const cropDraft = useMattingCropDraftPersist({
    taskId: task?.id ?? null,
    regions: cropRegions,
    useOriginal,
    enabled: !!task?.sourceAssetId,
    hydrated: cropHydrated,
    onSaved: handleCropDraftSaved,
  })

  useEffect(() => {
    cropDraftRef.current = cropDraft
    activeIdRef.current = activeId
  }, [cropDraft, activeId])

  /**
   * GET crop-regions 恢复框选 UI（进入步骤②时调用；PUT 草稿由 useMattingCropDraftPersist 负责）
   */
  const hydrateCropRegions = useCallback(async (taskId: number) => {
    const seq = ++cropLoadSeqRef.current
    cropDraftRef.current?.pausePersist()
    setCropHydrated(false)

    try {
      const data = await getMattingCropRegionsApi(taskId)
      if (seq !== cropLoadSeqRef.current) return

      setUseOriginal(!!data.useOriginal)
      const restored = (data.regions ?? [])
        .map((r, idx) => normalizeCropRegion(r as unknown as Record<string, unknown>, idx))
        .filter((r): r is CropRectPct => r != null)
      setCropRegions(restored)

      if (import.meta.env.DEV) {
        console.debug(`[crop] GET hydrate task=${taskId} regions=${restored.length}`)
      }

      if (seq !== cropLoadSeqRef.current) return
      cropDraftRef.current?.syncLastSavedPayload({
        regions: restored,
        useOriginal: !!data.useOriginal,
      })
    } catch {
      if (seq !== cropLoadSeqRef.current) return
      setCropRegions([])
      setUseOriginal(false)
      cropDraftRef.current?.syncLastSavedPayload({ regions: [], useOriginal: false })
    }

    if (seq !== cropLoadSeqRef.current) return
    setCropHydrated(true)
    cropDraftRef.current?.resumePersist()
  }, [])

  /** 每次进入步骤②且已选源图时 GET 一次（切任务回来 / 刷新后点步骤②） */
  useEffect(() => {
    if (viewStage !== 2 || !task?.id || !task.sourceAssetId) return
    void hydrateCropRegions(task.id)
  }, [viewStage, task?.id, task?.sourceAssetId, hydrateCropRegions])

  const loadElements = useCallback(async (id: number) => {
    setLoadingElements(true)
    try {
      const data = await getMattingElementsApi(id)
      setElements(data)
      if (data.candidateCount) setCandidateCount(data.candidateCount)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载元素失败')
    } finally {
      setLoadingElements(false)
    }
  }, [])

  const loadExtractStatus = useCallback(async (id: number) => {
    try {
      const status = await getMattingExtractStatusApi(id)
      setExtractStatus(status)
      return status
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载提取状态失败')
      return null
    }
  }, [])

  const loadTask = useCallback(
    async (id: number) => {
      const prevId = activeIdRef.current
      if (prevId != null && prevId !== id) {
        await cropDraftRef.current?.flushDraft()
      }
      cropDraftRef.current?.pausePersist()
      setCropHydrated(false)

      const t = await getMattingTaskApi(id)
      setTask(t)
      setActiveId(id)
      activeIdRef.current = id
      setViewStage(t.stage)
      applyTaskMetaFromConfig(t)

      sessionStorage.setItem(SESSION_KEY, String(id))

      if (!t.sourceAssetId) {
        setCropRegions([])
        setUseOriginal(false)
        setCropHydrated(false)
      } else if (t.stage === 2 && id === prevId) {
        // 同任务再次选中且落在步骤②：effect 不会因 viewStage/id 变化触发，此处 GET 一次
        await hydrateCropRegions(id)
      } else {
        setCropRegions([])
        setUseOriginal(false)
        setCropHydrated(false)
      }
      // 切到其他任务且 viewStage===2 时，由 useEffect 触发 hydrateCropRegions

      if (t.stage >= 3) await loadElements(id)
      if (t.stage >= 4) await loadExtractStatus(id)
    },
    [applyTaskMetaFromConfig, hydrateCropRegions, loadElements, loadExtractStatus],
  )

  useEffect(() => {
    if (initialSessionRestoreRef.current) return
    initialSessionRestoreRef.current = true
    void (async () => {
      await refreshTasks()
      const raw = sessionStorage.getItem(SESSION_KEY)
      const id = raw ? Number.parseInt(raw, 10) : NaN
      if (Number.isFinite(id) && id > 0) {
        await loadTask(id)
      }
    })()
  }, [refreshTasks, loadTask])

  const stopPoll = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
    pollRef.current = 0
  }

  const schedulePoll = useCallback(
    (taskId: number) => {
      stopPoll()
      const tick = async () => {
        pollRef.current += 1
        const status = await loadExtractStatus(taskId)
        const running = status?.extractStatus === 'running'
        const allDone =
          status?.elements?.every(
            (el) => el.status === 'done' || el.status === 'partial_failed' || el.status === 'failed',
          ) ?? false
        if (!running || allDone || pollRef.current >= MAX_POLL) {
          stopPoll()
          setExtracting(false)
          if (pollRef.current >= MAX_POLL) {
            message.warning('部分元素仍在生成，可稍后刷新任务查看')
          }
          return
        }
        pollTimerRef.current = setTimeout(() => void tick(), POLL_MS)
      }
      pollTimerRef.current = setTimeout(() => void tick(), POLL_MS)
    },
    [loadExtractStatus],
  )

  useEffect(() => () => stopPoll(), [])

  useEffect(() => {
    if (task?.stage === 4 && task.status === 'running' && activeId) {
      setExtracting(true)
      schedulePoll(activeId)
    }
  }, [task?.stage, task?.status, activeId, schedulePoll])

  const handleStepClick = (step: number) => {
    if (!task) return
    const allowed = step <= farthestStage || (step === 5 && canPreviewSave)
    if (!allowed) return
    setViewStage(step)
    if (step >= 3 && !elements) void loadElements(task.id)
    if (step >= 4 && !extractStatus) void loadExtractStatus(task.id)
  }

  const handleNewTask = () => {
    Modal.confirm({
      title: '新建抠图任务',
      content: (
        <input id="matting-new-title" placeholder="任务名称" defaultValue="抠图任务" className={styles.modalInput} />
      ),
      onOk: async () => {
        const input = document.getElementById('matting-new-title') as HTMLInputElement | null
        const title = input?.value?.trim() || '抠图任务'
        const created = await createMattingTaskApi(title)
        await refreshTasks()
        sessionStorage.setItem(SESSION_KEY, String(created.id))
        setElements(null)
        setExtractStatus(null)
        setViewStage(1)
        await loadTask(created.id)
      },
    })
  }

  const handleSelectAsset = async (asset: AssetVO) => {
    if (!task) return
    const cfg = parseConfigSummary(task.configJson)
    if (task.stage >= 2 && (cfg.hasCrop || cfg.hasElements || cfg.hasExtract)) {
      const ok = await confirmDestructive(
        '更换源图',
        '更换源图将清空框选、元素清单与提取结果，是否继续？',
      )
      if (!ok) return
    }
    const updated = await patchMattingTaskApi(task.id, {
      sourceAssetId: asset.id,
      stage: 2,
    })
    setTask(updated)
    setElements(null)
    setExtractStatus(null)
    setViewStage(2)
    message.success('已选择源图')
  }

  const handleGoToCrop = async () => {
    if (!task) return
    if (task.stage < 2) {
      const updated = await patchMattingTaskApi(task.id, { stage: 2 })
      setTask(updated)
    }
    setViewStage(2)
  }

  const handleConfirmCrop = async () => {
    if (!task?.sourceAssetUrl) return
    const cfg = parseConfigSummary(task.configJson)
    if (task.stage >= 3 && (cfg.hasElements || cfg.hasExtract)) {
      const ok = await confirmDestructive(
        '重新识别元素',
        '将清空元素清单、提取候选与保存结果，是否继续？',
      )
      if (!ok) return
    }

    setConfirmingCrop(true)
    try {
      const regionsPayload: {
        id: string
        xPct: number
        yPct: number
        wPct: number
        hPct: number
        subAssetId: number
      }[] = []

      if (!useOriginal) {
        if (cropRegions.length === 0) {
          message.warning('请框选至少一个区域，或勾选使用原图')
          return
        }
        for (let i = 0; i < cropRegions.length; i++) {
          const r = cropRegions[i]
          const file = await cropImageToFile(task.sourceAssetUrl!, r, `crop-${i + 1}.png`)
          const uploaded = await uploadAssetApi(file)
          regionsPayload.push({
            id: r.id,
            xPct: r.xPct,
            yPct: r.yPct,
            wPct: r.wPct,
            hPct: r.hPct,
            subAssetId: uploaded.id,
          })
        }
      }

      await saveMattingCropRegionsApi(task.id, {
        useOriginal,
        regions: useOriginal ? undefined : regionsPayload,
        // 正式保存：含 subAssetId，确认前全量写入（非 draft）
      })

      setDetecting(true)
      const updated = await confirmMattingCropApi(task.id)
      setTask(updated)
      setViewStage(3)
      await loadElements(task.id)
      setExtractStatus(null)
      message.success('元素识别完成')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '框选确认失败')
    } finally {
      setDetecting(false)
      setConfirmingCrop(false)
    }
  }

  const handleToggleElement = async (elementId: string, checked: boolean) => {
    if (!task) return
    const data = await patchMattingElementsApi(task.id, [{ id: elementId, checked }])
    setElements(data)
  }

  const handleRenameElement = (elementId: string, name: string) => {
    if (!task) return
    setElements((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        regions: prev.regions.map((r) => ({
          ...r,
          groups: r.groups.map((g) => ({
            ...g,
            elements: g.elements.map((el) =>
              el.id === elementId ? { ...el, elementName: name } : el,
            ),
          })),
        })),
      }
    })
    const existing = renameTimers.current.get(elementId)
    if (existing) clearTimeout(existing)
    renameTimers.current.set(
      elementId,
      setTimeout(() => {
        void patchMattingElementsApi(task.id, [{ id: elementId, elementName: name }])
      }, 400),
    )
  }

  const handleReDetect = async (regionId: string) => {
    if (!task) return
    setDetecting(true)
    try {
      await reDetectMattingRegionApi(task.id, regionId)
      await loadElements(task.id)
      message.success('重新识别完成')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '重新识别失败')
    } finally {
      setDetecting(false)
    }
  }

  const handleConfirmExtract = async () => {
    if (!task) return
    const cfg = parseConfigSummary(task.configJson)
    if (task.stage >= 4 && cfg.hasExtract) {
      const ok = await confirmDestructive(
        '重新提取',
        '将清空已有提取候选，是否继续？',
      )
      if (!ok) return
    }

    setExtracting(true)
    try {
      const updated = await confirmMattingExtractApi(task.id, candidateCount)
      setTask(updated)
      setViewStage(4)
      await loadExtractStatus(task.id)
      schedulePoll(task.id)
      message.info('已开始提取，请稍候…')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '启动提取失败')
      setExtracting(false)
    }
  }

  const handleSelectSlot = (elementId: string, slotIndex: number) => {
    setExtractStatus((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        elements: prev.elements.map((el) =>
          el.elementId === elementId
            ? {
                ...el,
                selectedSlotIndex: slotIndex,
                images: el.images.map((img) => ({
                  ...img,
                  selected: img.slotIndex === slotIndex,
                })),
              }
            : el,
        ),
      }
    })
  }

  const handleSaveAll = async () => {
    if (!task || !extractStatus) return
    const items = extractStatus.elements
      .map((el) => {
        const selected = el.images.find((img) => img.selected && img.url)
        if (!selected?.url) return null
        return {
          elementId: el.elementId,
          candidateUrl: selected.url,
          name: `${task.title}-${el.elementName}.png`,
        }
      })
      .filter(Boolean) as { elementId: string; candidateUrl: string; name: string }[]

    if (items.length === 0) {
      message.warning('请为每个元素选择一张候选图')
      return
    }
    setSaving(true)
    try {
      await saveMattingElementsApi(task.id, items)
      message.success(`已保存 ${items.length} 张到 Assets（matted）`)
      await loadTask(task.id)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <TaskSidebar
        tasks={tasks}
        activeId={activeId}
        onSelect={(id) => void loadTask(id)}
        onNew={handleNewTask}
      />

      <div className={styles.main}>
        {!task ? (
          <div className={styles.welcome}>
            <ScissorOutlined className={styles.welcomeIcon} />
            <h1 className={styles.welcomeTitle}>抠图工作台 Matting</h1>
            <p className={styles.welcomeHint}>
              从左侧新建任务：选源图 → 框选区域 → 自动识别元素 → 按元素提取 → 保存到 Assets。
            </p>
            <Button type="primary" onClick={handleNewTask}>
              新建任务
            </Button>
          </div>
        ) : (
          <>
            <StepNav
              viewStage={viewStage}
              farthestStage={farthestStage}
              canPreviewSave={canPreviewSave}
              onStepClick={handleStepClick}
            />
            <div className={styles.content}>
              {viewStage === 1 && (
                <>
                  <ImageSourcePanel
                    contextLabel="源图"
                    selectedAssetId={task.sourceAssetId}
                    selectedAssetUrl={task.sourceAssetUrl}
                    onSelectAsset={(a) => void handleSelectAsset(a)}
                  />
                  {task.sourceAssetId && (
                    <Button type="primary" onClick={() => void handleGoToCrop()}>
                      下一步：框选区域
                    </Button>
                  )}
                </>
              )}

              {viewStage === 2 && task.sourceAssetUrl && (
                <div className={styles.stepBlock}>
                  <CropRegionEditor
                    imageUrl={task.sourceAssetUrl}
                    regions={cropRegions}
                    useOriginal={useOriginal}
                    onRegionsChange={setCropRegions}
                    onUseOriginalChange={setUseOriginal}
                  />
                  <Button
                    type="primary"
                    loading={confirmingCrop || detecting}
                    onClick={() => void handleConfirmCrop()}
                  >
                    确认框选并识别元素
                  </Button>
                </div>
              )}

              {viewStage === 3 && (
                <div className={styles.stepBlock}>
                  <ElementListPanel
                    data={elements}
                    loading={loadingElements}
                    detecting={detecting}
                    candidateCount={candidateCount}
                    onCandidateCountChange={setCandidateCount}
                    onToggle={(id, checked) => void handleToggleElement(id, checked)}
                    onRename={handleRenameElement}
                    onReDetect={(regionId) => void handleReDetect(regionId)}
                    onConfirmExtract={() => void handleConfirmExtract()}
                    extracting={extracting}
                  />
                </div>
              )}

              {viewStage === 4 && (
                <div className={styles.stepBlock}>
                  {extractStatus?.extractStatus === 'failed' && extractStatus.extractError && (
                    <Alert type="error" message={extractStatus.extractError} showIcon className={styles.alert} />
                  )}
                  <ElementCandidateGallery
                    status={extractStatus}
                    loading={extracting}
                    onSelectSlot={handleSelectSlot}
                  />
                  <div className={styles.toolbar}>
                    <Button onClick={() => setViewStage(3)}>返回元素清单</Button>
                    <Button
                      type="primary"
                      disabled={extractStatus?.extractStatus === 'running'}
                      onClick={() => setViewStage(5)}
                    >
                      下一步：保存
                    </Button>
                  </div>
                </div>
              )}

              {viewStage === 5 && (
                <div className={styles.saveBlock}>
                  <p className={styles.saveHint}>确认每个元素已选候选，批量保存到 Assets（标签 matted）。</p>
                  <ElementCandidateGallery
                    status={extractStatus}
                    onSelectSlot={handleSelectSlot}
                  />
                  <div className={styles.toolbar}>
                    <Button onClick={() => setViewStage(4)}>返回候选</Button>
                    <Button type="primary" loading={saving} onClick={() => void handleSaveAll()}>
                      保存到 Assets · matted
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
