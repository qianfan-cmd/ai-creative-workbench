import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, message, Spin, Modal, Table, Tag } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { listAssetsApi, getAssetStatsApi, deleteAssetApi } from '@/api/assets'
import type { AssetVO, AssetStatsVO } from '@/types/api'
import styles from '@/pages/AssetListPage.module.css'
import AssetStatsStrip from '@/components/assets/AssetStatsStrip'
import Toolbar from '@/components/assets/ToolBar'
import useDebouncedValue from '@/hooks/useDebouncedValue'
import { listTagsApi } from '@/api/tags'
import type { TagVO } from '@/api/tags'
import CreateTagModal from '@/components/assets/CreateTagModal'
import AssetGrid from '@/components/assets/AssetGrid'
import type { ColumnsType } from 'antd/es/table'
import { formatDate, formatFileSize } from '@/utils/format'
import EditAssetModal from '@/components/assets/EditAssetModal'
import TagListCell from '@/components/assets/TagListCell'


const AssetListPage = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [records, setRecords] = useState<AssetVO[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [size, setSize] = useState(10);

    const [stats, setStats] = useState<AssetStatsVO>({
        total: 0,
        last7DaysCount: 0,
        prev7DaysCount: 0,
        knowledgeDocCount: 0,
    });

    const [searchInput, setSearchInput] = useState('');
    const keyword = useDebouncedValue(searchInput.trim(), 300);

    const [tagId, setTagId] = useState<number | undefined>();
    const [sort, setSort] = useState<'asc' | 'desc'>('desc');

    const [tags, setTags] = useState<TagVO[]>([]);
    const [createTagOpen, setCreateTagOpen] = useState(false);

    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

    const [editOpen, setEditOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<AssetVO | null>(null);

    const handleEditAsset = (asset: AssetVO) => {
        setEditingAsset(asset)
        setEditOpen(true)
    }

    useEffect(() => {
        listTagsApi().then(setTags);
    }, []);

    const fetchList = useCallback(async () => {
        setLoading(true);
        try {
            const data = await listAssetsApi({
                page,
                size,
                tagId,
                keyword: keyword || undefined,
                sort,
            })
            setRecords(data.records);
            setTotal(data.total);
        } catch (err) {
            message.error(err instanceof Error ? err.message : '获取素材列表失败');
        } finally {
            setLoading(false);
        }
    }, [page, size, keyword, sort, tagId]);

    useEffect(() => {
        fetchList()
    }, [fetchList])

    const handleSearchChange = (value: 'asc' | 'desc') => {
        setSort(value);
        setPage(1);
    }

    useEffect(() => {
        setPage(1);
    }, [keyword, tagId])

    const fetchStats = useCallback(async () => {
        try {
            const data = await getAssetStatsApi();
            setStats(data);
        } catch (err) {
            message.error(err instanceof Error ? err.message : '获取素材统计失败');
        }
    }, [])

    useEffect(() => {
        fetchStats()
    }, [fetchStats])

    /**获取tag列表 */
    const reloadTags = useCallback(async () => {
        const data = await listTagsApi();
        setTags(data);
    }, []);

    useEffect(() => {
        reloadTags();
    }, [reloadTags]);

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

                    // 若当前页删空了且不是第一页，回退一页
                    if (records.length === 1 && page > 1) {
                        setPage(page - 1)
                    } else {
                        await fetchList()
                    }

                    await fetchStats()
                } catch (err) {
                    message.error(err instanceof Error ? err.message : '删除失败')
                    throw err // 让 Modal 保持打开/loading 结束
                }
            },
        })
    }

    /**表格视图组件列定义 */
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
            width: 168,          // 够放「查看 编辑 删除」一行
            fixed: 'right',      // 可选：窄屏时操作列贴右不挤
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
    ];

    return (
        <div className={styles.page}>
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
            />

            <CreateTagModal
                open={createTagOpen}
                onCancel={() => setCreateTagOpen(false)}
                onSuccess={() => {
                    setCreateTagOpen(false)
                    reloadTags()
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
                    await fetchList()
                }}
                onTagsReload={reloadTags}
            />

            <section className={styles.section}>
                <Spin spinning={loading}>
                    {viewMode === 'grid' ? (
                        <>
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
                            {!loading && records.length === 0 ? (
                                total === 0 && !keyword && !tagId ? (
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
                                <AssetGrid
                                    assets={records}
                                    onView={handleViewAsset}
                                    onEdit={handleEditAsset}
                                    onDelete={handleDeleteAsset}
                                />
                            )}
                        </>
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
                            {!loading && records.length === 0 ? (
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

export default AssetListPage;