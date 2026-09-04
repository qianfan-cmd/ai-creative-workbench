import { ScissorOutlined } from '@ant-design/icons'
import { Alert, Modal, Spin, message } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  MattingElementsVO,
  MattingExtractStatusVO,
  MattingTaskGroupVO,
  MattingTaskVO,
} from '@/api/ops'
import {
  confirmMattingExtractApi,
  createMattingTaskApi,
  getMattingElementsApi,
  getMattingExtractStatusApi,
  getMattingSidebarApi,
  getMattingTaskApi,
  patchMattingElementsApi,
  reDetectMattingRegionApi,
  regenerateMattingElementApi,
  saveMattingElementsApi,
} from '@/api/ops'
import request from '@/api/request'
import type { TagVO } from '@/api/tags'
import type { ApiResponse } from '@/types/api'
import ElementCandidateGallery from '@/components/ops/ElementCandidateGallery'
import ElementListPanel from '@/components/ops/ElementListPanel'
import MattingSavePanel from '@/components/ops/MattingSavePanel'
import MattingStage1Source from '@/components/ops/MattingStage1Source'
import MattingStage2Crop from '@/components/ops/MattingStage2Crop'
import MattingWorkspaceFrame, { mattingFrameStyles } from '@/components/ops/MattingWorkspaceFrame'
import StepNav from '@/components/ops/StepNav'
import TaskSidebar from '@/components/ops/TaskSidebar'
import { useMainContentLayout } from '@/hooks/useMainContentLayout'
import styles from '@/pages/MattingPage.module.css'

const POLL_MS = 5000
const MAX_POLL = 500
const SESSION_KEY = 'matting:activeTaskId'

function hasConfirmedSources(task: MattingTaskVO | null) {
  return (task?.confirmedSources?.length ?? 0) > 0 || !!task?.sourceAssetId
}

function parseConfigSummary(configJson?: string | null) {
  if (!configJson) {
    return { hasElements: false, hasExtract: false, hasCrop: false, extractStatus: 'idle' as string }
  }
  try {
    const cfg = JSON.parse(configJson) as {
      elements?: unknown[]
      elementImages?: unknown[]
      cropRegions?: unknown[]
      extractStatus?: string
    }
    return {
      hasElements: (cfg.elements?.length ?? 0) > 0,
      hasExtract: (cfg.elementImages?.length ?? 0) > 0,
      hasCrop: (cfg.cropRegions?.length ?? 0) > 0,
      extractStatus: cfg.extractStatus ?? 'idle',
    }
  } catch {
    return { hasElements: false, hasExtract: false, hasCrop: false, extractStatus: 'idle' as string }
  }
}

function resolveEffectiveStage(task: MattingTaskVO): number {
  const cfg = parseConfigSummary(task.configJson)
  let stage = task.stage ?? 1
  if (cfg.hasElements) stage = Math.max(stage, 3)
  if (cfg.hasExtract || cfg.extractStatus !== 'idle') stage = Math.max(stage, 4)
  return stage
}

function shouldLoadExtract(task: MattingTaskVO, effectiveStage: number): boolean {
  const cfg = parseConfigSummary(task.configJson)
  return effectiveStage >= 4 || cfg.extractStatus !== 'idle'
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

function collectElementIds(data: MattingElementsVO | null): Set<string> {
  const ids = new Set<string>()
  if (!data) return ids
  const regions = [
    ...(data.sources ?? []).flatMap((s) => s.regions),
    ...(data.regions ?? []),
  ]
  for (const region of regions) {
    for (const group of region.groups) {
      for (const el of group.elements) ids.add(el.id)
    }
  }
  return ids
}

function findNewElementId(
  data: MattingElementsVO,
  regionId: string,
  groupName: string,
  beforeIds: Set<string>,
): string | undefined {
  const regions = [
    ...(data.sources ?? []).flatMap((s) => s.regions),
    ...(data.regions ?? []),
  ]
  for (const region of regions) {
    if (region.regionId !== regionId) continue
    for (const group of region.groups) {
      if (group.groupName !== groupName) continue
      const created = group.elements.find((el) => !beforeIds.has(el.id))
      return created?.id
    }
  }
  return undefined
}

export default function MattingPage() {
  const [tasks, setTasks] = useState<MattingTaskVO[]>([])
  const [groups, setGroups] = useState<MattingTaskGroupVO[]>([])
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
  const initialSessionRestoreRef = useRef(false)
  const [cropFooter, setCropFooter] = useState<{
    confirming: boolean
    detecting: boolean
    disabled: boolean
  }>({ confirming: false, detecting: false, disabled: true })
  const cropConfirmRunRef = useRef<(() => Promise<void>) | null>(null)

  useMainContentLayout({ lockScroll: true, fullBleed: true })

  const handleRegisterCropConfirm = useCallback(
    (api: {
      runConfirm: () => Promise<void>
      confirming: boolean
      detecting: boolean
      disabled: boolean
    }) => {
      cropConfirmRunRef.current = api.runConfirm
      setCropFooter((prev) =>
        prev.confirming === api.confirming &&
        prev.detecting === api.detecting &&
        prev.disabled === api.disabled
          ? prev
          : {
              confirming: api.confirming,
              detecting: api.detecting,
              disabled: api.disabled,
            },
      )
    },
    [],
  )

  const farthestStage = task ? resolveEffectiveStage(task) : 1
  const canPreviewSave =
    farthestStage >= 4 &&
    (extractStatus?.extractStatus === 'done' || extractStatus?.extractStatus === 'partial_failed')
  const isExtractBusy =
    extracting ||
    extractStatus?.extractStatus === 'running' ||
    (extractStatus?.elements?.some((el) => el.images.some((img) => img.status === 'pending')) ?? false)
  const sourceCount = task?.confirmedSources?.length ?? (task?.sourceAssetId ? 1 : 0)

  const refreshTasks = useCallback(async () => {
    const sidebar = await getMattingSidebarApi()
    setTasks(sidebar.tasks)
    setGroups(sidebar.groups)
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
        const hasPending =
          status?.elements?.some((el) => el.images.some((img) => img.status === 'pending')) ?? false
        const running = status?.extractStatus === 'running' || hasPending
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

  const resumeExtractPollIfNeeded = useCallback(
    (t: MattingTaskVO, id: number, status: MattingExtractStatusVO | null) => {
      const cfg = parseConfigSummary(t.configJson)
      const hasPending =
        status?.elements?.some((el) => el.images.some((img) => img.status === 'pending')) ?? false
      const shouldPoll =
        status?.extractStatus === 'running' ||
        hasPending ||
        (t.status === 'running' && (cfg.hasExtract || cfg.extractStatus === 'running'))
      if (shouldPoll) {
        setExtracting(true)
        schedulePoll(id)
      }
    },
    [schedulePoll],
  )

  const loadTask = useCallback(
    async (id: number) => {
      stopPoll()
      setElements(null)
      setExtractStatus(null)
      setExtracting(false)

      const t = await getMattingTaskApi(id)
      const effectiveStage = resolveEffectiveStage(t)
      setTask(t)
      setActiveId(id)
      setViewStage(effectiveStage)
      applyTaskMetaFromConfig(t)
      sessionStorage.setItem(SESSION_KEY, String(id))

      if (effectiveStage >= 3) await loadElements(id)
      if (shouldLoadExtract(t, effectiveStage)) {
        const status = await loadExtractStatus(id)
        resumeExtractPollIfNeeded(t, id, status)
      }
    },
    [applyTaskMetaFromConfig, loadElements, loadExtractStatus, resumeExtractPollIfNeeded],
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

  const handleDeleteTask = useCallback(
    async (deletedId: number) => {
      const nextTasks = tasks.filter((t) => t.id !== deletedId)
      setTasks(nextTasks)
      if (activeId === deletedId) {
        stopPoll()
        if (nextTasks.length > 0) {
          await loadTask(nextTasks[0].id)
        } else {
          setActiveId(null)
          setTask(null)
          sessionStorage.removeItem(SESSION_KEY)
        }
      }
    },
    [tasks, activeId, loadTask],
  )

  useEffect(() => () => stopPoll(), [])

  const handleStepClick = (step: number) => {
    if (!task || isExtractBusy) return
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

  const handleRenameElement = async (elementId: string, name: string) => {
    if (!task) return
    const trimmed = name.replace(/\s+/g, ' ').trim()
    if (!trimmed) {
      message.warning('元素名称不能为空')
      return
    }
    try {
      const data = await patchMattingElementsApi(task.id, [{ id: elementId, elementName: trimmed }])
      setElements(data)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败')
      throw e
    }
  }

  const handleDeleteElement = async (elementId: string) => {
    if (!task) return
    try {
      const data = await patchMattingElementsApi(task.id, [{ id: elementId, deleted: true }])
      setElements(data)
      message.success('已删除')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败')
      throw e
    }
  }

  const handleAddElement = async (
    regionId: string,
    groupName: string,
    elementName = '新元素',
  ): Promise<string | undefined> => {
    if (!task) return undefined
    const beforeIds = collectElementIds(elements)
    try {
      const data = await patchMattingElementsApi(task.id, [
        { regionId, groupName, elementName },
      ])
      setElements(data)
      return findNewElementId(data, regionId, groupName, beforeIds)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '添加失败')
      throw e
    }
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
    if (farthestStage >= 4 && cfg.hasExtract) {
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

  const handleRegenerateElement = async (elementId: string) => {
    if (!task || isExtractBusy) return
    setExtracting(true)
    try {
      const updated = await regenerateMattingElementApi(task.id, elementId)
      setTask(updated)
      await loadExtractStatus(task.id)
      schedulePoll(task.id)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '再生成失败')
      setExtracting(false)
    }
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

  const totalElements = elements
    ? (elements.sources ?? []).reduce(
        (sum, s) => sum + s.regions.reduce((rs, r) => rs + r.groups.reduce((gs, g) => gs + g.elements.length, 0), 0),
        0,
      ) ||
      elements.regions.reduce(
        (sum, r) => sum + r.groups.reduce((gs, g) => gs + g.elements.length, 0),
        0,
      )
    : 0

  const renderFooter = () => {
    if (!task) return null

    if (viewStage === 2 && hasConfirmedSources(task)) {
      return (
        <>
          <button type="button" className={mattingFrameStyles.cancelBtn} onClick={() => setViewStage(1)}>
            上一步
          </button>
          <button
            type="button"
            className={mattingFrameStyles.primaryBtn}
            disabled={cropFooter.disabled || cropFooter.confirming || cropFooter.detecting}
            onClick={() => void cropConfirmRunRef.current?.()}
          >
            {cropFooter.confirming || cropFooter.detecting ? '处理中…' : '确认框选，进入元素识别'}
          </button>
        </>
      )
    }

    if (viewStage === 3) {
      return (
        <>
          <button type="button" className={mattingFrameStyles.cancelBtn} onClick={() => setViewStage(2)}>
            上一步
          </button>
          <span className={mattingFrameStyles.footerSelect}>每元素候选数 · {candidateCount}</span>
          <select
            className={mattingFrameStyles.footerSelect}
            value={candidateCount}
            onChange={(e) => setCandidateCount(Number(e.target.value))}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} 张
              </option>
            ))}
          </select>
          <button
            type="button"
            className={mattingFrameStyles.primaryBtn}
            disabled={totalElements === 0 || extracting}
            onClick={() => void handleConfirmExtract()}
          >
            {extracting ? '启动中…' : '开始提取'}
          </button>
        </>
      )
    }

    if (viewStage === 4) {
      return (
        <>
          <button type="button" className={mattingFrameStyles.cancelBtn} disabled={isExtractBusy} onClick={() => setViewStage(3)}>
            返回元素清单
          </button>
          <button type="button" className={mattingFrameStyles.linkBtn} disabled>
            历史生成
          </button>
          <button
            type="button"
            className={mattingFrameStyles.primaryBtn}
            disabled={isExtractBusy}
            onClick={() => setViewStage(5)}
          >
            下一步：保存
          </button>
        </>
      )
    }

    if (viewStage === 5) {
      return (
        <>
          <div className={mattingFrameStyles.footerLeft}>
            <button type="button" className={mattingFrameStyles.cancelBtn} disabled>
              历史图片
            </button>
          </div>
          <button type="button" className={mattingFrameStyles.cancelBtn} onClick={() => setViewStage(4)}>
            返回选图
          </button>
          <button
            type="button"
            className={mattingFrameStyles.primaryBtn}
            disabled={saving}
            onClick={() => void handleSaveAll()}
          >
            {saving ? '保存中…' : '保存到 Assets · matted'}
          </button>
        </>
      )
    }

    return null
  }

  const sidebar = (
    <TaskSidebar
      tasks={tasks}
      groups={groups}
      activeId={activeId}
      onSelect={(id) => void loadTask(id)}
      onNew={handleNewTask}
      onRefresh={refreshTasks}
      onDeleted={(id) => void handleDeleteTask(id)}
    />
  )

  return (
    <div className={styles.page}>
      <MattingWorkspaceFrame
        sidebar={sidebar}
        nav={
          task ? (
            <StepNav
              viewStage={viewStage}
              farthestStage={farthestStage}
              canPreviewSave={canPreviewSave}
              stepLocked={isExtractBusy}
              onStepClick={handleStepClick}
            />
          ) : undefined
        }
        footer={task ? renderFooter() : undefined}
      >
        {!task ? (
          <div className={mattingFrameStyles.welcome}>
            <span className={mattingFrameStyles.welcomeIcon} aria-hidden="true">
              <ScissorOutlined />
            </span>
            <h1 className={mattingFrameStyles.welcomeTitle}>抠图工作台 Matting</h1>
            <p className={mattingFrameStyles.welcomeHint}>从左侧新建，或选择已有记录继续操作</p>
          </div>
        ) : (
          <>
            {viewStage === 1 && (
              <MattingStage1Source
                key={task.id}
                taskId={task.id}
                sourceAssetId={task.sourceAssetId}
                sourceAssetUrl={task.sourceAssetUrl}
                configJson={task.configJson}
                onBeforeConfirm={() => handleBeforeSourceConfirm()}
                onConfirmed={handleSourceConfirmed}
              />
            )}

            {viewStage === 2 && hasConfirmedSources(task) && (
              <MattingStage2Crop
                task={task}
                hideFooter
                onRegisterConfirm={handleRegisterCropConfirm}
                onBeforeConfirm={() => handleBeforeCropConfirm()}
                onConfirmed={handleCropConfirmed}
                onDraftSaved={handleCropDraftSaved}
              />
            )}

            {viewStage === 3 && (
              <ElementListPanel
                data={elements}
                loading={loadingElements}
                detecting={detecting}
                onToggle={(id, checked) => void handleToggleElement(id, checked)}
                onRename={handleRenameElement}
                onReDetect={(regionId) => void handleReDetect(regionId)}
                onDelete={(id) => handleDeleteElement(id)}
                onAdd={handleAddElement}
              />
            )}

            {viewStage === 4 && (
              <>
                {extractStatus?.extractStatus === 'failed' && extractStatus.extractError && (
                  <Alert type="error" message={extractStatus.extractError} showIcon className={styles.alert} />
                )}
                <ElementCandidateGallery
                  status={extractStatus}
                  loading={extracting}
                  onSelectSlot={handleSelectSlot}
                  onRetryElement={(elementId) => void handleRegenerateElement(elementId)}
                />
              </>
            )}

            {viewStage === 5 &&
              (extractStatus == null ? (
                <div className={styles.stageLoading}>
                  <Spin tip="加载保存结果…" />
                </div>
              ) : (
                <MattingSavePanel
                  status={extractStatus}
                  saveSourceToAssets={saveSourceToAssets}
                  onSaveSourceChange={setSaveSourceToAssets}
                  sourceTagIds={sourceTagIds}
                  onSourceTagIdsChange={setSourceTagIds}
                  availableTags={availableTags}
                  sourceCount={sourceCount}
                />
              ))}
          </>
        )}
      </MattingWorkspaceFrame>
    </div>
  )
}
