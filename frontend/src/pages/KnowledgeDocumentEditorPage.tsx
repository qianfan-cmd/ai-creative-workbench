import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { Alert, Button, Modal, Spin, message } from 'antd'
import {
  getKnowledgeDocumentContentApi,
  saveKnowledgeDocumentContentApi,
  type KnowledgeDocumentContentVO,
} from '@/api/knowledge'
import MarkdownDocViewer from '@/components/knowledge/MarkdownDocViewer'
import { useMainContentLayout } from '@/hooks/useMainContentLayout'
import styles from '@/pages/KnowledgeDocumentEditorPage.module.css'
import MarkdownSourceEditor from '@/components/knowledge/MarkdownSourceEditor'
import { useScrollSync } from '@/hooks/useScrollSync'
import { isBinaryKnowledgeFile } from '@/constants/knowledgeFormats'

function isPlainText(fileType?: string, filename?: string) {
  if (fileType === 'text/plain') return true
  return Boolean(filename?.toLowerCase().endsWith('.txt'))
}

export default function KnowledgeDocumentEditorPage() {
  const navigate = useNavigate()
  const { id: idParam } = useParams()
  const docId = Number.parseInt(idParam ?? '', 10)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [readOnlyHintOpen, setReadOnlyHintOpen] = useState(true)
  const [meta, setMeta] = useState<KnowledgeDocumentContentVO | null>(null)
  const [saved, setSaved] = useState('')
  const [draft, setDraft] = useState('')

  const [sourceScrollEl, setSourceScrollEl] = useState<HTMLElement | null>(null)
  const [previewScrollEl, setPreviewScrollEl] = useState<HTMLElement | null>(null)

  useScrollSync(sourceScrollEl, previewScrollEl)

  const plainText = useMemo(
    () => isPlainText(meta?.fileType, meta?.filename),
    [meta?.fileType, meta?.filename],
  )
  const readOnly = useMemo(
    () => isBinaryKnowledgeFile(meta?.filename, meta?.fileType),
    [meta?.filename, meta?.fileType],
  )

  const dirty = !readOnly && draft !== saved

  useMainContentLayout({ fullBleed: true, lockScroll: true })

  const loadContent = useCallback(async () => {
    if (!Number.isFinite(docId) || docId <= 0) {
      message.error('文档 ID 无效')
      navigate('/knowledge/documents', { replace: true })
      return
    }
    setLoading(true)
    try {
      const data = await getKnowledgeDocumentContentApi(docId)
      setMeta(data)
      setSaved(data.content)
      setDraft(data.content)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载文档失败')
      navigate('/knowledge/documents', { replace: true })
    } finally {
      setLoading(false)
    }
  }, [docId, navigate])

  useEffect(() => {
    void loadContent()
    setReadOnlyHintOpen(true)
  }, [loadContent])

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const goBack = () => {
    if (!dirty) {
      navigate('/knowledge/documents')
      return
    }
    Modal.confirm({
      title: '未保存的更改',
      content: '当前修改尚未保存，确定离开吗？',
      okText: '离开',
      cancelText: '继续编辑',
      onOk: () => navigate('/knowledge/documents'),
    })
  }

  const handleSave = useCallback(async () => {
    if (readOnly || !Number.isFinite(docId) || docId <= 0) return
    setSaving(true)
    try {
      await saveKnowledgeDocumentContentApi(docId, draft)
      setSaved(draft)
      message.success('已保存，知识库索引已更新')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }, [docId, draft, readOnly])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (dirty && !saving) void handleSave()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dirty, saving, handleSave])

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <Spin tip="加载文档…" />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <Button
            type="link"
            icon={<ArrowLeftOutlined />}
            className={styles.backBtn}
            onClick={goBack}
          >
            文档库
          </Button>
          <div className={styles.titleWrap}>
            <h1 className={styles.title} title={meta?.filename}>
              {meta?.filename ?? '文档'}
            </h1>
            <p className={styles.subtitle}>
              {readOnly
                ? 'PDF/DOCX 已索引 · 下方为提取文本预览（只读，请重新上传以更新）'
                : '左栏编辑源码，右栏实时预览 · 保存后自动更新 RAG 索引'}
            </p>
          </div>
        </div>
        <div className={styles.toolbarRight}>
          {dirty && <span className={styles.dirtyBadge}>未保存</span>}
          {!readOnly && (
            <Button
              type="primary"
              loading={saving}
              disabled={!dirty}
              onClick={() => {
                void handleSave()
              }}
            >
              {saving ? '保存并索引中…' : '保存'}
            </Button>
          )}
        </div>
      </header>

      {readOnly && readOnlyHintOpen && (
        <Alert
          type="info"
          showIcon
          closable
          onClose={() => setReadOnlyHintOpen(false)}
          message="PDF/DOCX 已索引，仅预览提取文本；更新请删除后重新上传"
          className={styles.readOnlyAlert}
        />
      )}

      <div className={styles.split}>
        <section className={styles.pane}>
          <div className={styles.paneHeader}>{readOnly ? '提取文本' : '源码'}</div>
          <div className={`${styles.paneBody} ${styles.sourcePaneBody}`}>
            {readOnly ? (
              <pre
                ref={(el) => setSourceScrollEl(el)}
                className={styles.sourceInput}
              >
                {draft}
              </pre>
            ) : (
              <MarkdownSourceEditor
                value={draft}
                onChange={setDraft}
                plainText={plainText}
                onScrollContainerReady={setSourceScrollEl}
              />
            )}
          </div>
        </section>
        <section className={styles.pane}>
          <div className={styles.paneHeader}>预览</div>
          <div
            ref={setPreviewScrollEl}
            className={`${styles.paneBody} ${styles.previewBody}`}
          >
            <MarkdownDocViewer content={draft} plainText={plainText || readOnly} />
          </div>
        </section>
      </div>
    </div>
  )
}
