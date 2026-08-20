import { Popover, Space, Tag } from 'antd'
import type { TagVO } from '@/api/tags'
import styles from '@/pages/AssetListPage.module.css'

const MAX_VISIBLE_TAGS = 2  // 最多显示 2 个，可按 UI 调

function TagListCell({ tags }: { tags: TagVO[] }) {
  if (!tags.length) return <>—</>

  const visible = tags.slice(0, MAX_VISIBLE_TAGS)
  const hidden = tags.slice(MAX_VISIBLE_TAGS)

  return (
    <div className={styles.tagCell}>
      <Space size={[4, 4]} wrap>
        {visible.map((tag) => (
          <Tag key={tag.id} color={tag.color}>
            {tag.name}
          </Tag>
        ))}

        {hidden.length > 0 && (
          <Popover
            trigger="hover"
            placement="top"
            content={
              <Space size={[4, 4]} wrap className={styles.tagPopover}>
                {hidden.map((tag) => (
                  <Tag key={tag.id} color={tag.color}>
                    {tag.name}
                  </Tag>
                ))}
              </Space>
            }
          >
            <Tag className={styles.moreTag}>+{hidden.length}</Tag>
          </Popover>
        )}
      </Space>
    </div>
  )
}

export default TagListCell;