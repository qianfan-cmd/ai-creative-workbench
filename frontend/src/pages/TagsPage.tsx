import { Button, Input, Spin, Table, message, Modal } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import styles from '@/pages/TagsPage.module.css'
import { useMainContentLayout } from '@/hooks/useMainContentLayout'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TagVO } from '@/api/tags'
import { listTagsApi, deleteTagApi, batchDeleteTagsApi } from '@/api/tags'
import TagOptionLabel from '@/components/assets/TagOptionLabel'
import { formatDate } from '@/utils/format'
import type { ColumnsType } from 'antd/es/table'
import CreateTagModal from '@/components/assets/CreateTagModal'
import EditTagModal from '@/components/assets/EditTagModal'
import useDebouncedValue from '@/hooks/useDebouncedValue'

export default function TagsPage() {
    const [loading, setLoading] = useState(false)
    const [tags, setTags] = useState<TagVO[]>([])
    const [createTagOpen, setCreateTagOpen] = useState(false)
    const [searchInput, setSearchInput] = useState('')
    const keyword = useDebouncedValue(searchInput.trim().toLowerCase(), 300)
    const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])

    const fetchTags = useCallback(async (cancelled?: () => boolean) => {
        setLoading(true)
        try {
            const data = await listTagsApi()
            if (cancelled?.()) return
            setTags(data)
        } catch (err) {
            if (cancelled?.()) return
            message.error(err instanceof Error ? err.message : '获取标签失败')
        } finally {
            if (!cancelled?.()) {
                setLoading(false)
            }
        }
    }, [])

    const [editTagOpen, setEditTagOpen] = useState(false)
    const [editingTag, setEditingTag] = useState<TagVO | null>(null)

    const handleEditTag = (tag: TagVO) => {
        setEditingTag(tag)
        setEditTagOpen(true)
    }

    const handleDeleteTag = async (tag: TagVO) => {
        Modal.confirm({
            title: '确认删除',
            content: `确定删除标签「${tag.name}」吗？已绑定该标签的素材将解除关联。`,
            okText: '删除',
            okType: 'danger',
            cancelText: '取消',
            onOk: async () => {
                try {
                    await deleteTagApi(tag.id)
                    message.success('删除成功')
                    setTags((prev) => prev.filter((item) => item.id !== tag.id))
                    setSelectedRowKeys((prev) => prev.filter((id) => id !== tag.id))
                } catch (err) {
                    message.error(err instanceof Error ? err.message : '删除失败')
                    throw err
                }
            },
        })
    }

    const handleBatchDelete = () => {
        if (visibleSelectedRowKeys.length === 0) return

        Modal.confirm({
            title: '确认批量删除',
            content: `确定删除选中的 ${visibleSelectedRowKeys.length} 个标签吗？已绑定这些标签的素材将解除关联。`,
            okText: '删除',
            okType: 'danger',
            cancelText: '取消',
            onOk: async () => {
                try {
                    await batchDeleteTagsApi(visibleSelectedRowKeys)
                    message.success('批量删除成功')
                    const deleted = new Set(visibleSelectedRowKeys)
                    setTags((prev) => prev.filter((item) => !deleted.has(item.id)))
                    setSelectedRowKeys((prev) => prev.filter((id) => !deleted.has(id)))
                } catch (err) {
                    message.error(err instanceof Error ? err.message : '批量删除失败')
                    throw err
                }
            },
        })
    }

    useEffect(() => {
        let cancelled = false
        void fetchTags(() => cancelled)
        return () => {
            cancelled = true
        }
    }, [fetchTags])

    useMainContentLayout({ lockScroll: true, fullBleed: true })

    const filteredTags = useMemo(() => {
        if (!keyword) return tags
        return tags.filter(
            (tag) =>
                tag.name.toLowerCase().includes(keyword) ||
                tag.color.toLowerCase().includes(keyword),
        )
    }, [tags, keyword])

    const visibleSelectedRowKeys = useMemo(() => {
        const visibleIds = new Set(filteredTags.map((tag) => tag.id))
        return selectedRowKeys.filter((id) => visibleIds.has(id))
    }, [filteredTags, selectedRowKeys])

    const columns: ColumnsType<TagVO> = [
        {
            title: '标签名',
            dataIndex: 'name',
            key: 'name',
            render: (_, record) => <TagOptionLabel tag={record} />
        },
        {
            title: '颜色',
            dataIndex: 'color',
            key: 'color',
            width: 140,
            render: (color: string) => <span className={styles.monoCell}>{color}</span>
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 140,
            render: (date: string) => formatDate(date)
        },
        {
            title: '操作',
            key: 'actions',
            width: 120,
            fixed: 'right',
            render: (_, record) => (
                <div className={styles.actionCell}>
                    <Button type="link" size="small" onClick={() => handleEditTag(record)}>
                        编辑
                    </Button>
                    <Button type="link" size="small" danger onClick={() => handleDeleteTag(record)}>
                        删除
                    </Button>
                </div>
            ),
        },
    ]

    return (
        <div className={`${styles.page} ${styles.page_lockScroll}`}>
            <header className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>标签 Tag</h1>
                    <p className={styles.pageDesc}>管理素材分类颜色标记</p>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateTagOpen(true)}>
                    新建标签
                </Button>
            </header>

            <section className={styles.section}>
                <Spin spinning={loading} className={styles.sectionSpin}>
                    <div className={styles.sectionBody}>
                        <div className={styles.tablePanel}>
                            <div className={styles.tablePanelHeader}>
                                <span className={styles.tablePanelTitle}>全部标签</span>
                                <div className={styles.tablePanelActions}>
                                    <Input
                                        className={styles.searchInput}
                                        placeholder="搜索标签名或颜色"
                                        prefix={<SearchOutlined style={{ color: 'var(--color-text-tertiary)' }} />}
                                        allowClear
                                        value={searchInput}
                                        onChange={(e) => setSearchInput(e.target.value)}
                                    />
                                    <Button
                                        danger
                                        disabled={visibleSelectedRowKeys.length === 0}
                                        onClick={handleBatchDelete}
                                    >
                                        批量删除 ({visibleSelectedRowKeys.length})
                                    </Button>
                                </div>
                            </div>

                            {!loading && tags.length === 0 ? (
                                <p className={styles.emptyText}>暂无标签，点击右上角创建</p>
                            ) : !loading && filteredTags.length === 0 ? (
                                <p className={styles.emptyText}>无匹配标签</p>
                            ) : (
                                <div className={styles.tableScrollArea}>
                                    <div className={styles.tableWrap}>
                                        <Table
                                            rowKey="id"
                                            size="small"
                                            columns={columns}
                                            dataSource={filteredTags}
                                            pagination={false}
                                            rowSelection={{
                                                selectedRowKeys: visibleSelectedRowKeys,
                                                onChange: (keys) => setSelectedRowKeys(keys as number[]),
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </Spin>
            </section>

            <CreateTagModal
                open={createTagOpen}
                onCancel={() => setCreateTagOpen(false)}
                onSuccess={(created) => {
                    setCreateTagOpen(false)
                    setTags((prev) => {
                        if (prev.some((t) => t.id === created.id)) return prev
                        return [created, ...prev]
                    })
                }}
            />
            <EditTagModal
                open={editTagOpen}
                tag={editingTag}
                onCancel={() => {
                    setEditTagOpen(false)
                    setEditingTag(null)
                }}
                onSuccess={() => {
                    setEditTagOpen(false)
                    setEditingTag(null)
                    void fetchTags()
                }}
            />
        </div>
    )
}
