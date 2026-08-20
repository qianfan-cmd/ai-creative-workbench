/**
 * 标签色点组件
 */
import type { TagVO } from '@/api/tags'
import styles from './TagOptionLabel.module.css'

export default function TagOptionLabel({ tag }: { tag: TagVO }) {
    return (
        <span className={styles.tagOption}>
            <span
             className={styles.tagDot}
             style={{ backgroundColor: tag.color || 'var(--color-text-accent)' }}
            ></span>
            <span className={styles.tagOptionName}>{tag.name}</span>
        </span>
    )
}