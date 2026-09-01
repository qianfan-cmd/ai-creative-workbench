import { ScissorOutlined } from '@ant-design/icons'
import { Alert, Button, Checkbox, message, Modal, Select } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  MattingElementsVO,
  MattingExtractStatusVO,
  MattingTaskVO,
} from '@/api/ops'
import {
  confirmMattingExtractApi,
  createMattingTaskApi,
  getMattingElementsApi,
  getMattingExtractStatusApi,
  getMattingTaskApi,
  listMattingTasksApi,
  patchMattingElementsApi,
  reDetectMattingRegionApi,
  saveMattingElementsApi,
} from '@/api/ops'
import request from '@/api/request'
import type { TagVO } from '@/api/tags'
import type { ApiResponse } from '@/types/api'
import ElementCandidateGallery from '@/components/ops/ElementCandidateGallery'
import ElementListPanel from '@/components/ops/ElementListPanel'
import MattingStage1Source from '@/components/ops/MattingStage1Source'
import MattingStage2Crop from '@/components/ops/MattingStage2Crop'
import StepNav from '@/components/ops/StepNav'
import TaskSidebar from '@/components/ops/TaskSidebar'
import styles from '@/pages/MattingPage.module.css'

const POLL_MS = 5000
const MAX_POLL = 500
const SESSION_KEY = 'matting:activeTaskId'

function hasConfirmedSources(task: MattingTaskVO | null) {
  return (task?.confirmedSources?.length ?? 0) > 0 || !!task?.sourceAssetId
}

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

function mapElementRename(
  data: MattingElementsVO,
  elementId: string,
  name: string,
): MattingElementsVO {
  const mapRegion = (r: MattingElementsVO['regions'][0]) => ({
    ...r,
    groups: r.groups.map((g) => ({
      ...g,
      elements: g.elements.map((el) =>
        el.id === elementId ? { ...el, elementName: name } : el,
      ),
    })),
  })

  return {
    ...data,
    sources: data.sources?.map((s) => ({
      ...s,
      regions: s.regions.map(mapRegion),
    })),
    regions: data.regions.map(mapRegion),
  }
}

export default function MattingPage() {
  const [tasks, setTasks] = useState<MattingTaskVO[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [task, setTask] = useState<MattingTaskVO | null>(null)
  const [viewStage, setViewStage] = useState(1)
  const [elements, setElements] = useState<MattingElementsVO | null>(null)
  const [extractStatus, setExtractStatus] = useState<MattingExtractStatusVO | null>(null)
  const [candidateCount, setCandidateCount] = useState(2)
  const [detecting, setDetecting] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSourceToAssets, setSaveSourceToAssets] = useState(false)
  const [sourceTagIds, setSourceTagIds] = useState<number[]>([])
  const [availableTags, setAvailableTags] = useState<TagVO[]>([])
  const [loadingElements, setLoadingElements] = useState(false)
  const pollRef = useRef(0)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const renameTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const initialSessionRestoreRef = useRef(false)

  const farthestStage = task?.stage ?? 1
  const canPreviewSave =
    farthestStage >= 4 &&
    (extractStatus?.extractStatus === 'done' || extractStatus?.extractStatus === 'partial_failed')
  const sourceCount = task?.confirmedSources?.length ?? (task?.sourceAssetId ? 1 : 0)

  const refreshTasks = useCallback(async () => {
    const list = await listMattingTasksApi()
    setTasks(list)
  }, [])

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
      setViewStage(t.stage)
      applyTaskMetaFromConfig(t)
      sessionStorage.setItem(SESSION_KEY, String(id))

      if (t.stage >= 3) await loadElements(id)
      if (t.stage >= 4) await loadExtractStatus(id)
    },
    [applyTaskMetaFromConfig, loadElements, loadExtractStatus],
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

  useEffect(() => {
    if (viewStage !== 5) return
    void request.get<ApiResponse<TagVO[]>>('/tags').then((res) => {
      const list = res.data.data
      setAvailableTags(list)
      const defaults = list.filter((t) => ['generated', 'reference'].includes(t.name)).map((t) => t.id)
      setSourceTagIds(defaults)
    })
  }, [viewStage])

  const handleSourceConfirmed = (updated: MattingTaskVO) => {
    setTask(updated)
    setElements(null)
    setExtractStatus(null)
    setViewStage(2)
    void refreshTasks()
  }

  const handleCropConfirmed = (updated: MattingTaskVO) => {
    setTask(updated)
    setViewStage(3)
    void loadElements(updated.id)
    setExtractStatus(null)
    void refreshTasks()
  }

  const handleBeforeSourceConfirm = useCallback(async () => {
    if (!task) return false
    const cfg = parseConfigSummary(task.configJson)
    if (task.stage >= 2 && (cfg.hasCrop || cfg.hasElements || cfg.hasExtract)) {
      return confirmDestructive(
        '更换源图',
        '更换源图将清空框选、元素清单与提取结果，是否继续？',
      )
    }
    return true
  }, [task])

  const handleBeforeCropConfirm = useCallback(async () => {
    if (!task) return false
    const cfg = parseConfigSummary(task.configJson)
    if (task.stage >= 3 && (cfg.hasElements || cfg.hasExtract)) {
      return confirmDestructive(
        '重新识别元素',
        '将清空元素清单、提取候选与保存结果，是否继续？',
      )
    }
    return true
  }, [task])

  const handleToggleElement = async (elementId: string, checked: boolean) => {
    if (!task) return
    const data = await patchMattingElementsApi(task.id, [{ id: elementId, checked }])
    setElements(data)
  }

  const handleRenameElement = (elementId: string, name: string) => {
    if (!task) return
    setElements((prev) => (prev ? mapElementRename(prev, elementId, name) : prev))
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
      const sourceTags = availableTags
        .filter((t) => sourceTagIds.includes(t.id))
        .map((t) => t.name)
      await saveMattingElementsApi(task.id, items, {
        saveSourceToAssets: saveSourceToAssets || undefined,
        sourceTags: saveSourceToAssets ? sourceTags : undefined,
      })
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
                <MattingStage1Source
                  taskId={task.id}
                  sourceAssetId={task.sourceAssetId}
                  sourceAssetUrl={task.sourceAssetUrl}
                  configJson={task.configJson}
                  onBeforeConfirm={() => handleBeforeSourceConfirm()}
                  onConfirmed={handleSourceConfirmed}
                />
              )}

              {viewStage === 2 && hasConfirmedSources(task) && (
                <div className={styles.stepBlock}>
                  <MattingStage2Crop
                    task={task}
                    onBeforeConfirm={() => handleBeforeCropConfirm()}
                    onConfirmed={handleCropConfirmed}
                    onDraftSaved={handleCropDraftSaved}
                  />
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
                  <div className={styles.saveSourceOption}>
                    <Checkbox
                      checked={saveSourceToAssets}
                      onChange={(e) => setSaveSourceToAssets(e.target.checked)}
                    >
                      {sourceCount > 1
                        ? `同时保存全部 ${sourceCount} 张源图到素材库`
                        : '同时保存源图到素材库'}
                    </Checkbox>
                    {saveSourceToAssets && (
                      <Select
                        mode="multiple"
                        className={styles.sourceTagSelect}
                        placeholder="源图标签"
                        value={sourceTagIds}
                        onChange={setSourceTagIds}
                        options={availableTags.map((t) => ({ value: t.id, label: t.name }))}
                      />
                    )}
                  </div>
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
