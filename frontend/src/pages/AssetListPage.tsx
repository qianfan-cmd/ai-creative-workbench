import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, message, Spin, Modal, Table } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { listAssetsApi, getAssetStatsApi, deleteAssetApi, getAssetDetailApi, batchDeleteAssetsApi } from '@/api/assets'
import type { AssetVO, AssetStatsVO } from '@/types/api'
import styles from '@/pages/AssetListPage.module.css'
import { useMainContentLayout } from '@/hooks/useMainContentLayout'
import AssetStatsStrip from '@/components/assets/AssetStatsStrip'
import Toolbar from '@/components/assets/ToolBar'
import useDebouncedValue from '@/hooks/useDebouncedValue'
import { listTagsApi } from '@/api/tags'
import type { TagVO } from '@/api/tags'
import CreateTagModal from '@/components/assets/CreateTagModal'
import VirtualAssetGrid from '@/components/assets/VirtualAssetGrid'
import type { ColumnsType } from 'antd/es/table'
import { formatDate, formatFileSize } from '@/utils/format'
import EditAssetModal from '@/components/assets/EditAssetModal'
import TagListCell from '@/components/assets/TagListCell'

const GRID_PAGE_SIZE = 20

const AssetListPage = () => {
    const navigate = useNavigate()
    const gridScrollRef = useRef<HTMLDivElement>(null)

    const [listLoading, setListLoading] = useState(false)
    const [records, setRecords] = useState<AssetVO[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [size, setSize] = useState(10)

    const [gridAssets, setGridAssets] = useState<AssetVO[]>([])
    const [gridTotal, setGridTotal] = useState(0)
    const [gridPage, setGridPage] = useState(1)
    const [gridLoading, setGridLoading] = useState(false)
    const [gridLoadingMore, setGridLoadingMore] = useState(false)

    const [stats, setStats] = useState<AssetStatsVO>({
        total: 0,
        last7DaysCount: 0,
        prev7DaysCount: 0,
        knowledgeDocCount: 0,
    })

    const [searchInput, setSearchInput] = useState('')
    const keyword = useDebouncedValue(searchInput.trim(), 300)

    const [tagId, setTagId] = useState<number | undefined>()
    const [sort, setSort] = useState<'asc' | 'desc'>('desc')

    const [tags, setTags] = useState<TagVO[]>([])
    const [createTagOpen, setCreateTagOpen] = useState(false)

    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

    const [editOpen, setEditOpen] = useState(false)
    const [editingAsset, setEditingAsset] = useState<AssetVO | null>(null)
    const [selectedAssetIds, setSelectedAssetIds] = useState<number[]>([])

    const handleEditAsset = async (asset: AssetVO) => {
        try {
            // 下拉选项：若尚未加载过全站标签列表，这里补一次
            await ensureTagsLoaded()
            // 单条详情：Grid 列表不带 tags，必须再查一次才能回填已绑标签
            const detail = await getAssetDetailApi(asset.id)
            setEditingAsset(detail)
            setEditOpen(true)
        } catch (err) {
            message.error(err instanceof Error ? err.message : '加载素材详情失败')
        }
    }

    useMainContentLayout({ fullBleed: true, lockScroll: viewMode === 'grid' })

    const fetchList = useCallback(async () => {
        setListLoading(true)
        try {
            const data = await listAssetsApi({
                page,
                size,
                tagId,
                keyword: keyword || undefined,
                sort,
                includeTags: true,
            })
            setRecords(data.records)
            setTotal(data.total)
        } catch (err) {
            message.error(err instanceof Error ? err.message : '获取素材列表失败')
        } finally {
            setListLoading(false)
        }
    }, [page, size, keyword, sort, tagId])

    const fetchGridPage = useCallback(async (targetPage: number, append: boolean) => {
        if (append) {
            setGridLoadingMore(true)
        } else {
            setGridLoading(true)
        }

        try {
            const data = await listAssetsApi({
                page: targetPage,
                size: GRID_PAGE_SIZE,
                tagId,
                keyword: keyword || undefined,
                sort,
                includeTags: false,
            })
            setGridTotal(data.total)
            setGridPage(targetPage)
            setGridAssets((prev) => (append ? [...prev, ...data.records] : data.records))
        } catch (err) {
            message.error(err instanceof Error ? err.message : '获取素材列表失败')
        } finally {
            setGridLoading(false)
            setGridLoadingMore(false)
        }
    }, [keyword, sort, tagId])

    useEffect(() => {
        if (viewMode !== 'list') return
        fetchList()
    }, [viewMode, fetchList])

    useEffect(() => {
        if (viewMode !== 'grid') return
        void fetchGridPage(1, false)
    }, [viewMode, keyword, tagId, sort, fetchGridPage])

    // 内容未撑满滚动区时自动加载下一页
    useEffect(() => {
        if (viewMode !== 'grid' || gridLoading || gridLoadingMore) return
        if (gridAssets.length >= gridTotal) return

        const el = gridScrollRef.current
        if (!el) return
        if (el.scrollHeight <= el.clientHeight + 1) {
            void fetchGridPage(gridPage + 1, true)
        }
    }, [
        viewMode,
        gridLoading,
        gridLoadingMore,
        gridAssets.length,
        gridTotal,
        gridPage,
        fetchGridPage,
    ])

    const handleSearchChange = (value: 'asc' | 'desc') => {
        setSort(value)
        setPage(1)
    }

    useEffect(() => {
        setPage(1)
        setSelectedAssetIds([])
    }, [keyword, tagId])

    useEffect(() => {
        setSelectedAssetIds([])
    }, [viewMode, sort])

    const fetchStats = useCallback(async () => {
        try {
            const data = await getAssetStatsApi()
            setStats(data)
        } catch (err) {
            message.error(err instanceof Error ? err.message : '获取素材统计失败')
        }
    }, [])

    useEffect(() => {
        fetchStats()
    }, [fetchStats])

    const reloadTags = useCallback(async () => {
        const data = await listTagsApi()
        setTags(data)
    }, [])

    const prependTag = useCallback((created: TagVO) => {
        setTags((prev) => {
            if (prev.some((t) => t.id === created.id)) return prev
            return [created, ...prev]
        })
    }, [])

    /** 首次打开标签筛选下拉时再请求标签 */
        const ensureTagsLoaded = useCallback(async () => {
            if (tags.length > 0) return
            try {
                await reloadTags()
            } catch (err) {
                message.error(err instanceof Error ? err.message : '获取标签列表失败')
            }
        }, [tags.length, reloadTags])
    
        const handleTagFilterOpenChange = useCallback(
            (open: boolean) => {
                if (open) {
                    void ensureTagsLoaded()
                }
            },
            [ensureTagsLoaded],
        )
    
    const handleGridScroll = useCallback(() => {
        const el = gridScrollRef.current
        if (!el || gridLoading || gridLoadingMore) return
        if (gridAssets.length >= gridTotal) return

        const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 200
        if (nearBottom) {
            void fetchGridPage(gridPage + 1, true)
        }
    }, [
        gridLoading,
        gridLoadingMore,
        gridAssets.length,
        gridTotal,
        gridPage,
        fetchGridPage,
    ])

    const handleToggleAssetSelect = (asset: AssetVO) => {
        setSelectedAssetIds((prev) =>
            prev.includes(asset.id)
                ? prev.filter((id) => id !== asset.id)
                : [...prev, asset.id],
        )
    }

    const clearAssetSelection = () => {
        setSelectedAssetIds([])
    }

    const handleBatchDeleteAssets = () => {
        if (selectedAssetIds.length === 0) return

        Modal.confirm({
            title: '确认批量删除',
            content: `确定删除选中的 ${selectedAssetIds.length} 个素材吗？此操作不可恢复。`,
            okText: '删除',
            okType: 'danger',
            cancelText: '取消',
            onOk: async () => {
                try {
                    await batchDeleteAssetsApi(selectedAssetIds)
                    message.success('批量删除成功')

                    const deleted = new Set(selectedAssetIds)

                    if (viewMode === 'grid') {
                        setGridAssets((prev) => prev.filter((item) => !deleted.has(item.id)))
                        setGridTotal((prev) => Math.max(0, prev - selectedAssetIds.length))
                    } else {
                        const remaining = records.filter((item) => !deleted.has(item.id))
                        if (remaining.length === 0 && page > 1) {
                            setPage(page - 1)
                        } else {
                            setRecords(remaining)
                            setTotal((prev) => Math.max(0, prev - selectedAssetIds.length))
                        }
                    }

                    setSelectedAssetIds([])
                    await fetchStats()
                } catch (err) {
                    message.error(err instanceof Error ? err.message : '批量删除失败')
                    throw err
                }
            },
        })
    }

    const handleViewAsset = (asset: AssetVO) => {
        window.open(asset.url, '_blank', 'noopener,noreferrer')
    }

    const handleDeleteAsset = (asset: AssetVO) => {
        Modal.confirm({
            title: '确认删除',
            content: `确定删除「${asset.name}」吗？此操作不可恢复。`,
            okText: '删除',
            okType: 'danger',
            cancelText: '取消',
            onOk: async () => {
                try {
                    await deleteAssetApi(asset.id)
                    message.success('删除成功')
                    setSelectedAssetIds((prev) => prev.filter((id) => id !== asset.id))

                    if (viewMode === 'grid') {
                        setGridAssets((prev) => prev.filter((item) => item.id !== asset.id))
                        setGridTotal((prev) => Math.max(0, prev - 1))
                    } else if (records.length === 1 && page > 1) {
                        setPage(page - 1)
                    } else {
                        await fetchList()
                    }

                    await fetchStats()
                } catch (err) {
                    message.error(err instanceof Error ? err.message : '删除失败')
                    throw err
                }
            },
        })
    }

    const columns: ColumnsType<AssetVO> = [
        {
            title: '文件名',
            dataIndex: 'name',
            key: 'name',
            ellipsis: true,
        },
        {
            title: '类型',
            dataIndex: 'type',
            key: 'type',
            width: 140,
            render: (type: string) => <span className={styles.monoCell}>{type}</span>,
        },
        {
            title: '大小',
            dataIndex: 'size',
            key: 'size',
            width: 100,
            render: (size: number) => formatFileSize(size),
        },
        {
            title: '标签',
            key: 'tags',
            render: (_, record) => <TagListCell tags={record.tags || []} />,
        },
        {
            title: '上传时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 120,
            render: (createdAt: string) => formatDate(createdAt),
        },
        {
            title: '操作',
            key: 'actions',
            width: 168,
            fixed: 'right',
            render: (_, record) => (
              <div className={styles.actionCell}>
                <Button type="link" size="small" className={styles.actionBtn} onClick={() => handleViewAsset(record)}>
                  查看
                </Button>
                <Button type="link" size="small" className={styles.actionBtn} onClick={() => handleEditAsset(record)}>
                  编辑
                </Button>
                <Button type="link" size="small" danger className={styles.actionBtn} onClick={() => handleDeleteAsset(record)}>
                  删除
                </Button>
              </div>
            ),
          },
    ]

    const gridHasMore = gridAssets.length < gridTotal
    const pageLoading = viewMode === 'grid' ? gridLoading : listLoading

    return (
        <div className={`${styles.page} ${viewMode === 'grid' ? styles.page_gridMode : ''}`}>
            <header className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>素材 Asset</h1>
                    <p className={styles.pageDescription}>管理创意文件、标签与上传</p>
                </div>
                <Button
                    type='primary'
                    icon={<UploadOutlined />}
                    onClick={() => navigate('/assets/upload')}
                >
                    上传Upload
                </Button>
            </header>

            <AssetStatsStrip stats={stats} />

            <Toolbar
                searchInput={searchInput}
                onSearchInputChange={setSearchInput}
                sort={sort}
                onSortChange={handleSearchChange}
                tags={tags}
                tagId={tagId}
                onTagIdChange={(id) => {
                    setTagId(id)
                    setPage(1)
                }}
                onCreateTagClick={() => setCreateTagOpen(true)}
                onTagFilterOpenChange={handleTagFilterOpenChange}
            />

            {selectedAssetIds.length > 0 && (
                <div className={styles.selectionBar}>
                    <span className={styles.selectionBarText}>已选 {selectedAssetIds.length} 项</span>
                    <div className={styles.selectionBarActions}>
                        <Button danger onClick={handleBatchDeleteAssets}>
                            批量删除
                        </Button>
                        <Button type="link" onClick={clearAssetSelection}>
                            取消选择
                        </Button>
                    </div>
                </div>
            )}

            <CreateTagModal
                open={createTagOpen}
                onCancel={() => setCreateTagOpen(false)}
                onSuccess={(created) => {
                    setCreateTagOpen(false)
                    prependTag(created)
                }}
            />

            <EditAssetModal
                open={editOpen}
                asset={editingAsset}
                tags={tags}
                onCancel={() => {
                    setEditOpen(false)
                    setEditingAsset(null)
                }}
                onSuccess={async () => {
                    setEditOpen(false)
                    setEditingAsset(null)
                    if (viewMode === 'grid') {
                        await fetchGridPage(1, false)
                    } else {
                        await fetchList()
                    }
                }}
                onTagsReload={prependTag}
            />

            <section className={styles.section}>
                <Spin spinning={pageLoading} className={styles.sectionSpin}>
                    <div className={styles.sectionBody}>
                    {viewMode === 'grid' ? (
                        <div className={styles.gridPanel}>
                            <div className={styles.contentHeader}>
                                <div className={styles.sectionTitle}>Grid 网格视图</div>
                                <div className={styles.viewToggle}>
                                    <button
                                        type="button"
                                        className={`${styles.viewToggleBtn} ${styles.viewToggleBtn_active}`}
                                        onClick={() => setViewMode('grid')}
                                    >
                                        Grid
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.viewToggleBtn}
                                        onClick={() => setViewMode('list')}
                                    >
                                        List
                                    </button>
                                </div>
                            </div>
                            {!gridLoading && gridAssets.length === 0 ? (
                                gridTotal === 0 && !keyword && !tagId ? (
                                    <div className={styles.emptyState}>
                                        <p className={styles.emptyText}>还没有素材，上传第一个文件吧</p>
                                        <Button type="primary" onClick={() => navigate('/assets/upload')}>
                                            上传 Upload
                                        </Button>
                                    </div>
                                ) : (
                                    <p className={styles.filterEmpty}>无匹配素材</p>
                                )
                            ) : (
                                <div
                                    ref={gridScrollRef}
                                    className={styles.gridScrollArea}
                                    onScroll={handleGridScroll}
                                >
                                    <VirtualAssetGrid
                                        assets={gridAssets}
                                        scrollRef={gridScrollRef}
                                        selectedIds={selectedAssetIds}
                                        onToggleSelect={handleToggleAssetSelect}
                                        onView={handleViewAsset}
                                        onEdit={handleEditAsset}
                                        onDelete={handleDeleteAsset}
                                    />
                                    {gridLoadingMore && (
                                        <div className={styles.gridLoadMore}>
                                            <Spin size="small" />
                                            加载中…
                                        </div>
                                    )}
                                    {!gridLoadingMore && gridHasMore && gridAssets.length > 0 && (
                                        <div className={styles.gridLoadMore}>继续滚动加载更多</div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className={styles.tablePanel}>
                            <div className={styles.tablePanelHeader}>
                                <span className={styles.tablePanelTitle}>List 列表视图</span>
                                <div className={styles.viewToggle}>
                                    <button
                                        type="button"
                                        className={styles.viewToggleBtn}
                                        onClick={() => setViewMode('grid')}
                                    >
                                        Grid
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.viewToggleBtn} ${styles.viewToggleBtn_active}`}
                                        onClick={() => setViewMode('list')}
                                    >
                                        List
                                    </button>
                                </div>
                            </div>
                            {!listLoading && records.length === 0 ? (
                                total === 0 && !keyword && !tagId ? (
                                    <div className={styles.emptyStateInPanel}>
                                        <p className={styles.emptyText}>还没有素材，上传第一个文件吧</p>
                                        <Button type="primary" onClick={() => navigate('/assets/upload')}>
                                            上传 Upload
                                        </Button>
                                    </div>
                                ) : (
                                    <p className={styles.filterEmptyInPanel}>无匹配素材</p>
                                )
                            ) : (
                                <div className={styles.tableWrap}>
                                    <Table<AssetVO>
                                        rowKey="id"
                                        size="small"
                                        columns={columns}
                                        dataSource={records}
                                        rowSelection={{
                                            selectedRowKeys: selectedAssetIds,
                                            onChange: (keys) => setSelectedAssetIds(keys as number[]),
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
                                            },
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                    </div>
                </Spin>
            </section>
        </div>
    )
}

export default AssetListPage
