import { useState } from 'react'
import { DownloadOutlined, SaveOutlined } from '@ant-design/icons'
import PreviewCandidateGallery from './PreviewCandidateGallery'
import PreviewCampaignPostCard from './PreviewCampaignPostCard'
import PreviewImageSourcePanel from './PreviewImageSourcePanel'
import sectionStyles from './previewSection.module.css'
import styles from './PreviewCampaignWorkspace.module.css'

type TabKey = 'image' | 'copy' | 'preview'

const IMAGE_CANDIDATES = [
  { id: '1', label: '配图 A', selected: true, previewColor: '#0D9488' },
  { id: '2', label: '配图 B', previewColor: '#18181B' },
  { id: '3', label: '配图 C', previewColor: '#71717A' },
  { id: '4', label: '配图 D', previewColor: '#E4E4E7' },
]

const TABS: { key: TabKey; label: string }[] = [
  { key: 'image', label: '配图' },
  { key: 'copy', label: '文案' },
  { key: 'preview', label: '预览' },
]

export default function PreviewCampaignWorkspace() {
  const [activeTab, setActiveTab] = useState<TabKey>('image')

  return (
    <section className={sectionStyles.section}>
      <div className={sectionStyles.sectionTitle}>活动帖 Campaign · 双栏工作台</div>
      <div className={`${sectionStyles.previewFrame} ${styles.frame}`}>
        <aside className={styles.formPanel}>
          <h3 className={styles.formTitle}>活动信息</h3>

          <div className={styles.field}>
            <label className={styles.label}>活动主题 *</label>
            <div className={styles.inputMock}>夏日版本更新 · 登录即领限定皮肤</div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>活动时间</label>
            <div className={styles.inputMock}>2026-08-15 — 2026-08-31</div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>目标受众</label>
            <div className={styles.inputMock}>活跃玩家 · 回归用户</div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>福利亮点</label>
            <div className={styles.textareaMock}>限定皮肤、登录礼包、每日任务兑换</div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>视觉风格</label>
              <div className={styles.selectMock}>夏日清新</div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>画幅比例</label>
              <div className={styles.selectMock}>16:9</div>
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>禁用词</label>
            <div className={styles.textareaMock}>绝对、第一、100% 中奖</div>
          </div>

          <button type="button" className={styles.draftBtn}>
            <SaveOutlined />
            保存草稿
          </button>
        </aside>

        <div className={styles.rightPanel}>
          <div className={styles.tabs}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`${styles.tab} ${activeTab === tab.key ? styles.tab_active : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={styles.tabBody}>
            {activeTab === 'image' && (
              <>
                <PreviewImageSourcePanel
                  contextLabel="参考图"
                  mode="library-existing"
                  selectedAssetName="mascot-matted.png"
                />
                <div className={styles.divider} />
                <button type="button" className={styles.generateBtn}>生成 4 张候选</button>
                <PreviewCandidateGallery items={IMAGE_CANDIDATES} />
                <p className={styles.imageHint}>
                  选中配图进入草稿包；可另存 Assets · generated
                </p>
              </>
            )}

            {activeTab === 'copy' && (
              <>
                <div className={styles.copyToolbar}>
                  <button type="button" className={styles.generateBtn}>生成初稿</button>
                  <div className={styles.selectMock}>风格模板 · 活动推送</div>
                  <button type="button" className={styles.secondaryBtn}>优化</button>
                </div>
                <div className={styles.prose}>
                  <p>
                    <strong>标题：</strong>夏日版本更新 · 登录即领限定皮肤
                  </p>
                  <p>
                    新版本已上线！完成每日任务即可兑换夏日限定皮肤与道具礼包。
                    活动时间 8/15–8/31，详情见游戏内公告。
                  </p>
                  <p className={styles.proseHint}>流式输出区 — 文档块，非 Chat 气泡</p>
                </div>
              </>
            )}

            {activeTab === 'preview' && (
              <>
                <PreviewCampaignPostCard />
                <div className={styles.previewActions}>
                  <button type="button" className={styles.secondaryBtn}>
                    <DownloadOutlined />
                    下载 zip
                  </button>
                  <button type="button" className={styles.primaryBtn}>
                    <SaveOutlined />
                    保存草稿包
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
