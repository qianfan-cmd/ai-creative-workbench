import { Progress, Typography } from 'antd'

import styles from './KnowledgeDocumentProgressBar.module.css'

export interface KnowledgeDocumentProgressBarProps {
  /** 上传到服务器 0～100 */
  uploadPercent: number | null
  uploadLabel?: string
  /** 后台建立索引 0～100；null 不展示 */
  indexPercent: number | null
  indexLabel?: string
}

/**
 * 文档库：上传 + 后台索引进度（Wave E-B3）
 */
export default function KnowledgeDocumentProgressBar({
  uploadPercent,
  uploadLabel,
  indexPercent,
  indexLabel,
}: KnowledgeDocumentProgressBarProps) {
  const showUpload = uploadPercent != null
  const showIndex = indexPercent != null

  if (!showUpload && !showIndex) {
    return null
  }

  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      {showUpload && (
        <div className={styles.block}>
          <Typography.Text type="secondary" className={styles.label}>
            {uploadLabel ?? '正在上传文件到服务器'}
          </Typography.Text>
          <Progress
            percent={uploadPercent}
            status="active"
            strokeColor="var(--color-accent, #0d9488)"
            size="small"
          />
        </div>
      )}
      {showIndex && (
        <div className={styles.block}>
          <Typography.Text type="secondary" className={styles.label}>
            {indexLabel ?? '正在建立向量索引'}
          </Typography.Text>
          <Progress
            percent={indexPercent}
            status={indexPercent >= 100 ? 'success' : 'active'}
            strokeColor="var(--color-accent, #0d9488)"
            size="small"
          />
        </div>
      )}
    </div>
  )
}
