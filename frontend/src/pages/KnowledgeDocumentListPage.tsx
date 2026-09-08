import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, message, Modal, Spin, Table, Tooltip } from 'antd'
import { ArrowLeftOutlined, UploadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { KnowledgeDocumentVO } from '@/api/knowledge'
import {
  deleteKnowledgeDocumentApi,
  listKnowledgeDocumentsPageApi,
  uploadKnowledgeApi,
} from '@/api/knowledge'
import EditKnowledgeDocumentModal from '@/components/knowledge/EditKnowledgeDocumentModal'
import KnowledgeDocToolbar from '@/components/knowledge/KnowledgeDocToolbar'
import useDebouncedValue from '@/hooks/useDebouncedValue'
import { useMainContentLayout } from '@/hooks/useMainContentLayout'
import { formatDate, formatFileSize } from '@/utils/format'
import styles from '@/pages/KnowledgeDocumentListPage.module.css'
import {
  KNOWLEDGE_ACCEPT_ATTR,
  KNOWLEDGE_UPLOAD_HINT,
} from '@/constants/knowledgeFormats'

export default function KnowledgeDocumentListPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [listLoading, setListLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [records, setRecords] = useState<KnowledgeDocumentVO[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)

  const [searchInput, setSearchInput] = useState('')
  const keyword = useDebouncedValue(searchInput.trim(), 300)
  const [sort, setSort] = useState<'asc' | 'desc'>('desc')

  const [editOpen, setEditOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState<KnowledgeDocumentVO | null>(null)

  useMainContentLayout({ fullBleed: true })

  const fetchList = useCallback(async () => {
    setListLoading(true)
    try {
      const data = await listKnowledgeDocumentsPageApi({
        page,
        size,
        keyword: keyword || undefined,
        sort,
      })
      setRecords(data.records)
      setTotal(data.total)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '获取文档列表失败')
    } finally {
      setListLoading(false)
    }
  }, [page, size, keyword, sort])

  useEffect(() => {
    void fetchList()
  }, [fetchList])

  useEffect(() => {
    setPage(1)
  }, [keyword])

  const handlePickFile = () => fileInputRef.current?.click()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      await uploadKnowledgeApi(file)
      message.success(`已上传 ${file.name}`)
      setPage(1)
      await fetchList()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = (doc: KnowledgeDocumentVO) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除「${doc.filename}」吗？向量索引将一并移除，此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteKnowledgeDocumentApi(doc.id)
          message.success('删除成功')
          if (records.length === 1 && page > 1) {
            setPage(page - 1)
          } else {
            await fetchList()
          }
        } catch (err) {
          message.error(err instanceof Error ? err.message : '删除失败')
          throw err
        }
      },
    })
  }

  const columns: ColumnsType<KnowledgeDocumentVO> = [
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
      ellipsis: { showTitle: false },
      render: (filename: string) => (
        <Tooltip title={filename} placement="topLeft">
          <span className={styles.fileNameCell}>{filename}</span>
        </Tooltip>
      ),
    },
    {
      title: '类型',
      dataIndex: 'fileType',
      key: 'fileType',
      width: 132,
      render: (type?: string) => (
        <span className={styles.monoCell}>{type || '—'}</span>
      ),
    },
    {
      title: '大小',
      dataIndex: 'fileSize',
      key: 'fileSize',
      width: 88,
      render: (fileSize?: number) =>
        fileSize && fileSize > 0 ? formatFileSize(fileSize) : '—',
    },
    {
      title: 'Chunks',
      dataIndex: 'chunkCount',
      key: 'chunkCount',
      width: 80,
      render: (count: number) => <span className={styles.monoCell}>{count}</span>,
    },
    {
      title: '上传时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 112,
      render: (createdAt?: string) => (createdAt ? formatDate(createdAt) : '—'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 168,
      fixed: 'right',
      render: (_, record) => (
        <div className={styles.actionCell}>
          <Tooltip
            title={record.hasOriginalFile ? undefined : '旧索引文档无原文件，请重新上传后编辑'}
          >
            <Button
              type="link"
              size="small"
              disabled={!record.hasOriginalFile}
              onClick={() => navigate(`/knowledge/documents/${record.id}`)}
            >
              查看
            </Button>
          </Tooltip>
          <Button
            type="link"
            size="small"
            disabled={!record.hasOriginalFile}
            onClick={() => {
              setEditingDoc(record)
              setEditOpen(true)
            }}
          >
            编辑
          </Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(record)}>
            删除
          </Button>
        </div>
      ),
    },
  ]

  const hasFilter = Boolean(keyword)
  const showEmpty = !listLoading && total === 0 && !hasFilter
  const showFilterEmpty = !listLoading && total === 0 && hasFilter

  return (
    <div className={styles.page}>
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        className={styles.backLink}
        onClick={() => navigate('/knowledge')}
      >
        返回知识问答
      </Button>

      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>文档库</h1>
          <p className={styles.pageDescription}>管理 RAG 知识库文档，支持搜索与分页浏览</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={KNOWLEDGE_ACCEPT_ATTR} 
          className={styles.hiddenInput}
          onChange={(e) => void handleFileChange(e)}
        />
        <Button type="primary" icon={<UploadOutlined />} loading={uploading} onClick={handlePickFile}>
          上传文档
        </Button>
      </header>

      <KnowledgeDocToolbar
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        sort={sort}
        onSortChange={(value) => {
          setSort(value)
          setPage(1)
        }}
      />

      <EditKnowledgeDocumentModal
        open={editOpen}
        document={editingDoc}
        onCancel={() => {
          setEditOpen(false)
          setEditingDoc(null)
        }}
        onSuccess={async () => {
          setEditOpen(false)
          setEditingDoc(null)
          await fetchList()
        }}
      />

      <section className={styles.section}>
        <Spin spinning={listLoading} className={styles.sectionSpin}>
          {showEmpty ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyText}>暂无文档，{KNOWLEDGE_UPLOAD_HINT}</p>
              <Button type="primary" onClick={handlePickFile}>
                上传文档
              </Button>
            </div>
          ) : (
            <div className={styles.tablePanel}>
              <div className={styles.tablePanelHeader}>
                <span className={styles.tablePanelTitle}>List 列表视图</span>
              </div>
              {showFilterEmpty ? (
                <p className={styles.filterEmptyInPanel}>无匹配文档</p>
              ) : (
                <div className={styles.tableWrap}>
                  <Table<KnowledgeDocumentVO>
                    rowKey="id"
                    size="small"
                    tableLayout="fixed"
                    columns={columns}
                    dataSource={records}
                    pagination={{
                      current: page,
                      pageSize: size,
                      total,
                      showSizeChanger: true,
                      pageSizeOptions: [10, 20, 50],
                      onChange: (nextPage, nextSize) => {
                        setPage(nextPage)
                        setSize(nextSize)
                      },
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </Spin>
      </section>
    </div>
  )
}
