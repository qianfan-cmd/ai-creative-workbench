import { FileTextOutlined, SearchOutlined } from '@ant-design/icons'
import styles from './PreviewKnowledgePanel.module.css'

const DOCS = [
  { name: '游戏活动运营手册.md', chunks: 42 },
  { name: '美术风格指南.pdf', chunks: 28 },
  { name: '版本更新 FAQ.txt', chunks: 15 },
]

const REFERENCES = [
  { source: '游戏活动运营手册.md', excerpt: '夏日活动推荐在版本更新后 48 小时内推送，配合登录奖励提升留存。' },
  { source: '游戏活动运营手册.md', excerpt: '推送文案需包含活动起止时间与核心奖励，避免使用绝对化用语。' },
]

export default function PreviewKnowledgePanel() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>知识库 Knowledge · RAG 问答预览</div>
      <div className={styles.layout}>
        <aside className={styles.docList}>
          <div className={styles.docListHeader}>已索引文档</div>
          {DOCS.map((doc) => (
            <div key={doc.name} className={styles.docItem}>
              <FileTextOutlined className={styles.docIcon} />
              <div className={styles.docMeta}>
                <span className={styles.docName}>{doc.name}</span>
                <span className={styles.docChunks}>{doc.chunks} chunks</span>
              </div>
            </div>
          ))}
        </aside>

        <div className={styles.qaPanel}>
          <div className={styles.queryMock}>
            <SearchOutlined />
            <span>夏日活动推送有什么注意事项？</span>
          </div>

          <div className={styles.answer}>
            <div className={styles.answerLabel}>RAG 回答</div>
            <p>
              建议在版本更新后 48 小时内推送夏日活动，并在文案中明确活动时间与核心奖励。推送内容需合规，避免绝对化承诺。
            </p>
          </div>

          <div className={styles.references}>
            <div className={styles.referencesLabel}>引用片段 References</div>
            {REFERENCES.map((ref, i) => (
              <div key={i} className={styles.refCard}>
                <div className={styles.refSource}>{ref.source}</div>
                <div className={styles.refExcerpt}>{ref.excerpt}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
