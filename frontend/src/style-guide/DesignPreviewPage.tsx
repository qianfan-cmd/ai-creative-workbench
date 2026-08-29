import { useEffect, useState } from 'react'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { Button, Input, Select, Table, Tag } from 'antd'
import { PlusOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getWorkbenchTheme, type ThemeMode } from './antdTheme'
import PreviewAuthCard from './components/PreviewAuthCard'
import PreviewSidebar from './components/PreviewSidebar'
import PreviewTopBar from './components/PreviewTopBar'
import PreviewStatsStrip from './components/PreviewStatsStrip'
import PreviewAssetGrid from './components/PreviewAssetGrid'
import PreviewChatEmpty from './components/PreviewChatEmpty'
import PreviewChatActive from './components/PreviewChatActive'
import PreviewKnowledgePanel from './components/PreviewKnowledgePanel'
import PreviewMattingWelcome from './components/PreviewMattingWelcome'
import PreviewMattingStepSource from './components/PreviewMattingStepSource'
import PreviewMattingStepConfig from './components/PreviewMattingStepConfig'
import PreviewMattingStepCandidates from './components/PreviewMattingStepCandidates'
import PreviewMattingStepSave from './components/PreviewMattingStepSave'
import PreviewMattingDialogs from './components/PreviewMattingDialogs'
import PreviewCampaignImageSources from './components/PreviewCampaignImageSources'
import PreviewCampaignWorkspace from './components/PreviewCampaignWorkspace'
import ThemeToggle from './components/ThemeToggle'
import styles from './DesignPreviewPage.module.css'

interface TableAsset {
  key: string
  name: string
  type: string
  size: string
  tags: string[]
  createdAt: string
}

const TABLE_DATA: TableAsset[] = [
  { key: '1', name: 'hero-banner-v2.png', type: 'image/png', size: '1.2 MB', tags: ['Marketing', 'Hero'], createdAt: '2026-08-10' },
  { key: '2', name: 'character-sprite.png', type: 'image/png', size: '840 KB', tags: ['Game Art'], createdAt: '2026-08-09' },
  { key: '3', name: 'icon-set.svg', type: 'image/svg+xml', size: '56 KB', tags: ['UI', 'Icons'], createdAt: '2026-08-08' },
  { key: '4', name: 'promo-cutscene.mp4', type: 'video/mp4', size: '12.4 MB', tags: ['Video'], createdAt: '2026-08-07' },
]

const columns: ColumnsType<TableAsset> = [
  { title: '文件名', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: '类型', dataIndex: 'type', key: 'type', width: 140 },
  { title: '大小', dataIndex: 'size', key: 'size', width: 100 },
  {
    title: '标签',
    dataIndex: 'tags',
    key: 'tags',
    render: (tags: string[]) =>
      tags.map((tag) => (
        <Tag key={tag} style={{ marginBottom: 2 }}>
          {tag}
        </Tag>
      )),
  },
  { title: '上传时间', dataIndex: 'createdAt', key: 'createdAt', width: 120 },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    render: () => (
      <>
        <Button type="link" size="small" style={{ padding: 0 }}>
          查看
        </Button>
        <Button type="link" size="small" danger style={{ padding: 0, marginLeft: 8 }}>
          删除
        </Button>
      </>
    ),
  },
]

export default function DesignPreviewPage() {
  const [themeMode, setThemeMode] = useState<ThemeMode>('light')

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode
  }, [themeMode])

  return (
    <ConfigProvider theme={getWorkbenchTheme(themeMode)} locale={zhCN}>
      <div className={styles.page}>
        <div className={styles.designBanner}>
          <div className={styles.designBannerLeft}>
            <span className={styles.designBannerTitle}>Studio Neutral · Design System v2</span>
            <span className={styles.designBannerSub}>AI 创意资产与知识工作台</span>
          </div>
          <div className={styles.designBannerRight}>
            <ThemeToggle mode={themeMode} onChange={setThemeMode} />
            <div className={styles.designBannerTokens}>
              <span className={styles.tokenChip}>
                <span className={styles.tokenSwatch} style={{ background: 'var(--color-ink)' }} />
                ink
              </span>
              <span className={styles.tokenChip}>
                <span className={styles.tokenSwatch} style={{ background: 'var(--color-accent)' }} />
                accent
              </span>
              <span className={styles.tokenChip}>
                <span className={styles.tokenSwatch} style={{ background: 'var(--color-canvas)' }} />
                canvas
              </span>
              <span className={styles.tokenChip}>
                <span className={styles.tokenSwatch} style={{ background: 'var(--color-surface)' }} />
                surface
              </span>
            </div>
          </div>
        </div>

        <div className={styles.appShell}>
          <PreviewSidebar />

          <div className={styles.mainColumn}>
            <PreviewTopBar />

            <main className={styles.content}>
              <div className={styles.contentInner}>
                <div className={styles.pageHeader}>
                  <div>
                    <h1 className={styles.pageTitle}>素材 Assets</h1>
                    <p className={styles.pageDesc}>管理创意文件、标签与上传</p>
                  </div>
                  <Button type="primary" icon={<UploadOutlined />}>
                    上传 Upload
                  </Button>
                </div>

                <PreviewStatsStrip />

                <div className={styles.toolbar}>
                  <Input
                    placeholder="搜索素材…"
                    prefix={<SearchOutlined style={{ color: 'var(--color-text-tertiary)' }} />}
                    style={{ width: 260 }}
                    allowClear
                  />
                  <Select
                    placeholder="按标签筛选"
                    style={{ width: 160 }}
                    allowClear
                    options={[
                      { value: 'marketing', label: 'Marketing' },
                      { value: 'ui', label: 'UI' },
                      { value: 'video', label: 'Video' },
                    ]}
                  />
                  <Select
                    defaultValue="desc"
                    style={{ width: 120 }}
                    options={[
                      { value: 'desc', label: '最新' },
                      { value: 'asc', label: '最早' },
                    ]}
                  />
                  <Button icon={<PlusOutlined />}>新建标签</Button>
                </div>

                <section className={styles.section}>
                  <div className={styles.sectionTitle}>Grid 网格视图</div>
                  <PreviewAssetGrid />
                </section>

                <section className={styles.section}>
                  <div className={styles.tablePanel}>
                    <div className={styles.tablePanelHeader}>
                      <span className={styles.tablePanelTitle}>List 列表视图</span>
                      <div className={styles.viewToggle}>
                        <span className={`${styles.viewToggleBtn} ${styles.viewToggleBtn_active}`}>
                          Grid
                        </span>
                        <span className={styles.viewToggleBtn}>List</span>
                      </div>
                    </div>
                    <div className={styles.tableWrap}>
                      <Table
                        columns={columns}
                        dataSource={TABLE_DATA}
                        size="small"
                        pagination={{ pageSize: 5, showSizeChanger: false }}
                      />
                    </div>
                  </div>
                </section>
              </div>
            </main>
          </div>
        </div>

        <PreviewAuthCard />
        <PreviewChatEmpty />
        <PreviewChatActive />
        <PreviewKnowledgePanel />
        <PreviewMattingWelcome />
        <PreviewMattingStepSource />
        <PreviewMattingStepConfig />
        <PreviewMattingStepCandidates />
        <PreviewMattingStepSave />
        <PreviewMattingDialogs />
        <PreviewCampaignImageSources />
        <PreviewCampaignWorkspace />
      </div>
    </ConfigProvider>
  )
}
