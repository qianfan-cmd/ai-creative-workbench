import { EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { Skeleton } from 'antd'
import type { MattingElementsVO, MattingRegionVO } from '@/api/ops'
import styles from '@/components/ops/ElementListPanel.module.css'

interface ElementListPanelProps {
  data: MattingElementsVO | null
  loading?: boolean
  detecting?: boolean
  onToggle: (elementId: string, checked: boolean) => void
  onRename: (elementId: string, name: string) => void
  onReDetect: (regionId: string) => void
}

function RegionBlock({
  region,
  onToggle,
  onRename,
  onReDetect,
}: {
  region: MattingRegionVO
  onToggle: (elementId: string, checked: boolean) => void
  onRename: (elementId: string, name: string) => void
  onReDetect: (regionId: string) => void
}) {
  return (
    <div className={styles.regionSection}>
      <div className={styles.regionHdr}>
        <span className={styles.regionAccent} aria-hidden="true" />
        <span className={styles.regionLabel}>{region.regionLabel}</span>
        {region.imageUrl && (
          <button type="button" className={styles.regionThumbBtn} title="查看区域切图">
            <img src={region.imageUrl} alt="" className={styles.regionThumbImg} />
          </button>
        )}
        <button type="button" className={styles.regenBtn} onClick={() => onReDetect(region.regionId)}>
          <ReloadOutlined />
          重新识别
        </button>
      </div>
      {region.groups.map((group) => (
        <div key={group.groupName} className={styles.groupBlock}>
          <div className={styles.groupHead}>
            <span className={styles.groupChev} aria-hidden="true">
              ▼
            </span>
            <span className={styles.groupName}>{group.groupName}</span>
            <button type="button" className={styles.addBtn} title="添加元素" disabled>
              <PlusOutlined />
            </button>
          </div>
          <div className={styles.groupBody}>
            {group.elements.map((el) => (
              <div key={el.id} className={styles.elementRow}>
                <button
                  type="button"
                  className={[styles.checkbox, el.checked ? styles.checkbox_checked : ''].join(' ')}
                  aria-label={el.checked ? '取消勾选' : '勾选'}
                  onClick={() => onToggle(el.id, !el.checked)}
                />
                <input
                  className={styles.elementName}
                  value={el.elementName}
                  onChange={(e) => onRename(el.id, e.target.value)}
                />
                <button type="button" className={styles.editBtn} aria-label="编辑">
                  <EditOutlined />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ElementListPanel({
  data,
  loading,
  detecting,
  onToggle,
  onRename,
  onReDetect,
}: ElementListPanelProps) {
  if (loading || detecting) {
    return (
      <div className={styles.shell}>
        <Skeleton active paragraph={{ rows: 6 }} />
        <p className={styles.statusHint}>正在识别图片元素，请稍候…</p>
      </div>
    )
  }

  const hasSources = (data?.sources?.length ?? 0) > 0
  const flatRegions = data?.regions ?? []
  const isEmpty = !data || (!hasSources && flatRegions.length === 0)

  if (isEmpty) {
    return (
      <div className={styles.empty}>
        <p>暂无元素清单，请先完成框选并识别。</p>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <div className={styles.scroll}>
        {data!.detectStatus === 'failed' && data!.detectError && (
          <div className={styles.errorBox}>{data!.detectError}</div>
        )}

        {hasSources
          ? (data!.sources ?? []).map((source) => (
              <div key={source.sourceId}>
                <div className={styles.sourceBlock}>
                  {source.imageUrl && (
                    <button type="button" className={styles.sourceThumb} title="查看整图大图">
                      <img src={source.imageUrl} alt="" className={styles.thumbImg} />
                    </button>
                  )}
                  <div className={styles.sourceMeta}>
                    <span className={styles.sourceKicker}>来源整图</span>
                    <span
                      className={styles.sourceName}
                      title={source.sourceDescription ?? source.label ?? source.sourceId}
                    >
                      {source.sourceDescription ?? source.label ?? source.sourceId}
                    </span>
                  </div>
                </div>
                {source.regions.map((region) => (
                  <RegionBlock
                    key={region.regionId}
                    region={region}
                    onToggle={onToggle}
                    onRename={onRename}
                    onReDetect={onReDetect}
                  />
                ))}
              </div>
            ))
          : flatRegions.map((region) => (
              <RegionBlock
                key={region.regionId}
                region={region}
                onToggle={onToggle}
                onRename={onRename}
                onReDetect={onReDetect}
              />
            ))}
      </div>
    </div>
  )
}
