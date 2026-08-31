import { ReloadOutlined } from '@ant-design/icons'
import { Badge, Button, Spin } from 'antd'
import type { MattingExtractStatusVO } from '@/api/ops'
import styles from '@/components/ops/ElementCandidateGallery.module.css'

interface ElementCandidateGalleryProps {
  status: MattingExtractStatusVO | null
  loading?: boolean
  onSelectSlot: (elementId: string, slotIndex: number) => void
  onRetryElement?: (elementId: string) => void
}

export default function ElementCandidateGallery({
  status,
  loading,
  onSelectSlot,
  onRetryElement,
}: ElementCandidateGalleryProps) {
  if (loading && !status?.elements?.length) {
    return (
      <div className={styles.wrap}>
        <Spin tip="正在提取元素候选…" />
      </div>
    )
  }

  if (!status || status.elements.length === 0) {
    return (
      <div className={styles.empty}>暂无提取结果，请先在元素步骤确认清单。</div>
    )
  }

  const isRunning = status.extractStatus === 'running'

  return (
    <div className={styles.wrap}>
      {status.extractError && <div className={styles.errorBox}>{status.extractError}</div>}
      {isRunning && (
        <div className={styles.runningHint}>
          <Spin size="small" /> 提取进行中，页面将自动刷新…
        </div>
      )}

      {status.elements.map((el) => (
        <section key={el.elementId} className={styles.elementSection}>
          <div className={styles.elementHeader}>
            <span className={styles.elementTitle}>
              {el.elementName}
              <span className={styles.groupTag}>{el.groupName}</span>
            </span>
            {el.status === 'partial_failed' && (
              <Badge status="error" text="部分失败" />
            )}
            {el.status === 'running' && <Badge status="processing" text="生成中" />}
            {el.status === 'failed' && onRetryElement && (
              <Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => onRetryElement(el.elementId)}>
                重试
              </Button>
            )}
          </div>
          <div className={styles.slotGrid}>
            {el.images.map((img) => (
              <button
                key={`${el.elementId}-${img.slotIndex}`}
                type="button"
                disabled={img.status !== 'done' || !img.url}
                className={[
                  styles.slot,
                  img.selected ? styles.slotSelected : '',
                  img.status === 'failed' ? styles.slotFailed : '',
                ].join(' ')}
                onClick={() => img.url && onSelectSlot(el.elementId, img.slotIndex!)}
              >
                {img.status === 'pending' || img.status === 'running' ? (
                  <Spin size="small" />
                ) : img.status === 'failed' ? (
                  <span className={styles.failedText}>失败</span>
                ) : img.url ? (
                  <img src={img.url} alt={`${el.elementName} ${img.slotIndex! + 1}`} className={styles.slotImg} />
                ) : null}
                <span className={styles.slotLabel}>候选 {String.fromCharCode(65 + (img.slotIndex ?? 0))}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
