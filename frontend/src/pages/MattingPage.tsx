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
import { cropImageToFile, type CropRectPct } from '@/utils/cropImage'
import styles from '@/pages/MattingPage.module.css'

const POLL_MS = 5000
const MAX_POLL = 500

export default function MattingPage() {
  const [tasks, setTasks] = useState<MattingTaskVO[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [task, setTask] = useState<MattingTaskVO | null>(null)
  const [elements, setElements] = useState<MattingElementsVO | null>(null)
  const [extractStatus, setExtractStatus] = useState<MattingExtractStatusVO | null>(null)
  const [cropRegions, setCropRegions] = useState<CropRectPct[]>([])
  const [useOriginal, setUseOriginal] = useState(false)
  const [candidateCount, setCandidateCount] = useState(2)
  const [detecting, setDetecting] = useState(false)
  const [confirmingCrop, setConfirmingCrop] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingElements, setLoadingElements] = useState(false)
  const pollRef = useRef(0)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const renameTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const refreshTasks = useCallback(async () => {
    const list = await listMattingTasksApi()
    setTasks(list)
  }, [])

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
      const t = await getMattingTaskApi(id)
      setTask(t)
      setActiveId(id)
      if (t.configJson) {
        try {
          const cfg = JSON.parse(t.configJson) as {
            cropRegions?: Array<CropRectPct & { useOriginal?: boolean }>
            candidateCount?: number
          }
          if (cfg.cropRegions?.length) {
            setUseOriginal(cfg.cropRegions.some((r) => r.useOriginal) || cfg.cropRegions[0]?.id === 'r_original')
            setCropRegions(
              cfg.cropRegions
                .filter((r) => !r.useOriginal)
                .map((r) => ({
                  id: r.id,
                  xPct: r.xPct ?? 0,
                  yPct: r.yPct ?? 0,
                  wPct: r.wPct ?? 0,
                  hPct: r.hPct ?? 0,
                })),
            )
          }
          if (cfg.candidateCount) setCandidateCount(cfg.candidateCount)
        } catch {
          /* ignore */
        }
      }
      if (t.stage >= 3) await loadElements(id)
      if (t.stage >= 4) await loadExtractStatus(id)
    },
    [loadElements, loadExtractStatus],
  )

  useEffect(() => {
    void refreshTasks()
  }, [refreshTasks])

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

  const handleNewTask = () => {
    Modal.confirm({
      title: '新建抠图任务',
      content: <input id="matting-new-title" placeholder="任务名称" defaultValue="抠图任务" className={styles.modalInput} />,
      onOk: async () => {
        const input = document.getElementById('matting-new-title') as HTMLInputElement | null
        const title = input?.value?.trim() || '抠图任务'
        const created = await createMattingTaskApi(title)
        await refreshTasks()
        setCropRegions([])
        setUseOriginal(false)
        setElements(null)
        setExtractStatus(null)
        await loadTask(created.id)
      },
    })
  }

  const handleSelectAsset = async (asset: AssetVO) => {
    if (!task) return
    const updated = await patchMattingTaskApi(task.id, {
      sourceAssetId: asset.id,
      stage: 2,
    })
    setTask(updated)
    message.success('已选择源图')
  }

  const handleConfirmCrop = async () => {
    if (!task?.sourceAssetUrl) return
    setConfirmingCrop(true)
    try {
      let regionsPayload: { id: string; xPct: number; yPct: number; wPct: number; hPct: number; subAssetId: number }[] = []

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
      })

      setDetecting(true)
      const updated = await confirmMattingCropApi(task.id)
      setTask(updated)
      await loadElements(task.id)
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
    setExtracting(true)
    try {
      const updated = await confirmMattingExtractApi(task.id, candidateCount)
      setTask(updated)
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

  const stage = task?.stage ?? 0

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
            <StepNav current={stage} />
            <div className={styles.content}>
              {stage === 1 && (
                <>
                  <ImageSourcePanel
                    contextLabel="源图"
                    selectedAssetId={task.sourceAssetId}
                    selectedAssetUrl={task.sourceAssetUrl}
                    onSelectAsset={(a) => void handleSelectAsset(a)}
                  />
                  {task.sourceAssetId && (
                    <Button type="primary" onClick={() => void patchMattingTaskApi(task.id, { stage: 2 }).then(setTask)}>
                      下一步：框选区域
                    </Button>
                  )}
                </>
              )}

              {stage === 2 && task.sourceAssetUrl && (
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

              {stage === 3 && (
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

              {stage >= 4 && stage < 5 && (
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
                    <Button
                      disabled={extractStatus?.extractStatus === 'running'}
                      onClick={() => void patchMattingTaskApi(task.id, { stage: 3 }).then(setTask)}
                    >
                      返回元素清单
                    </Button>
                    <Button
                      type="primary"
                      disabled={extractStatus?.extractStatus === 'running'}
                      onClick={() => void patchMattingTaskApi(task.id, { stage: 5 }).then(setTask)}
                    >
                      下一步：保存
                    </Button>
                  </div>
                </div>
              )}

              {stage >= 5 && (
                <div className={styles.saveBlock}>
                  <p className={styles.saveHint}>确认每个元素已选候选，批量保存到 Assets（标签 matted）。</p>
                  <ElementCandidateGallery
                    status={extractStatus}
                    onSelectSlot={handleSelectSlot}
                  />
                  <Button type="primary" loading={saving} onClick={() => void handleSaveAll()}>
                    保存到 Assets · matted
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
