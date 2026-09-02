import { Input, Select } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import styles from '@/components/knowledge/KnowledgeDocToolbar.module.css'

interface KnowledgeDocToolbarProps {
  searchInput: string
  onSearchInputChange: (value: string) => void
  sort: 'asc' | 'desc'
  onSortChange: (value: 'asc' | 'desc') => void
}

export default function KnowledgeDocToolbar({
  searchInput,
  onSearchInputChange,
  sort,
  onSortChange,
}: KnowledgeDocToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <Input
        className={styles.searchInput}
        placeholder="搜索文档"
        prefix={<SearchOutlined style={{ color: 'var(--color-text-tertiary)' }} />}
        allowClear
        value={searchInput}
        onChange={(e) => onSearchInputChange(e.target.value)}
      />
      <Select
        className={styles.sortSelect}
        value={sort}
        onChange={onSortChange}
        options={[
          { value: 'asc', label: '按上传时间升序' },
          { value: 'desc', label: '按上传时间降序' },
        ]}
      />
    </div>
  )
}
