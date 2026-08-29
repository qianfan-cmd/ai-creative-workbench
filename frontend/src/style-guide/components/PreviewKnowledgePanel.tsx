import { FileTextOutlined, UploadOutlined } from '@ant-design/icons'
import PreviewConversationSidebar from './PreviewConversationSidebar'
import PreviewMessageRow from './PreviewMessageRow'
import sectionStyles from './previewSection.module.css'
import styles from './PreviewKnowledgePanel.module.css'

const DOCS = [
  { name: '游戏活动运营手册.md', chunks: 42 },
  { name: '美术风格指南.pdf', chunks: 28 },
  { name: '版本更新 FAQ.txt', chunks: 15 },
]

const HISTORY = [
  { id: '1', title: '夏日活动推送有什么注意事项？', active: true },
  { id: '2', title: 'Agent 是什么？', active: false },
  { id: '3', title: '版本更新文案合规要求', active: false },
]

const REFERENCES = [
  {
    index: 1,
    source: '游戏活动运营手册.md',
    excerpt: '夏日活动推荐在版本更新后 48 小时内推送，配合登录奖励提升留存。',
  },
  {
    index: 2,
    source: '游戏活动运营手册.md',
    excerpt: '推送文案需包含活动起止时间与核心奖励，避免使用绝对化用语。',
  },
]

export default function PreviewKnowledgePanel() {
  return (
    <section className={sectionStyles.section}>
      <div className={sectionStyles.sectionTitle}>知识库 Knowledge · RAG 问答（飞书式线程布局）</div>
      <div className={`${sectionStyles.previewFrame} ${styles.frame}`}>
        <aside className={styles.leftColumn}>
          <div className={styles.docSection}>
            <div className={styles.docSectionHeader}>文档库</div>
            <button type="button" className={styles.uploadBtn}>
              <UploadOutlined />
              上传文档
            </button>
            <div className={styles.docList}>
              {DOCS.map((doc) => (
                <div key={doc.name} className={styles.docItem}>
                  <FileTextOutlined className={styles.docIcon} />
                  <div className={styles.docMeta}>
                    <span className={styles.docName}>{doc.name}</span>
                    <span className={styles.docChunks}>{doc.chunks} chunks</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.divider} />

          <PreviewConversationSidebar
            title="历史问答"
            newButtonLabel="新问答"
            items={HISTORY}
            className={styles.historySidebar}
          />
        </aside>

        <div className={styles.main}>
          <div className={styles.thread}>
            <PreviewMessageRow role="user">
              夏日活动推送有什么注意事项？
            </PreviewMessageRow>

            <div className={styles.answerRow}>
              <div className={`${styles.avatar} ${styles.avatar_ai}`} aria-hidden="true">
                AI
              </div>
              <div className={styles.answerDoc}>
                <p>
                  建议在版本更新后 48 小时内推送夏日活动，并在文案中明确活动时间与核心奖励。
                  <sup className={styles.cite}>[1]</sup>
                </p>
                <p className={styles.answerHeading}>核心注意点</p>
                <ul className={styles.answerList}>
                  <li>
                    明确活动起止时间与参与方式
                    <sup className={styles.cite}>[2]</sup>
                  </li>
                  <li>避免绝对化承诺与违规用语</li>
                  <li>配合登录奖励提升首周留存</li>
                </ul>
              </div>
            </div>

            <div className={styles.references}>
              <div className={styles.referencesLabel}>
                引用资料 References · 共 {REFERENCES.length} 条
              </div>
              <ul className={styles.refList}>
                {REFERENCES.map((ref) => (
                  <li key={ref.index} className={styles.refItem}>
                    <span className={styles.refIndex}>[{ref.index}]</span>
                    <div className={styles.refBody}>
                      <span className={styles.refSource}>{ref.source}</span>
                      <span className={styles.refExcerpt}>{ref.excerpt}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className={styles.composer}>
            <div className={styles.inputMock}>继续提问…</div>
            <button type="button" className={styles.askBtn}>
              提问
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
