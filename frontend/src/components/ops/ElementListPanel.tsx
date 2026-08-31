import { ReloadOutlined } from '@ant-design/icons'
import { Button, Checkbox, Collapse, Input, Select, Skeleton } from 'antd'
import type { MattingElementsVO } from '@/api/ops'
import styles from '@/components/ops/ElementListPanel.module.css'

interface ElementListPanelProps {
  data: MattingElementsVO | null
  loading?: boolean
  detecting?: boolean
  candidateCount: number
  onCandidateCountChange: (n: number) => void
  onToggle: (elementId: string, checked: boolean) => void
  onRename: (elementId: string, name: string) => void
  onReDetect: (regionId: string) => void
  onConfirmExtract: () => void
  extracting?: boolean
}

export default function ElementListPanel({
  data,
  loading,
  detecting,
  candidateCount,
  onCandidateCountChange,
  onToggle,
  onRename,
  onReDetect,
  onConfirmExtract,
  extracting,
}: ElementListPanelProps) {
  if (loading || detecting) {
    return (
      <div className={styles.wrap}>
        <Skeleton active paragraph={{ rows: 6 }} />
        <p className={styles.statusHint}>正在识别图片元素，请稍候…</p>
      </div>
    )
  }

  if (!data || data.regions.length === 0) {
    return (
      <div className={styles.empty}>
        <p>暂无元素清单，请先完成框选并识别。</p>
      </div>
    )
  }

  const totalElements = data.regions.reduce(
    (sum, r) => sum + r.groups.reduce((gs, g) => gs + g.elements.length, 0),
    0,
  )

  return (
    <div className={styles.wrap}>
      {data.detectStatus === 'failed' && data.detectError && (
        <div className={styles.errorBox}>{data.detectError}</div>
      )}

      <Collapse
        defaultActiveKey={data.regions.map((r) => r.regionId)}
        items={data.regions.map((region) => ({
          key: region.regionId,
          label: (
            <span className={styles.regionLabel}>
              {region.regionLabel}
              {region.imageUrl && (
                <img src={region.imageUrl} alt="" className={styles.regionThumb} />
              )}
            </span>
          ),
          extra: (
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              onClick={(e) => {
                e.stopPropagation()
                onReDetect(region.regionId)
              }}
            >
              重新识别
            </Button>
          ),
          children: (
            <div className={styles.groups}>
              {region.groups.map((group) => (
                <div key={group.groupName} className={styles.group}>
                  <div className={styles.groupName}>{group.groupName}</div>
                  <ul className={styles.elementList}>
                    {group.elements.map((el) => (
                      <li key={el.id} className={styles.elementRow}>
                        <Checkbox
                          checked={el.checked}
                          onChange={(e) => onToggle(el.id, e.target.checked)}
                        />
                        <Input
                          size="small"
                          value={el.elementName}
                          onChange={(e) => onRename(el.id, e.target.value)}
                          className={styles.elementInput}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ),
        }))}
      />

      <div className={styles.footer}>
        <span className={styles.footerLabel}>每元素候选数</span>
        <Select
          size="small"
          value={candidateCount}
          onChange={onCandidateCountChange}
          options={[1, 2, 3, 4].map((n) => ({ value: n, label: `${n} 张` }))}
          className={styles.countSelect}
        />
        <Button
          type="primary"
          loading={extracting}
          disabled={totalElements === 0}
          onClick={onConfirmExtract}
        >
          确认清单，一键提取
        </Button>
      </div>
    </div>
  )
}
