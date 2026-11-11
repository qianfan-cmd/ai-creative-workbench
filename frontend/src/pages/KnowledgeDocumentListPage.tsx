/**
 * 文档库列表页
 * 分页浏览、搜索、批量删除与上传 RAG 知识库文档
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useNavigate } from 'react-router-dom'

import { Button, message, Modal, Spin, Table, Tooltip, Tag } from 'antd'

import { UploadOutlined } from '@ant-design/icons'

import type { ColumnsType } from 'antd/es/table'

import type { KnowledgeDocumentVO } from '@/api/knowledge'

import {

  batchDeleteKnowledgeDocumentsApi,

  deleteKnowledgeDocumentApi,

  listKnowledgeDocumentsPageApi,

} from '@/api/knowledge'

import TagListCell from '@/components/assets/TagListCell'
import EditKnowledgeDocumentModal from '@/components/knowledge/EditKnowledgeDocumentModal'
import KnowledgeDocumentTagsModal from '@/components/knowledge/KnowledgeDocumentTagsModal'
import KnowledgeDocumentProgressBar from '@/components/knowledge/KnowledgeDocumentProgressBar'

import KnowledgeDocToolbar from '@/components/knowledge/KnowledgeDocToolbar'

import useDebouncedValue from '@/hooks/useDebouncedValue'

import { useKnowledgeDocumentUpload } from '@/hooks/useKnowledgeDocumentUpload'

import { useMainContentLayout } from '@/hooks/useMainContentLayout'

import { formatDate, formatFileSize } from '@/utils/format'
import {
  loadKnowledgeUploadBatchIds,
  saveKnowledgeUploadBatchIds,
} from '@/utils/knowledgeUploadBatchStorage'

import styles from '@/pages/KnowledgeDocumentListPage.module.css'

import {

  KNOWLEDGE_ACCEPT_ATTR,

  KNOWLEDGE_UPLOAD_HINT,

} from '@/constants/knowledgeFormats'

import { useKnowledgeIndexPolling } from '@/hooks/useKnowledgeIndexPolling'

import {
  isKnowledgeListIndexUnchanged,
  toIndexSnapshots,
  type KnowledgeIndexRowSnapshot,
} from '@/utils/knowledgeIndexListCompare'

/** 文档库管理页：表格列表 + 上传/编辑/标签/删除 */
export default function KnowledgeDocumentListPage() {

  const navigate = useNavigate()



  const [listLoading, setListLoading] = useState(false)

  const [records, setRecords] = useState<KnowledgeDocumentVO[]>([])

  const [total, setTotal] = useState(0)

  const [page, setPage] = useState(1)

  const [size, setSize] = useState(10)

  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])



  const [searchInput, setSearchInput] = useState('')

  const keyword = useDebouncedValue(searchInput.trim(), 300)

  const [sort, setSort] = useState<'asc' | 'desc'>('desc')



  const [editOpen, setEditOpen] = useState(false)

  const [editingDoc, setEditingDoc] = useState<KnowledgeDocumentVO | null>(null)

  const [tagsOpen, setTagsOpen] = useState(false)
  const [taggingDoc, setTaggingDoc] = useState<KnowledgeDocumentVO | null>(null)



  useMainContentLayout({ fullBleed: true })

  /** 静默轮询用：仅索引相关字段变化时才 setRecords */
  const indexSnapshotRef = useRef<KnowledgeIndexRowSnapshot[]>([])
  const totalSnapshotRef = useRef(0)

  const fetchList = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true
    if (!silent) {
      setListLoading(true)
    }

    try {
      const data = await listKnowledgeDocumentsPageApi({
        page,
        size,
        keyword: keyword || undefined,
        sort,
      })

      if (
        silent &&
        isKnowledgeListIndexUnchanged(
          indexSnapshotRef.current,
          data.records,
          totalSnapshotRef.current,
          data.total,
        )
      ) {
        return
      }

      indexSnapshotRef.current = toIndexSnapshots(data.records)
      totalSnapshotRef.current = data.total
      setRecords(data.records)
      setTotal(data.total)
    } catch (err) {
      if (!silent) {
        message.error(err instanceof Error ? err.message : '获取文档列表失败')
      }
    } finally {
      if (!silent) {
        setListLoading(false)
      }
    }
  }, [page, size, keyword, sort])

  useKnowledgeIndexPolling(records, () => fetchList({ silent: true }))

  /** 本批上传 documentId；session 持久化，切模块回来仍显示直到索引结束 */
  const [uploadBatchIds, setUploadBatchIds] = useState(() => loadKnowledgeUploadBatchIds())

  useEffect(() => {
    saveKnowledgeUploadBatchIds(uploadBatchIds)
  }, [uploadBatchIds])

  const { uploading, uploadProgress, uploadProgressLabel, fileInputRef, openFilePicker, handleFileChange } =
    useKnowledgeDocumentUpload({
      onSuccess: async (meta) => {
        if (meta.uploadedDocumentIds.length > 0) {
          setUploadBatchIds(meta.uploadedDocumentIds)
        }
        setPage(1)
        setSelectedRowKeys([])
        await fetchList()
      },
    })

  const indexProgress = useMemo(() => {
    if (uploadBatchIds.length === 0) {
      return null
    }

    const total = uploadBatchIds.length
    let indexedSuccess = 0
    let indexFailed = 0

    for (const id of uploadBatchIds) {
      const row = records.find((r) => r.id === id)
      if (!row) continue
      if (row.indexStatus === 'ready') {
        indexedSuccess += 1
      } else if (row.indexStatus === 'index_failed') {
        indexFailed += 1
      }
    }

    const percent = total > 0 ? Math.round((indexedSuccess / total) * 100) : 0
    const label =
      indexFailed > 0
        ? `本次上传：已成功索引 ${indexedSuccess}/${total}（另有 ${indexFailed} 个失败）`
        : `本次上传：已成功索引 ${indexedSuccess}/${total}`

    const allIndexedOrSettled = indexedSuccess + indexFailed >= total

    return { percent, label, allIndexedOrSettled }
  }, [uploadBatchIds, records])

  useEffect(() => {
    if (!indexProgress?.allIndexedOrSettled) return
    const timer = window.setTimeout(() => setUploadBatchIds([]), 2500)
    return () => window.clearTimeout(timer)
  }, [indexProgress?.allIndexedOrSettled])



  useEffect(() => {

    void fetchList()

  }, [fetchList])



  useEffect(() => {

    setPage(1)

  }, [keyword])



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

          setSelectedRowKeys((prev) => prev.filter((id) => id !== doc.id))

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



  const handleBatchDelete = () => {

    if (selectedRowKeys.length === 0) return



    Modal.confirm({

      title: '确认批量删除',

      content: `确定删除选中的 ${selectedRowKeys.length} 个文档吗？向量索引将一并移除，此操作不可恢复。`,

      okText: '删除',

      okType: 'danger',

      cancelText: '取消',

      onOk: async () => {

        try {

          const result = await batchDeleteKnowledgeDocumentsApi(selectedRowKeys)

          const deleted = new Set(result.deletedIds)



          if (result.deletedIds.length > 0) {

            message.success(`已删除 ${result.deletedIds.length} 个文档`)

          }



          if (result.failures.length > 0) {

            Modal.warning({

              title: `${result.failures.length} 条删除失败`,

              content: result.failures.map((f) => `#${f.id}：${f.reason}`).join('\n'),

            })

          }



          setSelectedRowKeys((prev) => prev.filter((id) => !deleted.has(id)))



          if (records.every((r) => deleted.has(r.id)) && page > 1) {

            setPage(page - 1)

          } else {

            await fetchList()

          }

        } catch (err) {

          message.error(err instanceof Error ? err.message : '批量删除失败')

          throw err

        }

      },

    })

  }

  const INDEX_STATUS_LABEL: Record<string, string> = {
    ready: '已索引',
    pending_index: '排队索引',
    indexing: '索引中',
    index_failed: '索引失败',
}

function renderIndexStatus(status?: string) {
    if (!status || status === 'ready') {
        return <Tag color="success">已索引</Tag>
    }
    if (status === 'index_failed') {
        return <Tag color="error">{INDEX_STATUS_LABEL[status]}</Tag>
    }
    return <Tag color="processing">{INDEX_STATUS_LABEL[status] ?? status}</Tag>
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
      title: '索引',
      dataIndex: 'indexStatus',
      key: 'indexStatus',
      width: 100,
      render: (status?: string) => renderIndexStatus(status),
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

      title: '标签',

      key: 'tags',

      width: 160,

      render: (_, record) => (

        <div className={styles.actionCell}>

          <TagListCell tags={record.tags ?? []} />

          <Button

            type="link"

            size="small"

            onClick={() => {

              setTaggingDoc(record)

              setTagsOpen(true)

            }}

          >

            编辑

          </Button>

        </div>

      ),

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

      {/* <Button

        type="link"

        icon={<ArrowLeftOutlined />}

        className={styles.backLink}

        onClick={() => navigate('/knowledge')}

      >

        返回知识问答

      </Button> */}



      <header className={styles.pageHeader}>

        <div>

          <h1 className={styles.pageTitle}>文档库</h1>

          <p className={styles.pageDescription}>管理 RAG 知识库文档，支持搜索与分页浏览</p>

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
          icon={<UploadOutlined />}
          loading={uploading}
          onClick={openFilePicker}
        >
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

      <KnowledgeDocumentProgressBar
        uploadPercent={uploading ? uploadProgress : null}
        uploadLabel={uploadProgressLabel || undefined}
        indexPercent={indexProgress != null ? indexProgress.percent : null}
        indexLabel={indexProgress?.label}
      />

      {selectedRowKeys.length > 0 && (

        <div className={styles.batchBar}>

          <span className={styles.batchHint}>已选 {selectedRowKeys.length} 项</span>

          <Button danger size="small" onClick={handleBatchDelete}>

            批量删除

          </Button>

          <Button type="link" size="small" onClick={() => setSelectedRowKeys([])}>

            取消选择

          </Button>

        </div>

      )}



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

      <KnowledgeDocumentTagsModal
        open={tagsOpen}
        documentId={taggingDoc?.id ?? null}
        filename={taggingDoc?.filename}
        initialTagIds={(taggingDoc?.tags ?? []).map((t) => t.id)}
        onClose={() => {
          setTagsOpen(false)
          setTaggingDoc(null)
        }}
        onSaved={(tags) => {
          if (!taggingDoc) return
          setRecords((prev) =>
            prev.map((row) => (row.id === taggingDoc.id ? { ...row, tags } : row)),
          )
          setTagsOpen(false)
          setTaggingDoc(null)
        }}
      />

      <section className={styles.section}>

        <Spin spinning={listLoading} className={styles.sectionSpin}>

          {showEmpty ? (

            <div className={styles.emptyState}>

              <p className={styles.emptyText}>暂无文档，{KNOWLEDGE_UPLOAD_HINT}</p>

              <Button type="primary" htmlType="button" loading={uploading} onClick={openFilePicker}>
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

                    rowSelection={{

                      selectedRowKeys,

                      onChange: (keys) => setSelectedRowKeys(keys as number[]),

                    }}

                    pagination={{

                      current: page,

                      pageSize: size,

                      total,

                      showSizeChanger: true,

                      pageSizeOptions: [10, 20, 50],

                      onChange: (nextPage, nextSize) => {

                        setPage(nextPage)

                        setSize(nextSize)

                        setSelectedRowKeys([])

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

