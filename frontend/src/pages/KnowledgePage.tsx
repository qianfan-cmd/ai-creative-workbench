import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileTextOutlined,
  MoreOutlined,
  PauseCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { Button, Dropdown, Input, Modal, Tooltip, message } from 'antd'
import type { MenuProps } from 'antd'
import { useMainContentLayout } from '@/hooks/useMainContentLayout'
import { useStickToBottomScroll } from '@/hooks/useStickToBottomScroll'
import { useCopyFeedback } from '@/hooks/useCopyFeedback'
import styles from '@/pages/KnowledgePage.module.css'
import {
  createKnowledgeSessionApi,
  deleteKnowledgeSessionApi,
  getKnowledgeSessionApi,
  listRecentKnowledgeDocumentsApi,
  listKnowledgeSessionsApi,
  patchKnowledgeSessionApi,
  saveKnowledgeTurnApi,
  type KnowledgeSessionVO,
  type RagReferenceVO,
} from '@/api/knowledge'
import AiConversationTurn from '@/components/ai/AiConversationTurn'
import FeedbackButtons from '@/components/ai/FeedbackButtons'
import menuStyles from '@/components/common/SessionRowMenu.module.css'
import { KNOWLEDGE_ACCEPT_ATTR } from '@/constants/knowledgeFormats'
import { KNOWLEDGE_ACTIVE_SESSION_KEY, readStoredId } from '@/constants/aiSessionKeys'
import { useKnowledgeDocumentUpload } from '@/hooks/useKnowledgeDocumentUpload'
import { abortStreamByKey, runRagStream } from '@/services/aiStreamRunner'
import { useAiSessionStore } from '@/stores/aiSessionStore'
import {
  isRagStreaming,
  mergeRagTurnsWithStreams,
  type RagTurnView,
} from '@/utils/mergeAiStreams'

interface IndexedDoc {
  id: string
  filename: string
  chunkCount: number
  hasOriginalFile?: boolean
}

function mapTurnFromApi(turn: {
  id: number
  question: string
  answer: string
  references: RagReferenceVO[]
  userFeedbackRating?: 'up' | 'down'
}): RagTurnView {
  return {
    id: String(turn.id),
    dbId: turn.id,
    question: turn.question,
    answer: turn.answer ?? '',
    references: turn.references ?? [],
    phase: 'done',
    streaming: false,
    feedbackRating: turn.userFeedbackRating,
  }
}

export default function KnowledgePage() {
  const navigate = useNavigate()

  const [docs, setDocs] = useState<IndexedDoc[]>([])
  const [sessions, setSessions] = useState<KnowledgeSessionVO[]>([])
  const [turns, setTurns] = useState<RagTurnView[]>([])
  const [draft, setDraft] = useState('')
  const { copiedId, handleCopy } = useCopyFeedback()

  const activeSessionId = useAiSessionStore((s) => s.activeKnowledgeSessionId)
  const setActiveKnowledgeSessionId = useAiSessionStore((s) => s.setActiveKnowledgeSessionId)
  const streams = useAiSessionStore((s) => s.streams)

  const initialRestoreRef = useRef(false)
  const { scrollRef: threadRef, forceScrollToBottom, notifyContentChanged } =
    useStickToBottomScroll([turns, streams])

  const querying = isRagStreaming(activeSessionId, streams)

  const displayTurns = useMemo(
    () => mergeRagTurnsWithStreams(turns, activeSessionId, streams),
    [turns, activeSessionId, streams],
  )

  const loadDocuments = useCallback(async () => {
    try {
      const list = await listRecentKnowledgeDocumentsApi(50)
      setDocs(
        list.map((d) => ({
          id: String(d.id),
          filename: d.filename,
          chunkCount: d.chunkCount,
          hasOriginalFile: d.hasOriginalFile !== false,
        })),
      )
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载文档库失败')
    }
  }, [])

  const loadSessions = useCallback(async () => {
    try {
      const list = await listKnowledgeSessionsApi()
      setSessions(list)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载历史失败')
    }
  }, [])

  const loadSessionDetail = useCallback(
    async (sessionId: number) => {
      const detail = await getKnowledgeSessionApi(sessionId)
      setActiveKnowledgeSessionId(detail.id)
      setTurns(detail.turns.map(mapTurnFromApi))
      forceScrollToBottom()
      return detail
    },
    [forceScrollToBottom, setActiveKnowledgeSessionId],
  )

  const { uploading, fileInputRef, openFilePicker, handleFileChange } = useKnowledgeDocumentUpload({
    onSuccess: loadDocuments,
  })

  useMainContentLayout({ lockScroll: true, fullBleed: true })

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const [docList, sessionList] = await Promise.all([
          listRecentKnowledgeDocumentsApi(50),
          listKnowledgeSessionsApi(),
        ])
        if (!active) return
        setDocs(
          docList.map((d) => ({
            id: String(d.id),
            filename: d.filename,
            chunkCount: d.chunkCount,
            hasOriginalFile: d.hasOriginalFile !== false,
          })),
        )
        setSessions(sessionList)
      } catch (error) {
        if (!active) return
        message.error(error instanceof Error ? error.message : '加载知识库失败')
      }
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (initialRestoreRef.current) return
    initialRestoreRef.current = true
    void (async () => {
      const storedId =
        readStoredId(KNOWLEDGE_ACTIVE_SESSION_KEY) ??
        useAiSessionStore.getState().activeKnowledgeSessionId
      if (!storedId) return
      try {
        await loadSessionDetail(storedId)
      } catch {
        setActiveKnowledgeSessionId(null)
      }
    })()
  }, [loadSessionDetail, setActiveKnowledgeSessionId])

  useEffect(() => {
    notifyContentChanged()
  }, [displayTurns, notifyContentChanged])

  const ensureSession = useCallback(async (): Promise<number> => {
    if (activeSessionId != null) return activeSessionId

    const session = await createKnowledgeSessionApi()
    setActiveKnowledgeSessionId(session.id)
    setSessions((prev) => [session, ...prev])
    return session.id
  }, [activeSessionId, setActiveKnowledgeSessionId])

  const handleQuery = async () => {
    const question = draft.trim()
    if (!question || querying) return

    setDraft('')

    try {
      const sessionId = await ensureSession()
      setActiveKnowledgeSessionId(sessionId)

      const saved = await saveKnowledgeTurnApi(sessionId, {
        question,
        answer: '',
        references: [],
      })

      const turnId = String(saved.id)
      setTurns((prev) => [
        ...prev,
        {
          id: turnId,
          dbId: saved.id,
          question,
          answer: '',
          references: [],
          streaming: true,
          phase: 'retrieving',
        },
      ])
      forceScrollToBottom()

      void runRagStream({
        sessionId,
        turnDbId: saved.id,
        question,
        onComplete: async () => {
          await loadSessions()
          try {
            const detail = await getKnowledgeSessionApi(sessionId)
            setTurns(detail.turns.map(mapTurnFromApi))
          } catch {
            // keep merged store state
          }
        },
      }).catch((error) => {
        message.error(error instanceof Error ? error.message : '问答失败')
      })
    } catch (error) {
      message.error(error instanceof Error ? error.message : '发送失败')
    }
  }

  const handleRetry = async (turnId: string) => {
    if (querying) return

    const turn = turns.find((t) => t.id === turnId)
    if (!turn || activeSessionId == null || turn.dbId == null) return

    setTurns((prev) =>
      prev.map((t) =>
        t.id === turnId
          ? { ...t, answer: '', references: [], streaming: true, phase: 'retrieving' }
          : t,
      ),
    )
    forceScrollToBottom()

    void runRagStream({
      sessionId: activeSessionId,
      turnDbId: turn.dbId,
      question: turn.question,
      excludeTurnId: turn.dbId,
      onComplete: async () => {
        try {
          const detail = await getKnowledgeSessionApi(activeSessionId)
          setTurns(detail.turns.map(mapTurnFromApi))
        } catch {
          // ignore
        }
      },
    }).catch((error) => {
      message.error(error instanceof Error ? error.message : '重新生成失败')
    })
  }

  const handleNewSession = async () => {
    if (querying) return

    try {
      const session = await createKnowledgeSessionApi()
      setActiveKnowledgeSessionId(session.id)
      setTurns([])
      setSessions((prev) => [session, ...prev])
    } catch (error) {
      message.error(error instanceof Error ? error.message : '创建会话失败')
    }
  }

  const handleDeleteSession = (session: KnowledgeSessionVO) => {
    Modal.confirm({
      title: '删除问答',
      content: `确定删除「${session.title}」吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await deleteKnowledgeSessionApi(session.id)
        message.success('已删除')
        const nextList = sessions.filter((s) => s.id !== session.id)
        setSessions(nextList)
        if (activeSessionId === session.id) {
          if (nextList.length > 0) {
            await loadSessionDetail(nextList[0].id)
          } else {
            setActiveKnowledgeSessionId(null)
            setTurns([])
          }
        }
      },
    })
  }

  const handlePinSession = async (session: KnowledgeSessionVO) => {
    try {
      await patchKnowledgeSessionApi(session.id, { pinned: !session.pinned })
      await loadSessions()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '操作失败')
    }
  }

  const handleRenameSession = (session: KnowledgeSessionVO) => {
    Modal.confirm({
      title: '重命名',
      content: (
        <input
          id={`knowledge-rename-${session.id}`}
          defaultValue={session.title}
          maxLength={30}
          style={{
            width: '100%',
            padding: 8,
            border: '1px solid var(--color-border)',
            borderRadius: 6,
          }}
        />
      ),
      onOk: async () => {
        const input = document.getElementById(
          `knowledge-rename-${session.id}`,
        ) as HTMLInputElement | null
        const title = input?.value?.trim()
        if (!title) {
          message.warning('标题不能为空')
          throw new Error('empty')
        }
        await patchKnowledgeSessionApi(session.id, { title })
        await loadSessions()
      },
    })
  }

  const handleSelectSession = async (sessionId: number) => {
    if (querying || sessionId === activeSessionId) return

    try {
      await loadSessionDetail(sessionId)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载会话失败')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !querying) {
      e.preventDefault()
      void handleQuery()
    }
  }

  const handleStop = () => {
    if (activeSessionId == null) return
    const activeStream = Object.values(streams).find(
      (s) =>
        s.module === 'rag' &&
        s.meta.sessionId === activeSessionId &&
        s.status === 'streaming',
    )
    if (activeStream) {
      abortStreamByKey(activeStream.key)
    }
  }

  const handlePrimaryAction = () => {
    if (querying) handleStop()
    else void handleQuery()
  }

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <aside className={styles.leftColumn}>
          <div className={styles.docSection}>
            <div className={styles.docSectionHeaderRow}>
              <div className={styles.docSectionHeader}>文档库</div>
              <button
                type="button"
                className={styles.docMoreBtn}
                onClick={() => navigate('/knowledge/documents')}
              >
                更多
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={KNOWLEDGE_ACCEPT_ATTR}
              className={styles.hiddenInput}
              onChange={(e) => void handleFileChange(e)}
            />

            <Button
              type="primary"
              htmlType="button"
              block
              loading={uploading}
              onClick={openFilePicker}
              className={styles.uploadBtn}
            >
              上传文档
            </Button>

            <div className={styles.docList}>
              {docs.length === 0 ? (
                <p className={styles.emptyDocs}>暂无文档</p>
              ) : (
                docs.map((doc) => {
                  const canEdit = doc.hasOriginalFile !== false
                  const docContent = (
                    <>
                      <FileTextOutlined className={styles.docIcon} />
                      <div className={styles.docMeta}>
                        <span className={styles.docName} title={doc.filename}>
                          {doc.filename}
                        </span>
                        <span className={styles.docChunks}>{doc.chunkCount} chunks</span>
                      </div>
                    </>
                  )

                  if (canEdit) {
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        className={`${styles.docItem} ${styles.docItemBtn}`}
                        onClick={() => navigate(`/knowledge/documents/${doc.id}`)}
                      >
                        {docContent}
                      </button>
                    )
                  }

                  return (
                    <Tooltip key={doc.id} title="旧索引文档无原文件，请重新上传">
                      <div className={`${styles.docItem} ${styles.docItemDisabled}`}>
                        {docContent}
                      </div>
                    </Tooltip>
                  )
                })
              )}
            </div>
          </div>

          <div className={styles.divider} />

          <div className={styles.historySection}>
            <button
              type="button"
              className={styles.newQuestionBtn}
              onClick={() => void handleNewSession()}
              disabled={querying}
            >
              <PlusOutlined />
              新问答
            </button>
            <div className={styles.historyHeader}>历史问答</div>
            <nav className={styles.historyList}>
              {sessions.length === 0 ? (
                <p className={styles.emptyHistory}>暂无历史</p>
              ) : (
                sessions.map((session) => {
                  const sessionMenuItems: MenuProps['items'] = [
                    {
                      key: 'pin',
                      label: session.pinned ? '取消置顶' : '置顶',
                      onClick: () => void handlePinSession(session),
                    },
                    {
                      key: 'rename',
                      label: '重命名',
                      onClick: () => handleRenameSession(session),
                    },
                    { type: 'divider' },
                    {
                      key: 'delete',
                      label: '删除',
                      danger: true,
                      onClick: () => handleDeleteSession(session),
                    },
                  ]
                  return (
                    <div key={session.id} className={menuStyles.rowWrap}>
                      <button
                        type="button"
                        className={`${styles.historyItem} ${menuStyles.rowBtn} ${
                          session.id === activeSessionId ? styles.historyItem_active : ''
                        }`}
                        title={session.title}
                        onClick={() => void handleSelectSession(session.id)}
                      >
                        {session.pinned && (
                          <span className={styles.pinMark} aria-hidden="true">
                            ★
                          </span>
                        )}
                        <span className={styles.historyTitle}>{session.title}</span>
                      </button>
                      <Dropdown menu={{ items: sessionMenuItems }} trigger={['click']}>
                        <button type="button" className={menuStyles.menuBtn} aria-label="会话菜单">
                          <MoreOutlined />
                        </button>
                      </Dropdown>
                    </div>
                  )
                })
              )}
            </nav>
          </div>
        </aside>

        <section className={styles.main}>
          <div className={styles.thread} ref={threadRef}>
            {displayTurns.length === 0 && !querying && (
              <p className={styles.emptyThread}>上传文档后在此提问</p>
            )}

            {displayTurns.map((turn) => (
              <AiConversationTurn
                key={turn.id}
                question={turn.question}
                answer={turn.answer}
                references={turn.references}
                streaming={turn.streaming}
                phase={turn.phase}
                copiedQuestionKey={`${turn.id}-question`}
                copiedAnswerKey={`${turn.id}-answer`}
                copiedId={copiedId}
                retryDisabled={querying}
                onCopy={(key, content) => void handleCopy(key, content)}
                onRetry={() => void handleRetry(turn.id)}
                feedback={
                  <FeedbackButtons
                    scene="rag"
                    refType="knowledge_turn"
                    refId={turn.dbId}
                    initialRating={turn.feedbackRating ?? null}
                  />
                }
              />
            ))}
          </div>

          <div className={styles.composer}>
            <Input
              placeholder="继续提问…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={querying}
            />
            <Button
              type="primary"
              icon={querying ? <PauseCircleOutlined /> : undefined}
              onClick={handlePrimaryAction}
              disabled={!querying && !draft.trim()}
            >
              {querying ? '停止生成' : '提问'}
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
