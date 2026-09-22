import type { RagReferenceVO } from '@/api/knowledge'
import styles from '@/components/knowledge/RagReferencesPanel.module.css'

interface RagReferencesPanelProps {
  references: RagReferenceVO[]
}

/** RAG 回答引用片段列表（来源 + 摘要） */
export default function RagReferencesPanel({ references }: RagReferencesPanelProps) {
  if (references.length === 0) return null

  return (
    <div className={styles.references}>
      <div className={styles.referencesLabel}>
        引用资料 References · 共 {references.length} 条
      </div>
      <ul className={styles.refList}>
        {references.map((ref, index) => (
          <li key={`${ref.source ?? 'ref'}-${index}`} className={styles.refItem}>
            <span className={styles.refIndex}>[{index + 1}]</span>
            <div className={styles.refBody}>
              <span className={styles.refSource}>{ref.source ?? `片段 ${index + 1}`}</span>
              <span className={styles.refExcerpt}>{ref.content}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
