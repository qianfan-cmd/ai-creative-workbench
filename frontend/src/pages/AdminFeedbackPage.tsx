import { useCallback, useEffect, useState } from 'react'
import { Button, Modal, Popconfirm, Space, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  clearSourceSignalApi,
  getAdminFeedbackStatsApi,
  listAdminFeedbackDownsApi,
  listAdminRagActionsApi,
  listSourceSignalsApi,
  reindexAllKnowledgeApi,
  type AiFeedbackDownItem,
  type AiFeedbackStats,
  type KnowledgeReindexAllResult,
  type RagFeedbackActionItem,
  type RagSourceSignalClearField,
  type RagSourceSignalItem,
} from '@/api/adminFeedback'
import { useMainContentLayout } from '@/hooks/useMainContentLayout'
import { showApiError } from '@/utils/apiError'
import { formatDate } from '@/utils/format'
import styles from '@/pages/AdminFeedbackPage.module.css'

const PAGE_SIZE = 20

const REASON_LABEL: Record<string, string> = {
  incomplete_list: '列举不全',
  wrong_fact: '事实错误',
  irrelevant: '答非所问',
  other: '其他',
}

export default function AdminFeedbackPage() {
  const [statsLoading, setStatsLoading] = useState(false)
  const [stats, setStats] = useState<AiFeedbackStats | null>(null)

  const [downsLoading, setDownsLoading] = useState(false)
  const [downs, setDowns] = useState<AiFeedbackDownItem[]>([])
  const [downsPage, setDownsPage] = useState(1)
  const [downsTotal, setDownsTotal] = useState(0)

  const [actionsLoading, setActionsLoading] = useState(false)
  const [ragActions, setRagActions] = useState<RagFeedbackActionItem[]>([])
  const [actionsPage, setActionsPage] = useState(1)
  const [actionsTotal, setActionsTotal] = useState(0)

  const [signalsLoading, setSignalsLoading] = useState(false)
  const [signals, setSignals] = useState<RagSourceSignalItem[]>([])
  const [signalsPage, setSignalsPage] = useState(1)
  const [signalsTotal, setSignalsTotal] = useState(0)

  const [reindexing, setReindexing] = useState(false)
  const [reindexResult, setReindexResult] = useState<KnowledgeReindexAllResult | null>(null)

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const statsData = await getAdminFeedbackStatsApi()
      setStats(statsData)
    } catch (error) {
      showApiError(error, '加载反馈统计失败')
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const loadDowns = useCallback(async () => {
    setDownsLoading(true)
    try {
      const data = await listAdminFeedbackDownsApi({ page: downsPage, size: PAGE_SIZE })
      setDowns(data.records)
      setDownsTotal(data.total)
    } catch (error) {
      showApiError(error, '加载点踩列表失败')
    } finally {
      setDownsLoading(false)
    }
  }, [downsPage])

  const loadRagActions = useCallback(async () => {
    setActionsLoading(true)
    try {
      const data = await listAdminRagActionsApi({ page: actionsPage, size: PAGE_SIZE })
      setRagActions(data.records)
      setActionsTotal(data.total)
    } catch (error) {
      showApiError(error, '加载自愈日志失败')
    } finally {
      setActionsLoading(false)
    }
  }, [actionsPage])

  const loadSignals = useCallback(async () => {
    setSignalsLoading(true)
    try {
      const data = await listSourceSignalsApi({ page: signalsPage, size: PAGE_SIZE })
      setSignals(data.records)
      setSignalsTotal(data.total)
    } catch (error) {
      showApiError(error, '加载文档信号失败')
    } finally {
      setSignalsLoading(false)
    }
  }, [signalsPage])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  useEffect(() => {
    void loadDowns()
  }, [loadDowns])

  useEffect(() => {
    void loadRagActions()
  }, [loadRagActions])

  useEffect(() => {
    void loadSignals()
  }, [loadSignals])

  useMainContentLayout({ lockScroll: false })

  const refreshAll = async () => {
    await Promise.all([loadStats(), loadDowns(), loadRagActions(), loadSignals()])
  }

  const handleClearSignal = async (source: string, field: RagSourceSignalClearField) => {
    try {
      await clearSourceSignalApi(source, field)
      message.success('已撤销信号')
      await refreshAll()
    } catch (error) {
      showApiError(error, '撤销失败')
    }
  }

  const handleReindexAll = () => {
    Modal.confirm({
      title: '重建全库向量',
      content:
        '将使用当前 embedding 策略重新索引全部文档，耗时取决于文档数量。embedding 策略升级后请执行一次。',
      okText: '开始重建',
      cancelText: '取消',
      onOk: async () => {
        setReindexing(true)
        try {
          const result = await reindexAllKnowledgeApi()
          setReindexResult(result)
          if (result.failed.length === 0) {
            message.success(`重建完成：${result.succeeded}/${result.total}`)
          } else {
            message.warning(`部分失败：成功 ${result.succeeded}，失败 ${result.failed.length}`)
          }
        } catch (error) {
          showApiError(error, '重建失败')
        } finally {
          setReindexing(false)
        }
      },
    })
  }

  const columns: ColumnsType<AiFeedbackDownItem> = [
    { title: '用户', dataIndex: 'username', width: 100 },
    {
      title: '场景',
      dataIndex: 'scene',
      width: 80,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '原因',
      dataIndex: 'reason',
      width: 100,
      render: (v?: string) => (v ? REASON_LABEL[v] ?? v : '—'),
    },
    {
      title: '补充说明',
      dataIndex: 'reasonDetail',
      width: 180,
      ellipsis: true,
      render: (v?: string) => v || '—',
    },
    { title: '摘要', dataIndex: 'summary', ellipsis: true },
    {
      title: '自愈动作',
      key: 'ragActions',
      width: 200,
      render: (_: unknown, row: AiFeedbackDownItem) => {
        const actions = row.ragActions ?? []
        if (actions.length === 0) return '—'
        return (
          <span className={styles.actionList}>
            {actions.slice(0, 3).map((a) => `${a.actionType}(${a.status})`).join(' · ')}
          </span>
        )
      },
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (v: string) => formatDate(v),
    },
  ]

  const signalColumns: ColumnsType<RagSourceSignalItem> = [
    { title: '文档', dataIndex: 'source', ellipsis: true },
    { title: '降权', dataIndex: 'penalty', width: 64 },
    { title: '升权', dataIndex: 'boost', width: 64 },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 160,
      render: (v: string) => formatDate(v),
    },
    {
      title: '操作',
      key: 'actions',
      width: 260,
      render: (_: unknown, row: RagSourceSignalItem) => (
        <Space size={4} wrap className={styles.signalActions}>
          {row.penalty > 0 && (
            <Popconfirm
              title="撤销该文档的降权信号？"
              okText="撤销"
              cancelText="取消"
              onConfirm={() => void handleClearSignal(row.source, 'penalty')}
            >
              <Button type="link" size="small">
                撤销降权
              </Button>
            </Popconfirm>
          )}
          {row.boost > 0 && (
            <Popconfirm
              title="撤销该文档的升权信号？"
              okText="撤销"
              cancelText="取消"
              onConfirm={() => void handleClearSignal(row.source, 'boost')}
            >
              <Button type="link" size="small">
                撤销升权
              </Button>
            </Popconfirm>
          )}
          <Popconfirm
            title="清除该文档的全部反馈信号？"
            okText="清除"
            cancelText="取消"
            onConfirm={() => void handleClearSignal(row.source, 'all')}
          >
            <Button type="link" size="small" danger>
              全部清除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>AI 反馈统计</h1>
      <p className={styles.sub}>Wave D3 · RAG / Chat 用户点赞点踩闭环</p>

      {stats && (
        <div className={styles.cards}>
          <div className={styles.card}>
            <div className={styles.cardLabel}>总 👍</div>
            <div className={styles.cardValue}>{stats.upCount}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>总 👎</div>
            <div className={styles.cardValue}>{stats.downCount}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>RAG 👍 / 👎</div>
            <div className={styles.cardValue}>
              {stats.ragUp} / {stats.ragDown}
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Chat 👍 / 👎</div>
            <div className={styles.cardValue}>
              {stats.chatUp} / {stats.chatDown}
            </div>
          </div>
        </div>
      )}

      <h2 className={styles.sectionTitle}>最近点踩（Bad Case 候选）</h2>
      <Table
        rowKey="id"
        loading={statsLoading || downsLoading}
        columns={columns}
        dataSource={downs}
        size="small"
        pagination={{
          current: downsPage,
          pageSize: PAGE_SIZE,
          total: downsTotal,
          showSizeChanger: false,
          onChange: (p) => setDownsPage(p),
        }}
      />

      <h2 className={styles.sectionTitle}>RAG 自愈动作日志</h2>
      <Table<RagFeedbackActionItem>
        rowKey="id"
        loading={actionsLoading}
        size="small"
        dataSource={ragActions}
        pagination={{
          current: actionsPage,
          pageSize: PAGE_SIZE,
          total: actionsTotal,
          showSizeChanger: false,
          onChange: (p) => setActionsPage(p),
        }}
        columns={[
          { title: '类型', dataIndex: 'actionType', width: 100 },
          { title: '阶段', dataIndex: 'triageStep', width: 64 },
          { title: '状态', dataIndex: 'status', width: 80 },
          { title: '详情', dataIndex: 'detailJson', ellipsis: true },
          {
            title: '时间',
            dataIndex: 'createdAt',
            width: 160,
            render: (v: string) => formatDate(v),
          },
        ]}
      />

      <div className={styles.sectionBlock}>
        <h2 className={styles.sectionTitle}>文档级反馈信号</h2>
        <p className={styles.sectionHint}>
          点踩分诊写入的全局 penalize / boost 信号。撤销后 Python rerank 最多 30 秒内生效。
        </p>
        <Table
          rowKey="source"
          loading={signalsLoading}
          size="small"
          dataSource={signals}
          columns={signalColumns}
          locale={{ emptyText: '暂无活跃信号' }}
          pagination={{
            current: signalsPage,
            pageSize: PAGE_SIZE,
            total: signalsTotal,
            showSizeChanger: false,
            onChange: (p) => setSignalsPage(p),
          }}
        />
      </div>

      <div className={styles.sectionBlock}>
        <h2 className={styles.sectionTitle}>向量索引维护</h2>
        <p className={styles.sectionHint}>
          embedding 策略升级后请执行一次全库重建，使 filename / heading 等元数据进入 dense 向量。
        </p>
        <div className={styles.reindexBar}>
          <Button type="primary" loading={reindexing} onClick={handleReindexAll}>
            重建全库向量
          </Button>
          {reindexResult && (
            <span className={styles.reindexResult}>
              上次：成功 {reindexResult.succeeded}/{reindexResult.total}
              {reindexResult.failed.length > 0 && `，失败 ${reindexResult.failed.length}`}
            </span>
          )}
        </div>
        {reindexResult && reindexResult.failed.length > 0 && (
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            className={styles.reindexFailures}
            dataSource={reindexResult.failed}
            columns={[
              { title: 'ID', dataIndex: 'id', width: 64 },
              { title: '文档', dataIndex: 'filename', ellipsis: true },
              { title: '原因', dataIndex: 'reason', ellipsis: true },
            ]}
          />
        )}
      </div>
    </div>
  )
}
