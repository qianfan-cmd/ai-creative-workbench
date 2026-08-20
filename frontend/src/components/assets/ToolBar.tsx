import { Button, Input, Select } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import styles from './ToolBar.module.css'
import type { TagVO } from '@/api/tags'
import TagOptionLabel from '@/components/assets/TagOptionLabel'

interface AssetToolBarProps {
    searchInput: string
    onSearchInputChange: (value: string) => void
    sort: 'asc' | 'desc'
    onSortChange: (value: 'asc' | 'desc') => void
    tags: TagVO[]
    tagId?: number
    onTagIdChange: (tagId?: number) => void
    onCreateTagClick: () => void
}

interface BreadcrumbItem {
    label: string
    href?: string
}

interface ToolBarProps {
    items: BreadcrumbItem[]
}

export default function Toolbar({
    searchInput,
    onSearchInputChange,
    sort,
    onSortChange,
    tags,
    tagId,
    onTagIdChange,
    onCreateTagClick
}: AssetToolBarProps) {
  return (
    <div className={styles.toolbar}>
        <Input 
          className={styles.searchInput}
          placeholder="搜索素材"
          prefix={<SearchOutlined style={{ color: 'var(--color-text-tertiary)'}}/>}
          allowClear
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
        />

        <Select
        className={styles.tagSelect}
        placeholder="按标签筛选"
        allowClear
        value={tagId}
        onChange={(value) => onTagIdChange(value)}
        options={tags.map(tag => ({ value: tag.id, label: tag.name, tag }))}
        optionRender={(option) => {
            const tag = option.data.tag as TagVO
            if (!tag) return option.label;
            return <TagOptionLabel tag={tag} />
        }}
        labelRender={({value}) => {
            const tag = tags.find(t => t.id === value)
            if (!tag) return value;
            return <TagOptionLabel tag={tag} />
        }}
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

        <Button icon={<PlusOutlined />} onClick={onCreateTagClick}>
            新建标签
        </Button>
    </div>
  )
}