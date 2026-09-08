import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {

    CheckOutlined,

    CopyOutlined,

    FileTextOutlined,

    PlusOutlined,

    ReloadOutlined,

    PauseCircleOutlined,

    MoreOutlined,

} from '@ant-design/icons'

import { Button, Dropdown, Input, Modal, Tooltip, message } from 'antd'
import type { MenuProps } from 'antd'

import { useMainContentLayout } from '@/hooks/useMainContentLayout'

import styles from '@/pages/KnowledgePage.module.css'

import {

    createKnowledgeSessionApi,

    deleteKnowledgeSessionApi,

    getKnowledgeSessionApi,

    listRecentKnowledgeDocumentsApi,

    listKnowledgeSessionsApi,

    patchKnowledgeSessionApi,

    ragStreamApi,

    saveKnowledgeTurnApi,

    updateKnowledgeTurnApi,

    uploadKnowledgeApi,

    type KnowledgeSessionVO,

    type RagReferenceVO,

} from '@/api/knowledge'

import AnswerRenderer from '@/components/knowledge/AnswerRenderer'
import menuStyles from '@/components/common/SessionRowMenu.module.css'
import {
  KNOWLEDGE_ACCEPT_ATTR,
  validateKnowledgeFile,
} from '@/constants/knowledgeFormats'

interface IndexedDoc {
    id: string

    filename: string

    chunkCount: number

    hasOriginalFile?: boolean

}



type RagPhase = 'retrieving' | 'generating' | 'done' | 'error'



interface RagTurn {

    /** 前端渲染用 id（新建 turn 时用 timestamp） */

    id: string

    /** MySQL 持久化 id，重新生成时用 PUT 更新 */

    dbId?: number

    question: string

    answer: string

    references: RagReferenceVO[]

    streaming?: boolean

    phase?: RagPhase

}



/** 把 API 返回的 turn 转成页面 RagTurn */

function mapTurnFromApi(turn: {

    id: number

    question: string

    answer: string

    references: RagReferenceVO[]

}): RagTurn {

    return {

        id: String(turn.id),

        dbId: turn.id,

        question: turn.question,

        answer: turn.answer ?? '',

        references: turn.references ?? [],

        phase: 'done',

        streaming: false,

    }

}



function AnswerContent({ turn }: { turn: RagTurn }) {

    return (

        <AnswerRenderer

            answer={turn.answer}

            phase={turn.phase}

            streaming={turn.streaming}

        />

    )

}



interface TurnBlockProps {

    turn: RagTurn

    copiedId: string | null

    querying: boolean

    onCopy: (copyKey: string, content: string) => void

    onRetry: (turnId: string) => void

}



function TurnBlock({ turn, copiedId, querying, onCopy, onRetry }: TurnBlockProps) {

    const showActions = !turn.streaming && Boolean(turn.answer)



    return (

        <div className={styles.turnBlock}>

            <div className={styles.userRow}>

                <div className={styles.userBody}>

                    <div className={styles.userBubble}>{turn.question}</div>

                    {turn.question && (

                        <div className={styles.userActions}>

                            <button

                                type="button"

                                className={styles.actionBtn}

                                title="复制"

                                onClick={() => onCopy(`${turn.id}-question`, turn.question)}

                            >

                                {copiedId === `${turn.id}-question` ? (

                                    <CheckOutlined />

                                ) : (

                                    <CopyOutlined />

                                )}

                            </button>

                        </div>

                    )}

                </div>

                <div className={`${styles.avatar} ${styles.avatar_user}`}>你</div>

            </div>



            <div className={styles.answerRow}>

                <div className={`${styles.avatar} ${styles.avatar_ai}`}>AI</div>

                <div className={styles.answerBody}>

                    <div className={styles.answerDoc}>

                        <AnswerContent turn={turn} />

                    </div>

                    {showActions && (

                        <div className={styles.answerActions}>

                            <button

                                type="button"

                                className={styles.actionBtn}

                                title="复制"

                                onClick={() => onCopy(`${turn.id}-answer`, turn.answer)}

                            >

                                {copiedId === `${turn.id}-answer` ? (

                                    <CheckOutlined />

                                ) : (

                                    <CopyOutlined />

                                )}

                            </button>

                            <button

                                type="button"

                                className={styles.actionBtn}

                                title="重新生成"

                                disabled={querying}

                                onClick={() => onRetry(turn.id)}

                            >

                                <ReloadOutlined />

                            </button>

                        </div>

                    )}

                </div>

            </div>



            {turn.references.length > 0 && (

                <div className={styles.references}>

                    <div className={styles.referencesLabel}>

                        引用资料 References · 共 {turn.references.length} 条

                    </div>

                    <ul className={styles.refList}>

                        {turn.references.map((ref, index) => (

                            <li key={index} className={styles.refItem}>

                                <span className={styles.refIndex}>[{index + 1}]</span>

                                <div className={styles.refBody}>

                                    <span className={styles.refSource}>

                                        {ref.source ?? `片段 ${index + 1}`}

                                    </span>

                                    <span className={styles.refExcerpt}>{ref.content}</span>

                                </div>

                            </li>

                        ))}

                    </ul>

                </div>

            )}

        </div>

    )

}



export default function KnowledgePage() {

    const navigate = useNavigate()

    const [docs, setDocs] = useState<IndexedDoc[]>([])

    const [uploading, setUploading] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)



    const [sessions, setSessions] = useState<KnowledgeSessionVO[]>([])

    const [activeSessionId, setActiveSessionId] = useState<number | null>(null)

    const [turns, setTurns] = useState<RagTurn[]>([])

    const [draft, setDraft] = useState('')

    const [querying, setQuerying] = useState(false)

    const [copiedId, setCopiedId] = useState<string | null>(null)

    const abortRef = useRef<AbortController | null>(null)



    /** 从 Chroma 拉文档库（刷新后仍在） */

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



    /** 拉历史会话侧栏 */

    const loadSessions = useCallback(async () => {

        try {

            const list = await listKnowledgeSessionsApi()

            setSessions(list)

        } catch (error) {

            message.error(error instanceof Error ? error.message : '加载历史失败')

        }

    }, [])



    useMainContentLayout({ lockScroll: true, fullBleed: true })

    // 挂载时拉文档库与历史会话
    useEffect(() => {
        let active = true
        ;(async () => {
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



    const patchTurn = useCallback((turnId: string, patch: Partial<RagTurn>) => {

        setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, ...patch } : t)))

    }, [])



    /**

     * 流式 RAG — 返回本轮最终 answer/references，供持久化到 MySQL。

     * 用局部变量累积，避免 React state 异步导致保存时拿不到最新值。

     */

    const streamTurn = useCallback(

        async (
            turnId: string,
            question: string,
            sessionId: number,
            excludeTurnId?: number,
        ) => {

            let finalAnswer = ''

            let finalRefs: RagReferenceVO[] = []



            patchTurn(turnId, {

                answer: '',

                references: [],

                streaming: true,

                phase: 'retrieving',

            })



            const controller = new AbortController()

            abortRef.current = controller



            const finishTurn = () => {

                patchTurn(turnId, { streaming: false, phase: 'done' })

            }



            try {

                await ragStreamApi(

                    question,

                    {

                        onReferences: (refs) => {

                            finalRefs = refs

                            patchTurn(turnId, { references: refs, phase: 'generating' })

                        },

                        onChunk: (chunk) => {

                            finalAnswer += chunk

                            setTurns((prev) =>

                                prev.map((t) =>

                                    t.id === turnId ? { ...t, answer: t.answer + chunk } : t,

                                ),

                            )

                        },

                        onDone: finishTurn,

                    },

                    { topK: 3, sessionId, excludeTurnId, signal: controller.signal },

                )

            } catch (error) {

                if (error instanceof DOMException && error.name === 'AbortError') {

                    finishTurn()

                    return { answer: finalAnswer, references: finalRefs }

                }

                const errMsg = error instanceof Error ? error.message : '问答失败'

                finalAnswer = errMsg

                patchTurn(turnId, { answer: errMsg, streaming: false, phase: 'error' })

            } finally {

                abortRef.current = null

            }



            return { answer: finalAnswer, references: finalRefs }

        },

        [patchTurn],

    )



    /** 确保有 activeSessionId；首次提问时自动建会话 */

    const ensureSession = useCallback(async (): Promise<number> => {

        if (activeSessionId != null) return activeSessionId

        const session = await createKnowledgeSessionApi()

        setActiveSessionId(session.id)

        setSessions((prev) => [session, ...prev])

        return session.id

    }, [activeSessionId])



    /** 流式结束后写入 MySQL */

    const persistTurn = useCallback(
        async (
            sessionId: number,
            turnId: string,
            question: string,
            dbId: number | undefined,
            payload: { answer: string; references: RagReferenceVO[] },
        ) => {
            const body = {
                question,
                answer: payload.answer,
                references: payload.references,
            }

            try {
                if (dbId) {
                    const saved = await updateKnowledgeTurnApi(sessionId, dbId, body)
                    patchTurn(turnId, { dbId: saved.id })
                } else {
                    const saved = await saveKnowledgeTurnApi(sessionId, body)
                    patchTurn(turnId, { dbId: saved.id, id: String(saved.id) })
                }
                await loadSessions()
            } catch (error) {
                message.error(error instanceof Error ? error.message : '保存问答失败')
            }
        },
        [patchTurn, loadSessions],
    )



    const handlePickFile = () => fileInputRef.current?.click()



    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {

        const file = e.target.files?.[0]

        e.target.value = ''

        if (!file) return



        const err = validateKnowledgeFile(file)

        if (err) {

            message.error(err)

            return

        }



        setUploading(true)

        try {

            const result = await uploadKnowledgeApi(file)

            message.success(`已索引 ${result.indexedCount} 个片段`)

            await loadDocuments()

        } catch (error) {

            message.error(error instanceof Error ? error.message : '上传失败')

        } finally {

            setUploading(false)

        }

    }



    const handleQuery = async () => {

        const question = draft.trim()

        if (!question || querying) return



        const turnId = String(Date.now())

        setDraft('')

        setQuerying(true)



        try {

            const sessionId = await ensureSession()



            setTurns((prev) => [

                ...prev,

                {

                    id: turnId,

                    question,

                    answer: '',

                    references: [],

                    streaming: true,

                    phase: 'retrieving',

                },

            ])



            const result = await streamTurn(turnId, question, sessionId)

            if (result && (result.answer || result.references.length > 0)) {

                await persistTurn(sessionId, turnId, question, undefined, result)

            }

        } finally {

            setQuerying(false)

        }

    }



    const handleRetry = async (turnId: string) => {

        if (querying) return

        const turn = turns.find((t) => t.id === turnId)

        if (!turn || activeSessionId == null) return



        setQuerying(true)

        try {

            const result = await streamTurn(
                turnId,
                turn.question,
                activeSessionId,
                turn.dbId,
            )

            if (result) {

                await persistTurn(activeSessionId, turnId, turn.question, turn.dbId, result)

            }

        } finally {

            setQuerying(false)

        }

    }



    const handleNewSession = async () => {

        if (querying) return

        try {

            const session = await createKnowledgeSessionApi()

            setActiveSessionId(session.id)

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
                        const detail = await getKnowledgeSessionApi(nextList[0].id)
                        setActiveSessionId(detail.id)
                        setTurns(detail.turns.map(mapTurnFromApi))
                    } else {
                        setActiveSessionId(null)
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
                const input = document.getElementById(`knowledge-rename-${session.id}`) as HTMLInputElement | null
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

            const detail = await getKnowledgeSessionApi(sessionId)

            setActiveSessionId(detail.id)

            setTurns(detail.turns.map(mapTurnFromApi))

        } catch (error) {

            message.error(error instanceof Error ? error.message : '加载会话失败')

        }

    }



    const handleCopy = async (copyKey: string, content: string) => {

        if (!content.trim()) {

            message.warning('暂无内容可复制')

            return

        }

        try {

            await navigator.clipboard.writeText(content)

            setCopiedId(copyKey)

            window.setTimeout(() => setCopiedId(null), 1000)

            message.success('复制成功')

        } catch (err) {

            message.error(`复制失败: ${err instanceof Error ? err.message : '未知错误'}`)

        }

    }



    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {

        if (e.key === 'Enter' && !querying) {

            e.preventDefault()

            void handleQuery()

        }

    }



    const handleStop = () => {

        abortRef.current?.abort()

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

                            accept={KNOWLEDGE_ACCEPT_ATTR}

                            className={styles.hiddenInput}

                            onChange={handleFileChange}

                        />

                        <Button

                            type="primary"

                            block

                            loading={uploading}

                            onClick={handlePickFile}

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
                                        <Tooltip
                                            key={doc.id}
                                            title="旧索引文档无原文件，请重新上传"
                                        >
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

                                            session.id === activeSessionId

                                                ? styles.historyItem_active

                                                : ''

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

                    <div className={styles.thread}>

                        {turns.length === 0 && !querying && (

                            <p className={styles.emptyThread}>上传文档后在此提问</p>

                        )}



                        {turns.map((turn) => (

                            <TurnBlock

                                key={turn.id}

                                turn={turn}

                                copiedId={copiedId}

                                querying={querying}

                                onCopy={handleCopy}

                                onRetry={handleRetry}

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


