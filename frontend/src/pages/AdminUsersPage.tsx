import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import UserAvatar from '@/components/common/UserAvatar'
import {
  createAdminUserApi,
  disableAdminUserApi,
  getAdminUserApi,
  getAdminUserUsageApi,
  listAdminUsersApi,
  updateAdminUserApi,
  type AdminUserDetail,
  type AdminUserListItem,
  type ModelUsageItem,
  type UserUsageSummary,
} from '@/api/adminUsers'
import { useMainContentLayout } from '@/hooks/useMainContentLayout'
import { formatDate } from '@/utils/format'
import styles from '@/pages/AdminUsersPage.module.css'

interface UserFormValues {
  username: string
  email: string
  password?: string
  role: string
  status?: string
}

const ROLE_OPTIONS = [
  { label: '普通用户', value: 'USER' },
  { label: '管理员', value: 'ADMIN' },
]

const STATUS_OPTIONS = [
  { label: '正常', value: 'ACTIVE' },
  { label: '已禁用', value: 'DISABLED' },
]

function formatCostRange(min?: number, max?: number, fallback?: number): string {
  const lo = min ?? fallback ?? 0
  const hi = max ?? fallback ?? lo
  if (Math.abs(lo - hi) < 0.00005) {
    return `¥${lo.toFixed(4)}`
  }
  return `¥${lo.toFixed(4)} ~ ¥${hi.toFixed(4)}`
}

function formatSourceBasis(row: ModelUsageItem) {
  if (row.sourceUrl) {
    return (
      <a href={row.sourceUrl} target="_blank" rel="noreferrer">
        官方定价
      </a>
    )
  }
  if (row.sourceStatus === 'legacy_incomplete') {
    return '历史记录缺字段'
  }
  return '暂未配置'
}

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(false)
  const [records, setRecords] = useState<AdminUserListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUserDetail | null>(null)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailUser, setDetailUser] = useState<AdminUserDetail | null>(null)
  const [usage, setUsage] = useState<UserUsageSummary | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)

  const [createForm] = Form.useForm<UserFormValues>()
  const [editForm] = Form.useForm<UserFormValues>()

  useMainContentLayout({ lockScroll: false })

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listAdminUsersApi({ page, size, keyword: keyword || undefined })
      setRecords(data.records)
      setTotal(data.total)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载用户列表失败')
    } finally {
      setLoading(false)
    }
  }, [page, size, keyword])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const openDetail = async (id: number) => {
    try {
      const user = await getAdminUserApi(id)
      setDetailUser(user)
      setDetailOpen(true)
      setUsage(null)
      setUsageLoading(true)
      const usageData = await getAdminUserUsageApi(id, 30)
      setUsage(usageData)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载用户详情失败')
    } finally {
      setUsageLoading(false)
    }
  }

  const openEdit = async (id: number) => {
    try {
      const user = await getAdminUserApi(id)
      setEditingUser(user)
      editForm.setFieldsValue({
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
      })
      setEditOpen(true)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载用户失败')
    }
  }

  const handleCreate = async (values: UserFormValues) => {
    if (!values.password) {
      message.error('请输入密码')
      return
    }
    try {
      await createAdminUserApi({
        username: values.username,
        email: values.email,
        password: values.password,
        role: values.role,
      })
      message.success('用户已创建')
      setCreateOpen(false)
      createForm.resetFields()
      fetchList()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '创建失败')
    }
  }

  const handleEdit = async (values: UserFormValues) => {
    if (!editingUser) return
    try {
      await updateAdminUserApi(editingUser.id, {
        username: values.username,
        email: values.email,
        role: values.role,
        status: values.status ?? 'ACTIVE',
        password: values.password || undefined,
      })
      message.success('用户已更新')
      setEditOpen(false)
      setEditingUser(null)
      editForm.resetFields()
      fetchList()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '更新失败')
    }
  }

  const handleDisable = async (id: number) => {
    try {
      await disableAdminUserApi(id)
      message.success('用户已禁用')
      fetchList()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '禁用失败')
    }
  }

  const columns: ColumnsType<AdminUserListItem> = [
    {
      title: '用户',
      key: 'user',
      render: (_, row) => (
        <div className={styles.userCell}>
          <UserAvatar
            user={{ ...row, role: row.role, createdAt: row.createdAt }}
            size={32}
          />
          <span>{row.username}</span>
        </div>
      ),
    },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={role === 'ADMIN' ? 'default' : 'blue'}>{role}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'ACTIVE' ? 'success' : 'error'}>
          {status === 'ACTIVE' ? '正常' : '已禁用'}
        </Tag>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => formatDate(v),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, row) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => openDetail(row.id)}>
            查看
          </Button>
          <Button type="link" size="small" onClick={() => openEdit(row.id)}>
            编辑
          </Button>
          <Popconfirm
            title="确定禁用该用户？"
            description="禁用后该用户将无法登录，历史数据保留。"
            onConfirm={() => handleDisable(row.id)}
            disabled={row.status === 'DISABLED'}
          >
            <Button type="link" size="small" danger disabled={row.status === 'DISABLED'}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>用户管理</h1>
          <p className={styles.desc}>查看与管理团队成员账户及 AI 用量</p>
        </div>
        <div className={styles.toolbar}>
          <Input.Search
            placeholder="搜索用户名或邮箱"
            allowClear
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={(v) => {
              setPage(1)
              setKeyword(v.trim())
            }}
            style={{ width: 260 }}
          />
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            新建用户
          </Button>
        </div>
      </header>

      <div className={styles.panel}>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={records}
          pagination={{
            current: page,
            pageSize: size,
            total,
            showSizeChanger: true,
            onChange: (p, s) => {
              setPage(p)
              setSize(s)
            },
          }}
        />
      </div>

      <Modal
        title="新建用户"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="用户名" name="username" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            label="邮箱"
            name="email"
            rules={[{ required: true }, { type: 'email' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true }, { min: 6, message: '至少 6 位' }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item label="角色" name="role" initialValue="USER" rules={[{ required: true }]}>
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑用户"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => editForm.submit()}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item label="用户名" name="username" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            label="邮箱"
            name="email"
            rules={[{ required: true }, { type: 'email' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="角色" name="role" rules={[{ required: true }]}>
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true }]}>
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item label="新密码" name="password" extra="留空则不修改">
            <Input.Password placeholder="可选，至少 6 位" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={detailUser ? `用户：${detailUser.username}` : '用户详情'}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={640}
      >
        {detailUser && (
          <Tabs
            items={[
              {
                key: 'profile',
                label: '基本信息',
                children: (
                  <div>
                    <p>邮箱：{detailUser.email}</p>
                    <p>角色：{detailUser.role}</p>
                    <p>状态：{detailUser.status === 'ACTIVE' ? '正常' : '已禁用'}</p>
                    <p>注册：{formatDate(detailUser.createdAt)}</p>
                    <p>更新：{formatDate(detailUser.updatedAt)}</p>
                  </div>
                ),
              },
              {
                key: 'usage',
                label: 'AI 用量',
                children: usageLoading ? (
                  <p>加载用量中…</p>
                ) : usage ? (
                  <div>
                    <div className={styles.usageStats}>
                      <div className={styles.statCard}>
                        <p className={styles.statLabel}>近 {usage.days} 天总 Token</p>
                        <p className={styles.statValue}>{usage.totalTokens.toLocaleString()}</p>
                      </div>
                      <div className={styles.statCard}>
                        <p className={styles.statLabel}>预估费用 (CNY)</p>
                        <p className={styles.statValue}>
                          {formatCostRange(
                            usage.totalCostCnyMin,
                            usage.totalCostCnyMax,
                            usage.totalCostCny,
                          )}
                        </p>
                      </div>
                    </div>
                    <h4 className={styles.usageSectionTitle}>按模型</h4>
                    <Table
                      size="small"
                      rowKey="model"
                      pagination={false}
                      dataSource={usage.byModel}
                      columns={[
                        {
                          title: '模型',
                          render: (_: unknown, row: ModelUsageItem) =>
                            row.modelDisplayName || row.model,
                        },
                        { title: '调用次数', dataIndex: 'callCount' },
                        { title: 'Token', dataIndex: 'totalTokens' },
                        {
                          title: '预估费用',
                          render: (_: unknown, row: ModelUsageItem) =>
                            formatCostRange(
                              row.estimatedCostCnyMin,
                              row.estimatedCostCnyMax,
                              row.estimatedCostCny,
                            ),
                        },
                        {
                          title: '依据',
                          render: (_: unknown, row: ModelUsageItem) => formatSourceBasis(row),
                        },
                      ]}
                    />
                    <h4 className={styles.usageSectionTitle}>按场景</h4>
                    <Table
                      size="small"
                      rowKey="scene"
                      pagination={false}
                      dataSource={usage.byScene}
                      columns={[
                        {
                          title: '场景',
                          render: (_: unknown, row) => row.sceneLabel || row.scene,
                        },
                        { title: '调用次数', dataIndex: 'callCount' },
                        { title: 'Token', dataIndex: 'totalTokens' },
                        {
                          title: '预估费用',
                          render: (_: unknown, row) =>
                            formatCostRange(
                              row.estimatedCostCnyMin,
                              row.estimatedCostCnyMax,
                              row.estimatedCostCny,
                            ),
                        },
                      ]}
                    />
                    <p className={styles.usageDisclaimer}>
                      以上为根据 API 返回用量与官方公开单价计算的预估费用，非各云厂商控制台真实账单。
                      DeepSeek Chat 费用按空闲～高峰时段区间展示。未配置单价的场景仅统计次数；
                      历史记录在补齐 model 字段前可能显示「历史记录缺字段」，新调用将正常计费。
                    </p>
                    {usage.pricingSources && usage.pricingSources.length > 0 && (
                      <>
                        <h4 className={styles.usageSectionTitle}>计费规则出处</h4>
                        <ul className={styles.pricingSources}>
                          {usage.pricingSources.map((item) => (
                            <li key={item.model}>
                              <strong>{item.model}</strong>
                              {item.formula ? ` — ${item.formula} — ` : ' — '}
                              <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                                {item.sourceUrl}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                ) : (
                  <p>暂无用量数据</p>
                ),
              },
            ]}
          />
        )}
      </Drawer>
    </div>
  )
}
