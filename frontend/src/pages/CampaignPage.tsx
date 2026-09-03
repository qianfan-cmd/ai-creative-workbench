/**
 * CampaignPage — 活动帖工作流（多草稿 + 配图对齐抠图）
 */
import { SaveOutlined, SettingOutlined } from '@ant-design/icons'
import { Badge, Button, DatePicker, Input, message, Select, Tooltip } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useCallback, useEffect, useRef, useState } from 'react'
import styles from '@/pages/CampaignPage.module.css'
import {
  createCampaignDraft,
  deleteCampaignDraftApi,
  exportCampaignDraftApi,
  generateCopyStreamApi,
  getCampaignDraftApi,
  getStyleTemplateApi,
  getVisualStyleOptionsApi,
  listCampaignDraftsApi,
  buildCampaignCopyPayload,
  patchCampaignDraftApi,
  saveCampaignCopyApi,
  saveCampaignImagesApi,
  updateCampaignDraftApi,
  type CampaignActivityForm,
  type CampaignDraftListItemVO,
  type PromptTemplateVO,
} from '@/api/ops'
import {
  listSelectedWorkflowSourcesApi,
  workflowSourcesToPreviewUrls,
} from '@/api/workflowSource'
import CampaignDraftSidebar from '@/components/ops/CampaignDraftSidebar'
import CampaignImagePicker, {
  type CampaignImageSelection,
} from '@/components/ops/CampaignImagePicker'
import CampaignPreviewPanel from '@/components/ops/CampaignPreviewPanel'
import MattingWorkspaceFrame from '@/components/ops/MattingWorkspaceFrame'
import PromptTemplateDrawer from '@/components/ops/PromptTemplateDrawer'
import PromptTemplateHelp from '@/components/settings/PromptTemplateHelp'
import { useMainContentLayout } from '@/hooks/useMainContentLayout'

type TabKey = 'image' | 'copy' | 'preview'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'image', label: '配图' },
  { key: 'copy', label: '文案' },
  { key: 'preview', label: '预览' },
]

const FALLBACK_VISUAL_STYLE_OPTIONS = [
  { value: '夏日清新、明亮通透、清爽配色、自然光感', label: '夏日清新' },
  { value: '电竞热血、高对比、霓虹光效、动感构图、年轻潮流', label: '电竞热血' },
  { value: '简约正式、商务感、留白充足、低饱和配色、专业可信', label: '简约正式' },
]

const ASPECT_RATIO_OPTIONS = [
  { value: '16:9', label: '16:9' },
  { value: '4:3', label: '4:3' },
  { value: '1:1', label: '1:1' },
]

const DRAFT_ID_STORAGE_KEY = 'campaignActiveDraftId'
const THEME_SYNC_DEBOUNCE_MS = 400
const { RangePicker } = DatePicker

function parseTimeRangeToDates(timeRange: string): [Dayjs | null, Dayjs | null] | null {
  if (!timeRange.trim()) return null
  const parts = timeRange.split('~').map((s) => s.trim())
  if (parts.length !== 2) return null
  const start = dayjs(parts[0])
  const end = dayjs(parts[1])
  if (!start.isValid() || !end.isValid()) return null
  return [start, end]
}

function formatDateRange(dates: [Dayjs | null, Dayjs | null] | null): string {
  if (!dates?.[0]?.isValid() || !dates[1]?.isValid()) return ''
  return `${dates[0].format('YYYY-MM-DD')} ~ ${dates[1].format('YYYY-MM-DD')}`
}

function strField(activity: Record<string, unknown>, key: string): string {
  const v = activity[key]
  return v == null ? '' : String(v)
}

export default function CampaignPage() {
  useMainContentLayout({ lockScroll: true, fullBleed: true })

  const [draftList, setDraftList] = useState<CampaignDraftListItemVO[]>([])
  const [draftId, setDraftId] = useState<number | null>(null)
  const [draftStatus, setDraftStatus] = useState<string>('draft')
  const [loadingDraft, setLoadingDraft] = useState(true)

  const [theme, setTheme] = useState('')
  const [timeRange, setTimeRange] = useState('')
  const [activityDates, setActivityDates] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [audience, setAudience] = useState('')
  const [benefits, setBenefits] = useState('')
  const [visualStyle, setVisualStyle] = useState<string | undefined>(undefined)
  const [visualStyleOptions, setVisualStyleOptions] = useState(FALLBACK_VISUAL_STYLE_OPTIONS)
  const [aspectRatio, setAspectRatio] = useState<string | undefined>('16:9')
  const [forbiddenWords, setForbiddenWords] = useState('')
  const [postHashtag, setPostHashtag] = useState('#活动')
  const [promptDrawerOpen, setPromptDrawerOpen] = useState(false)

  const [activeTab, setActiveTab] = useState<TabKey>('copy')
  const [copyTitle, setCopyTitle] = useState('')
  const [copyBody, setCopyBody] = useState('')
  const [streamRaw, setStreamRaw] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [savingCopy, setSavingCopy] = useState(false)
  const [savingPost, setSavingPost] = useState(false)

  const [styleTemplates, setStyleTemplates] = useState<PromptTemplateVO[]>([])
  const [styleTemplateId, setStyleTemplateId] = useState<number | undefined>()
  const [refineHint, setRefineHint] = useState('')

  const [previewUrls, setPreviewUrls] = useState<string[]>([])

  const abortRef = useRef<AbortController | null>(null)

  const refreshPreviewFromWorkflow = useCallback(async (id: number) => {
    try {
      const selected = await listSelectedWorkflowSourcesApi({ context: 'campaign', draftId: id })
      setPreviewUrls(workflowSourcesToPreviewUrls(selected))
    } catch {
      setPreviewUrls([])
    }
  }, [])

  const refreshDraftList = useCallback(async () => {
    try {
      const list = await listCampaignDraftsApi()
      setDraftList(list)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载草稿列表失败')
    }
  }, [])

  const refreshStyleTemplates = useCallback(async () => {
    try {
      const items = await getStyleTemplateApi()
      setStyleTemplates(items)
    } catch {
      /* ignore */
    }
  }, [])

  const refreshVisualStyleOptions = useCallback(async () => {
    try {
      const items = await getVisualStyleOptionsApi()
      if (items.length === 0) return
      setVisualStyleOptions(
        items.map((t) => ({ value: t.content?.trim() || t.name, label: t.name })),
      )
    } catch {
      /* ignore */
    }
  }, [])

  const refreshPromptTemplates = useCallback(async () => {
    await Promise.all([refreshStyleTemplates(), refreshVisualStyleOptions()])
  }, [refreshStyleTemplates, refreshVisualStyleOptions])

  const applyDraftToForm = useCallback((draft: Awaited<ReturnType<typeof getCampaignDraftApi>>) => {
    const activity = draft.activity ?? {}
    setTheme(strField(activity, 'theme'))
    const tr = strField(activity, 'timeRange')
    setTimeRange(tr)
    setActivityDates(parseTimeRangeToDates(tr))
    setAudience(strField(activity, 'audience'))
    setBenefits(strField(activity, 'benefits'))
    setVisualStyle(strField(activity, 'visualStyle') || undefined)
    setAspectRatio(strField(activity, 'aspectRatio') || '16:9')
    setForbiddenWords(strField(activity, 'forbiddenWords'))
    setCopyTitle(draft.copyTitle ?? '')
    setCopyBody(draft.copyBody ?? '')
    setDraftStatus(draft.status ?? 'draft')
  }, [])

  const loadDraft = useCallback(
    async (id: number) => {
      setLoadingDraft(true)
      try {
        const draft = await getCampaignDraftApi(id)
        setDraftId(draft.id)
        applyDraftToForm(draft)
        sessionStorage.setItem(DRAFT_ID_STORAGE_KEY, String(id))
      } catch (err) {
        message.error(err instanceof Error ? err.message : '加载草稿失败')
      } finally {
        setLoadingDraft(false)
      }
    },
    [applyDraftToForm],
  )

  const resetWorkspace = () => {
    setDraftId(null)
    setDraftStatus('draft')
    setTheme('')
    setTimeRange('')
    setActivityDates(null)
    setAudience('')
    setBenefits('')
    setVisualStyle(undefined)
    setAspectRatio('16:9')
    setForbiddenWords('')
    setCopyTitle('')
    setCopyBody('')
    setPreviewUrls([])
    sessionStorage.removeItem(DRAFT_ID_STORAGE_KEY)
  }

  useEffect(() => {
    void refreshStyleTemplates()
    void refreshVisualStyleOptions()

    void refreshDraftList().then(async () => {
      const stored = sessionStorage.getItem(DRAFT_ID_STORAGE_KEY)
      if (stored && !Number.isNaN(Number(stored))) {
        await loadDraft(Number(stored))
      } else {
        setLoadingDraft(false)
      }
    })
  }, [loadDraft, refreshDraftList, refreshStyleTemplates, refreshVisualStyleOptions])

  useEffect(() => () => abortRef.current?.abort(), [])

  const buildForm = (): CampaignActivityForm => ({
    theme: theme.trim(),
    timeRange: timeRange.trim() || undefined,
    audience: audience.trim() || undefined,
    benefits: benefits.trim() || undefined,
    visualStyle: visualStyle || undefined,
    aspectRatio: aspectRatio || undefined,
    forbiddenWords: forbiddenWords.trim() || undefined,
  })

  useEffect(() => {
    if (draftId == null || loadingDraft) return

    const title = theme.trim() || '活动帖'

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          await patchCampaignDraftApi(draftId, { title })
          await updateCampaignDraftApi(draftId, buildForm())
        } catch {
          // 静默失败，用户可通过「保存草稿」重试
        }
      })()
    }, THEME_SYNC_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
    // buildForm 随渲染更新；仅在 theme 变化时 debounce 同步
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, draftId, loadingDraft])

  const handleSaveDraft = async () => {
    if (!theme.trim()) {
      message.warning('请填写活动主题')
      return
    }
    try {
      const form = buildForm()
      const draft =
        draftId != null
          ? await updateCampaignDraftApi(draftId, form)
          : await createCampaignDraft(form)
      setDraftId(draft.id)
      setDraftStatus(draft.status ?? 'draft')
      sessionStorage.setItem(DRAFT_ID_STORAGE_KEY, String(draft.id))
      await refreshDraftList()
      message.success('草稿已保存')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存草稿失败')
    }
  }

  const handleImageSelectionChange = useCallback((sel: CampaignImageSelection) => {
    setPreviewUrls(sel.previewUrls)
  }, [])

  const handleSaveFullPost = async () => {
    if (!theme.trim()) {
      message.warning('请填写活动主题')
      return
    }
    setSavingPost(true)
    try {
      let id = draftId
      const form = buildForm()
      if (id != null) {
        await updateCampaignDraftApi(id, form)
      } else {
        const created = await createCampaignDraft(form)
        id = created.id
        setDraftId(id)
      }
      if (copyTitle.trim() && copyBody.trim()) {
        await saveCampaignCopyApi(id, { copyTitle: copyTitle.trim(), copyBody: copyBody.trim() })
      }
      const saved = await saveCampaignImagesApi(id, {})
      setDraftStatus(saved.status ?? 'ready')
      await refreshPreviewFromWorkflow(id)
      sessionStorage.setItem(DRAFT_ID_STORAGE_KEY, String(id))
      await refreshDraftList()
      message.success('活动帖已保存')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSavingPost(false)
    }
  }

  const handleSaveCopy = async () => {
    if (draftId == null) {
      message.warning('请先保存左侧活动草稿')
      return
    }
    if (!copyTitle.trim() || !copyBody.trim()) {
      message.warning('标题和正文均不能为空')
      return
    }
    setSavingCopy(true)
    try {
      await saveCampaignCopyApi(draftId, {
        copyTitle: copyTitle.trim(),
        copyBody: copyBody.trim(),
      })
      message.success('文案已保存')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存文案失败')
    } finally {
      setSavingCopy(false)
    }
  }

  const handleExport = async () => {
    if (draftId == null) return
    try {
      const blob = await exportCampaignDraftApi(draftId)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `campaign-${draftId}.zip`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '导出失败')
    }
  }

  const runCopyStream = async (mode: 'draft' | 'refine') => {
    if (draftId == null) {
      message.warning('请先新建或选择活动帖')
      return
    }
    if (mode === 'draft') {
      if (!theme.trim()) {
        message.warning('请先填写活动主题')
        return
      }
      try {
        await updateCampaignDraftApi(draftId, buildForm())
      } catch (err) {
        message.error(err instanceof Error ? err.message : '同步活动信息失败')
        return
      }
    }
    if (mode === 'refine') {
      if (styleTemplateId == null) {
        message.warning('请选择风格模板')
        return
      }
      if (!copyBody.trim()) {
        message.warning('请先输入正文')
        return
      }
      await saveCampaignCopyApi(draftId, {
        copyTitle: copyTitle.trim() || theme.trim() || '未命名活动',
        copyBody: copyBody.trim(),
      })
    }
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setStreaming(true)
    setStreamRaw('')
    let accumulated = ''
    try {
      await generateCopyStreamApi(
        draftId,
        {
          mode,
          styleTemplateId: mode === 'refine' ? styleTemplateId : undefined,
          hint: mode === 'refine' ? refineHint.trim() || undefined : undefined,
          onChunk: (chunk) => {
            accumulated += chunk
            setStreamRaw(accumulated)
          },
          onDone: () => {},
        },
        ac.signal,
      )
      const fallbackTitle = copyTitle.trim() || theme.trim() || '未命名活动'
      const payload = buildCampaignCopyPayload(accumulated, fallbackTitle)
      if (!payload.copyBody.trim()) {
        message.error('文案服务未返回内容，请确认 AI 服务已启动并重试')
        return
      }
      setCopyTitle(payload.copyTitle)
      setCopyBody(payload.copyBody)
      try {
        await saveCampaignCopyApi(draftId, payload)
      } catch (saveErr) {
        message.error(saveErr instanceof Error ? saveErr.message : '文案已生成但保存失败')
        return
      }
      message.success(mode === 'draft' ? '初稿已生成' : '优化完成')
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      message.error(err instanceof Error ? err.message : '文案生成失败')
    } finally {
      setStreaming(false)
      setStreamRaw('')
    }
  }

  const handleNewDraft = async () => {
    resetWorkspace()
    setActiveTab('copy')
    try {
      const draft = await createCampaignDraft({ theme: '', aspectRatio: '16:9' })
      setDraftId(draft.id)
      sessionStorage.setItem(DRAFT_ID_STORAGE_KEY, String(draft.id))
      await refreshDraftList()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '新建活动帖失败')
    }
  }

  const handleSelectDraft = (id: number) => {
    if (id === draftId) return
    void loadDraft(id)
  }

  const handleRenameDraft = async (id: number, title: string) => {
    try {
      await patchCampaignDraftApi(id, { title })
      await refreshDraftList()
      if (draftId === id) setTheme(title)
      message.success('已重命名')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '重命名失败')
    }
  }

  const handlePinDraft = async (id: number, pinned: boolean) => {
    try {
      await patchCampaignDraftApi(id, { pinned })
      await refreshDraftList()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败')
    }
  }

  const handleDeleteDraft = async (id: number) => {
    try {
      await deleteCampaignDraftApi(id)
      await refreshDraftList()
      if (draftId === id) resetWorkspace()
      message.success('已删除')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败')
    }
  }

  const workspace = (
    <div className={styles.frame}>
      <aside className={styles.formPanel}>
        <div className={styles.formPanelHead}>
          <h2 className={styles.formTitle}>活动信息</h2>
          {draftId != null && (
            <Badge
              status={draftStatus === 'ready' ? 'success' : 'default'}
              text={draftStatus === 'ready' ? '可导出' : '草稿'}
            />
          )}
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="campaign-theme">
            活动主题 *
          </label>
          <Input
            id="campaign-theme"
            value={theme}
            onChange={(e) => {
              const next = e.target.value
              setTheme(next)
              if (draftId != null) {
                const title = next.trim() || '活动帖'
                setDraftList((prev) =>
                  prev.map((d) => (d.id === draftId ? { ...d, title } : d)),
                )
              }
            }}
            placeholder="如：夏日版本更新 · 登录即领限定皮肤"
            disabled={loadingDraft}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>活动时间</label>
          <RangePicker
            className={styles.dateRangeFull}
            value={activityDates}
            onChange={(dates) => {
              setActivityDates(dates)
              setTimeRange(formatDateRange(dates))
            }}
            disabled={loadingDraft}
            placeholder={['开始日期', '结束日期']}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>目标受众</label>
          <Input value={audience} onChange={(e) => setAudience(e.target.value)} disabled={loadingDraft} />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>福利亮点</label>
          <Input.TextArea value={benefits} onChange={(e) => setBenefits(e.target.value)} rows={3} disabled={loadingDraft} />
        </div>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className={styles.label}>视觉风格</label>
              <PromptTemplateHelp variant="visualStyle" />
            </div>
            <Select
              allowClear
              placeholder="选择风格"
              options={visualStyleOptions}
              value={visualStyle}
              onChange={setVisualStyle}
              disabled={loadingDraft}
              className={styles.selectFull}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>画幅比例</label>
            <Select
              options={ASPECT_RATIO_OPTIONS}
              value={aspectRatio}
              onChange={setAspectRatio}
              disabled={loadingDraft}
              className={styles.selectFull}
            />
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>禁用词</label>
          <Input.TextArea value={forbiddenWords} onChange={(e) => setForbiddenWords(e.target.value)} rows={2} disabled={loadingDraft} />
        </div>
        <Button
          type="primary"
          size="large"
          icon={<SaveOutlined />}
          className={styles.draftBtn}
          onClick={() => void handleSaveDraft()}
          block
        >
          保存草稿
        </Button>
      </aside>

      <div className={styles.rightPanel}>
        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className={styles.tabBody}>
          <div className={activeTab === 'image' ? styles.tabPane : styles.tabPaneHidden}>
            <CampaignImagePicker
              key={draftId ?? 'none'}
              draftId={draftId}
              aspectRatio={aspectRatio ?? '16:9'}
              onSelectionChange={handleImageSelectionChange}
            />
          </div>
          <div className={activeTab === 'copy' ? styles.tabPane : styles.tabPaneHidden}>
            <div className={styles.copyToolbar}>
              <Button type="primary" loading={streaming} disabled={draftId == null} onClick={() => void runCopyStream('draft')}>
                AI 生成初稿
              </Button>
              <div className={styles.styleSelectGroup}>
                <Select
                  placeholder="选择模板"
                  className={styles.styleSelect}
                  allowClear
                  options={styleTemplates.map((t) => ({ value: t.id, label: t.name }))}
                  value={styleTemplateId}
                  onChange={setStyleTemplateId}
                  disabled={streaming}
                />
              </div>
              <Tooltip title={refineHint.trim() || undefined} mouseEnterDelay={0.3}>
                <Input
                  placeholder="优化要求（仅 AI 优化）"
                  className={styles.hintInput}
                  value={refineHint}
                  onChange={(e) => setRefineHint(e.target.value)}
                  disabled={streaming || !copyBody.trim()}
                />
              </Tooltip>
              <Button loading={streaming} disabled={draftId == null || !copyBody.trim()} onClick={() => void runCopyStream('refine')}>
                AI 优化
              </Button>
              <Button loading={savingCopy} disabled={draftId == null || streaming} onClick={() => void handleSaveCopy()}>
                保存文案
              </Button>
              <Button type="link" icon={<SettingOutlined />} onClick={() => setPromptDrawerOpen(true)}>
                管理风格模板
              </Button>
            </div>
            <div className={styles.copyFields}>
              {streaming ? (
                <pre className={styles.streamPre}>{streamRaw || '生成中…'}</pre>
              ) : (
                <>
                  <Input value={copyTitle} onChange={(e) => setCopyTitle(e.target.value)} placeholder="标题" />
                  <div className={styles.prose}>
                    <p>
                      <strong>标题：</strong>
                      {copyTitle || '（待生成）'}
                    </p>
                    <p className={styles.proseBody}>{copyBody || '（待生成）'}</p>
                  </div>
                  <Input.TextArea value={copyBody} onChange={(e) => setCopyBody(e.target.value)} rows={8} placeholder="正文" />
                </>
              )}
            </div>
            <PromptTemplateDrawer
              open={promptDrawerOpen}
              onClose={() => setPromptDrawerOpen(false)}
              onChanged={() => void refreshPromptTemplates()}
            />
          </div>
          <div className={activeTab === 'preview' ? styles.tabPane : styles.tabPaneHidden}>
            <CampaignPreviewPanel
              imageUrls={previewUrls}
              title={copyTitle || theme.trim() || '活动标题预览'}
              body={copyBody || '生成或输入文案后在此预览。'}
              hashtag={postHashtag}
              onHashtagChange={setPostHashtag}
              aspectLabel={`${aspectRatio ?? '16:9'} 封面`}
              onSavePost={() => void handleSaveFullPost()}
              savingPost={savingPost}
              onExport={() => void handleExport()}
              exportDisabled={draftId == null}
            />
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className={styles.page}>
      <MattingWorkspaceFrame
        sidebar={
          <CampaignDraftSidebar
            drafts={draftList}
            activeId={draftId}
            onSelect={handleSelectDraft}
            onNew={handleNewDraft}
            onRename={(id, title) => void handleRenameDraft(id, title)}
            onDelete={(id) => void handleDeleteDraft(id)}
            onPin={(id, pinned) => void handlePinDraft(id, pinned)}
          />
        }
      >
        {workspace}
      </MattingWorkspaceFrame>
    </div>
  )
}
