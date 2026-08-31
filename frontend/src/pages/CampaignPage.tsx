/**
 * CampaignPage — 活动帖工作流（模块 B）
 */
import { SaveOutlined } from '@ant-design/icons'
import { Button, DatePicker, Input, message, Select } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useCallback, useEffect, useRef, useState } from 'react'
import styles from '@/pages/CampaignPage.module.css'
import {
  createCampaignDraft,
  generateCampaignImagesApi,
  generateCopyStreamApi,
  getCampaignDraftApi,
  getStyleTemplateApi,
  parseCampaignCopyFromLlm,
  saveCampaignCopyApi,
  saveCampaignImagesApi,
  exportCampaignDraftApi,
  updateCampaignDraftApi,
  type CampaignActivityForm,
  type ImageCandidateVO,
  type PromptTemplateVO,
} from '@/api/ops'
import type { AssetVO } from '@/types/api'
import CandidateGallery from '@/components/ops/CandidateGallery'
import CampaignPostCard from '@/components/ops/CampaignPostCard'
import ImageSourcePanel from '@/components/ops/ImageSourcePanel'
import TagAssetDialog from '@/components/ops/TagAssetDialog'

type TabKey = 'image' | 'copy' | 'preview'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'image', label: '配图' },
  { key: 'copy', label: '文案' },
  { key: 'preview', label: '预览' },
]

const VISUAL_STYLE_OPTIONS = [
  { value: '夏日清新', label: '夏日清新' },
  { value: '电竞热血', label: '电竞热血' },
  { value: '简约正式', label: '简约正式' },
]

const ASPECT_RATIO_OPTIONS = [
  { value: '16:9', label: '16:9' },
  { value: '4:3', label: '4:3' },
  { value: '1:1', label: '1:1' },
]

const DRAFT_ID_STORAGE_KEY = 'campaignActiveDraftId'
const { RangePicker } = DatePicker

/** timeRange 字符串 ↔ RangePicker 值 */
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

export default function CampaignPage() {
  const [draftId, setDraftId] = useState<number | null>(null)
  const [loadingDraft, setLoadingDraft] = useState(() => {
    const stored = sessionStorage.getItem(DRAFT_ID_STORAGE_KEY)
    return !!(stored && !Number.isNaN(Number(stored)))
  })

  const [theme, setTheme] = useState('')
  const [timeRange, setTimeRange] = useState('')
  const [activityDates, setActivityDates] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [audience, setAudience] = useState('')
  const [benefits, setBenefits] = useState('')
  const [visualStyle, setVisualStyle] = useState<string | undefined>(undefined)
  const [aspectRatio, setAspectRatio] = useState<string | undefined>('16:9')
  const [forbiddenWords, setForbiddenWords] = useState('')

  const [activeTab, setActiveTab] = useState<TabKey>('copy')

  const [copyTitle, setCopyTitle] = useState('')
  const [copyBody, setCopyBody] = useState('')
  const [streamRaw, setStreamRaw] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [savingCopy, setSavingCopy] = useState(false)

  const [styleTemplates, setStyleTemplates] = useState<PromptTemplateVO[]>([])
  const [styleTemplateId, setStyleTemplateId] = useState<number | undefined>()
  const [refineHint, setRefineHint] = useState('')

  const [sourceAssetId, setSourceAssetId] = useState<number | null>(null)
  const [sourceAssetUrl, setSourceAssetUrl] = useState<string | null>(null)
  const [imageCandidates, setImageCandidates] = useState<ImageCandidateVO[]>([])
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
  const [generatingImages, setGeneratingImages] = useState(false)
  const [savingImages, setSavingImages] = useState(false)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [tagDialogOpen, setTagDialogOpen] = useState(false)
  const [tagDialogUrl, setTagDialogUrl] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  const applyDraftToForm = useCallback(
    (
      activity: Record<string, string>,
      draftCopyTitle?: string | null,
      draftCopyBody?: string | null,
      draftCoverUrl?: string | null,
    ) => {
      setTheme(activity.theme ?? '')
      const tr = activity.timeRange ?? ''
      setTimeRange(tr)
      setActivityDates(parseTimeRangeToDates(tr))
      setAudience(activity.audience ?? '')
      setBenefits(activity.benefits ?? '')
      setVisualStyle(activity.visualStyle || undefined)
      setAspectRatio(activity.aspectRatio || '16:9')
      setForbiddenWords(activity.forbiddenWords ?? '')
      setCopyTitle(draftCopyTitle ?? '')
      setCopyBody(draftCopyBody ?? '')
      setCoverUrl(draftCoverUrl ?? null)
    },
    [],
  )

  useEffect(() => {
    void getStyleTemplateApi()
      .then(setStyleTemplates)
      .catch((err) => message.error(err instanceof Error ? err.message : '加载风格模板失败'))

    const stored = sessionStorage.getItem(DRAFT_ID_STORAGE_KEY)
    if (!stored) return

    const id = Number(stored)
    if (Number.isNaN(id)) return

    void getCampaignDraftApi(id)
      .then((draft) => {
        setDraftId(draft.id)
        applyDraftToForm(draft.activity ?? {}, draft.copyTitle, draft.copyBody, draft.coverUrl)
      })
      .catch(() => {
        sessionStorage.removeItem(DRAFT_ID_STORAGE_KEY)
      })
      .finally(() => setLoadingDraft(false))
  }, [applyDraftToForm])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const buildForm = (): CampaignActivityForm => ({
    theme: theme.trim(),
    timeRange: timeRange.trim() || undefined,
    audience: audience.trim() || undefined,
    benefits: benefits.trim() || undefined,
    visualStyle: visualStyle || undefined,
    aspectRatio: aspectRatio || undefined,
    forbiddenWords: forbiddenWords.trim() || undefined,
  })

  const handleActivityDatesChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    setActivityDates(dates)
    setTimeRange(formatDateRange(dates))
  }

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
      sessionStorage.setItem(DRAFT_ID_STORAGE_KEY, String(draft.id))
      message.success('草稿已保存')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存草稿失败')
    }
  }

  /** 手动保存文案（不调 LLM） */
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

  const handleSelectSourceAsset = (asset: AssetVO) => {
    setSourceAssetId(asset.id)
    setSourceAssetUrl(asset.url)
  }

  const handleGenerateImages = async () => {
    if (draftId == null) {
      message.warning('请先保存草稿')
      return
    }
    setGeneratingImages(true)
    try {
      const job = await generateCampaignImagesApi(draftId, {
        sourceAssetId: sourceAssetId ?? undefined,
        count: 4,
      })
      setImageCandidates(job.candidates)
      setSelectedImageIndex(job.candidates[0]?.index ?? null)
      message.success(`已生成 ${job.candidates.length} 张（${job.providerUsed}）`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '生图失败')
    } finally {
      setGeneratingImages(false)
    }
  }

  const handleSaveCover = async () => {
    if (draftId == null || selectedImageIndex == null) return
    const url = imageCandidates.find((c) => c.index === selectedImageIndex)?.url
    if (!url) return
    setSavingImages(true)
    try {
      setTagDialogUrl(url)
      setTagDialogOpen(true)
    } finally {
      setSavingImages(false)
    }
  }

  const handleTagSaved = async (assetId: number) => {
    if (draftId == null) return
    const draft = await saveCampaignImagesApi(draftId, {
      coverAssetId: assetId,
      imageAssetIds: [assetId],
    })
    setCoverUrl(draft.coverUrl ?? null)
    message.success('封面已保存到草稿')
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

  const persistCopyFromStream = async (accumulated: string, mode: 'draft' | 'refine') => {
    const trimmed = accumulated.trim()
    if (!trimmed) {
      message.error('文案生成失败：未收到模型输出，请确认 Python 服务已启动')
      return
    }

    const parsed = parseCampaignCopyFromLlm(trimmed)
    const payload = parsed ?? {
      copyTitle: copyTitle.trim() || theme.trim() || '未命名活动',
      copyBody: trimmed,
    }

    if (!payload.copyBody.trim()) {
      message.error('正文为空，未保存')
      return
    }

    setCopyTitle(payload.copyTitle)
    setCopyBody(payload.copyBody)

    if (draftId == null) return
    await saveCampaignCopyApi(draftId, payload)

    if (parsed) {
      message.success(mode === 'draft' ? '初稿已生成并保存' : '优化完成并已保存')
    } else {
      message.warning('模型未返回标准 JSON，已按纯文本保存正文')
    }
  }

  const runCopyStream = async (mode: 'draft' | 'refine') => {
    if (draftId == null) {
      message.warning('请先点击左侧「保存草稿」')
      return
    }
    if (mode === 'refine') {
      if (styleTemplateId == null) {
        message.warning('请选择风格模板')
        return
      }
      if (!copyBody.trim()) {
        message.warning('请先输入正文，或使用「AI 生成初稿」')
        return
      }
      // 优化前把输入框内容同步到 DB，供后端 refine 读取
      try {
        await saveCampaignCopyApi(draftId, {
          copyTitle: copyTitle.trim() || theme.trim() || '未命名活动',
          copyBody: copyBody.trim(),
        })
      } catch (err) {
        message.error(err instanceof Error ? err.message : '同步文案失败')
        return
      }
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

      await persistCopyFromStream(accumulated, mode)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      message.error(err instanceof Error ? err.message : '文案生成失败')
    } finally {
      setStreaming(false)
      setStreamRaw('')
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>活动帖 Campaign</h1>
        <p className={styles.pageDesc}>填写活动信息，AI 生成文案与配图草稿包</p>
      </header>

      <div className={styles.frame}>
        <aside className={styles.formPanel}>
          <div className={styles.formPanelHead}>
            <h2 className={styles.formTitle}>活动信息</h2>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="campaign-theme">
              活动主题 *
            </label>
            <Input
              id="campaign-theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="如：夏日版本更新 · 登录即领限定皮肤"
              disabled={loadingDraft}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="campaign-time">
              活动时间
            </label>
            <RangePicker
              id="campaign-time"
              className={styles.dateRangeFull}
              value={activityDates}
              onChange={handleActivityDatesChange}
              disabled={loadingDraft}
              placeholder={['开始日期', '结束日期']}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="campaign-audience">
              目标受众
            </label>
            <Input
              id="campaign-audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="如：活跃玩家 · 回归用户"
              disabled={loadingDraft}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="campaign-benefits">
              福利亮点
            </label>
            <Input.TextArea
              id="campaign-benefits"
              value={benefits}
              onChange={(e) => setBenefits(e.target.value)}
              placeholder="限定皮肤、登录礼包、每日任务兑换"
              rows={3}
              disabled={loadingDraft}
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="campaign-visual">
                视觉风格
              </label>
              <Select
                id="campaign-visual"
                allowClear
                placeholder="选择风格"
                options={VISUAL_STYLE_OPTIONS}
                value={visualStyle}
                onChange={setVisualStyle}
                disabled={loadingDraft}
                className={styles.selectFull}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="campaign-aspect">
                画幅比例
              </label>
              <Select
                id="campaign-aspect"
                options={ASPECT_RATIO_OPTIONS}
                value={aspectRatio}
                onChange={setAspectRatio}
                disabled={loadingDraft}
                className={styles.selectFull}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="campaign-forbidden">
              禁用词
            </label>
            <Input.TextArea
              id="campaign-forbidden"
              value={forbiddenWords}
              onChange={(e) => setForbiddenWords(e.target.value)}
              placeholder="绝对、第一、100% 中奖"
              rows={2}
              disabled={loadingDraft}
            />
          </div>

          <Button
            type="primary"
            size="large"
            icon={<SaveOutlined />}
            className={styles.draftBtn}
            onClick={() => void handleSaveDraft()}
            loading={loadingDraft}
            block
          >
            保存草稿
          </Button>
        </aside>

        <div className={styles.rightPanel}>
          <div className={styles.tabs} role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={styles.tabBody}>
            {activeTab === 'image' && (
              <>
                <ImageSourcePanel
                  contextLabel="参考图"
                  selectedAssetId={sourceAssetId}
                  selectedAssetUrl={sourceAssetUrl}
                  onSelectAsset={handleSelectSourceAsset}
                />
                <div className={styles.copyToolbar}>
                  <Button
                    type="primary"
                    loading={generatingImages}
                    disabled={draftId == null}
                    onClick={() => void handleGenerateImages()}
                  >
                    生成 4 张候选
                  </Button>
                  <Button
                    loading={savingImages}
                    disabled={selectedImageIndex == null}
                    onClick={() => void handleSaveCover()}
                  >
                    选为封面并入库
                  </Button>
                </div>
                {imageCandidates.length > 0 && (
                  <CandidateGallery
                    candidates={imageCandidates}
                    selectedIndex={selectedImageIndex}
                    onSelect={setSelectedImageIndex}
                  />
                )}
                <TagAssetDialog
                  open={tagDialogOpen}
                  imageUrl={tagDialogUrl}
                  defaultTags={['generated']}
                  onClose={() => setTagDialogOpen(false)}
                  onSaved={(id) => void handleTagSaved(id)}
                />
              </>
            )}

            {activeTab === 'copy' && (
              <>
                <div className={styles.copyToolbar}>
                  <Button
                    type="primary"
                    loading={streaming}
                    disabled={draftId == null}
                    onClick={() => void runCopyStream('draft')}
                  >
                    AI 生成初稿
                  </Button>

                  <Select
                    placeholder="风格模板"
                    className={styles.styleSelect}
                    allowClear
                    options={styleTemplates.map((t) => ({
                      value: t.id,
                      label: t.name,
                    }))}
                    value={styleTemplateId}
                    onChange={setStyleTemplateId}
                    disabled={streaming}
                  />

                  <Input
                    placeholder="优化补充（可选）"
                    className={styles.hintInput}
                    value={refineHint}
                    onChange={(e) => setRefineHint(e.target.value)}
                    disabled={streaming}
                  />

                  <Button
                    loading={streaming}
                    disabled={draftId == null || !copyBody.trim()}
                    onClick={() => void runCopyStream('refine')}
                  >
                    AI 优化
                  </Button>

                  <Button
                    loading={savingCopy}
                    disabled={draftId == null || streaming}
                    onClick={() => void handleSaveCopy()}
                  >
                    保存文案
                  </Button>
                </div>

                <div className={styles.copyFields}>
                  <label className={styles.copyFieldLabel} htmlFor="copy-title">
                    标题
                  </label>
                  <Input
                    id="copy-title"
                    value={copyTitle}
                    onChange={(e) => setCopyTitle(e.target.value)}
                    placeholder="可手动输入，或由 AI 生成后编辑"
                    disabled={streaming}
                  />

                  <label className={styles.copyFieldLabel} htmlFor="copy-body">
                    正文
                  </label>
                  {streaming ? (
                    <pre className={styles.streamPre}>{streamRaw || '生成中…'}</pre>
                  ) : (
                    <Input.TextArea
                      id="copy-body"
                      value={copyBody}
                      onChange={(e) => setCopyBody(e.target.value)}
                      placeholder="可手动输入活动正文，再选风格模板点击「AI 优化」"
                      rows={10}
                    />
                  )}

                  {!streaming && !copyTitle && !copyBody && (
                    <p className={styles.copyHint}>
                      两种方式：① 点「AI 生成初稿」由模型写；② 在下方直接输入标题和正文，再「AI
                      优化」或「保存文案」。
                    </p>
                  )}
                </div>
              </>
            )}

            {activeTab === 'preview' && (
              <>
                <CampaignPostCard
                  coverUrl={coverUrl ?? imageCandidates.find((c) => c.index === selectedImageIndex)?.url}
                  title={copyTitle || theme.trim() || '活动标题预览'}
                  body={copyBody || '生成或输入文案后在此预览牛客帖效果。'}
                  aspectLabel={`${aspectRatio ?? '16:9'} 封面`}
                />
                <div className={styles.copyToolbar}>
                  <Button disabled={draftId == null} onClick={() => void handleExport()}>
                    下载草稿包 zip
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
