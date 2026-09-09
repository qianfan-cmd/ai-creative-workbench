import { useCallback, useEffect, useState } from 'react'

import { useNavigate } from 'react-router-dom'

import { Button, message, Modal, Spin, Table, Tooltip } from 'antd'

import { ArrowLeftOutlined, UploadOutlined } from '@ant-design/icons'

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

import KnowledgeDocToolbar from '@/components/knowledge/KnowledgeDocToolbar'

import useDebouncedValue from '@/hooks/useDebouncedValue'

import { useKnowledgeDocumentUpload } from '@/hooks/useKnowledgeDocumentUpload'

import { useMainContentLayout } from '@/hooks/useMainContentLayout'

import { formatDate, formatFileSize } from '@/utils/format'

import styles from '@/pages/KnowledgeDocumentListPage.module.css'

import {

  KNOWLEDGE_ACCEPT_ATTR,

  KNOWLEDGE_UPLOAD_HINT,

} from '@/constants/knowledgeFormats'



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



  const { uploading, fileInputRef, openFilePicker, handleFileChange } = useKnowledgeDocumentUpload({

    onSuccess: async () => {

      setPage(1)

      setSelectedRowKeys([])

      await fetchList()

    },

  })



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

