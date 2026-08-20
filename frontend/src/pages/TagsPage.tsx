import { Button, Spin, Table, message, Modal } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import styles from '@/pages/TagsPage.module.css'
import layoutStyles from '@/layouts/MainLayout.module.css'
import { useCallback, useEffect, useState } from 'react'
import type { TagVO } from '@/api/tags'
import { listTagsApi, deleteTagApi } from '@/api/tags'
import TagOptionLabel from '@/components/assets/TagOptionLabel'
import { formatDate } from '@/utils/format'
import type { ColumnsType } from 'antd/es/table'
import CreateTagModal from '@/components/assets/CreateTagModal'
import EditTagModal from '@/components/assets/EditTagModal'

export default function TagsPage() {
    const [loading, setLoading] = useState(false)
    const [tags, setTags] = useState<TagVO[]>([])
    const [createTagOpen, setCreateTagOpen] = useState(false)

    const fetchTags = useCallback(async () => {
        setLoading(true)
        try {
            const data = await listTagsApi();
            setTags(data)
        } catch (err) {
            message.error(err instanceof Error ? err.message : '获取标签失败')
        } finally {
            setLoading(false)
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
                    message.success("删除成功")
                    await fetchTags()
                } catch (err) {
                    message.error(err instanceof Error ? err.message : "删除失败")
                    throw err;
                }
            },
        })
    }

    useEffect(() => {
        fetchTags()
    }, [fetchTags])

    // 进入标签页：锁住 MainLayout的外层滚动，只让列表区域滚动
    useEffect(() => {
        const main = document.getElementById('main-content');
        if (!main) return;

        main.classList.add(layoutStyles.content_lockScroll);

        return () => {
            main.classList.remove(layoutStyles.content_lockScroll);
        }
    }, [])

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
                            </div>

                            {!loading && tags.length === 0 ? (
                                <p className={styles.emptyText}>暂无标签，点击右上角创建</p>
                            ) : (
                                <div className={styles.tableScrollArea}>
                                    <div className={styles.tableWrap}>
                                        <Table
                                            rowKey="id"
                                            size="small"
                                            columns={columns}
                                            dataSource={tags}
                                            pagination={false}
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
                onSuccess={() => {
                    setCreateTagOpen(false)
                    void fetchTags()
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