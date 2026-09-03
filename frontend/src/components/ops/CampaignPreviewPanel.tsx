import { CopyOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons'
import { Button, Input, Segmented, Tooltip, message } from 'antd'
import { useState } from 'react'
import CampaignNowcoderMobilePreview from '@/components/ops/CampaignNowcoderMobilePreview'
import CampaignNowcoderWebPreview from '@/components/ops/CampaignNowcoderWebPreview'
import styles from '@/components/ops/CampaignPreviewPanel.module.css'

type PreviewMode = 'web' | 'mobile'

interface CampaignPreviewPanelProps {
  imageUrls?: string[]
  title: string
  body: string
  hashtag: string
  onHashtagChange: (value: string) => void
  aspectLabel?: string
  onSavePost?: () => void
  savingPost?: boolean
  onExport?: () => void
  exportDisabled?: boolean
}

export default function CampaignPreviewPanel({
  imageUrls = [],
  title,
  body,
  hashtag,
  onHashtagChange,
  aspectLabel,
  onSavePost,
  savingPost,
  onExport,
  exportDisabled,
}: CampaignPreviewPanelProps) {
  const [mode, setMode] = useState<PreviewMode>('web')

  const handleCopy = async () => {
    const text = `${title}\n\n${body}`.trim()
    if (!text) {
      message.warning('暂无文案可复制')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      message.success('已复制标题与正文')
    } catch {
      message.error('复制失败，请手动选择复制')
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <div className={styles.segmentedWrap}>
          <Segmented
            block
            value={mode}
            onChange={(v) => setMode(v as PreviewMode)}
            options={[
              { label: 'Web 端', value: 'web' },
              { label: '移动端', value: 'mobile' },
            ]}
          />
        </div>
        <div className={styles.hashtagField}>
          <span className={styles.hashtagLabel}>话题</span>
          <Input
            className={styles.hashtagInput}
            value={hashtag}
            onChange={(e) => onHashtagChange(e.target.value)}
            placeholder="#活动"
          />
        </div>
      </div>

      <div className={styles.previewArea}>
        {mode === 'web' ? (
          <CampaignNowcoderWebPreview
            imageUrls={imageUrls}
            title={title}
            body={body}
            hashtag={hashtag}
            aspectLabel={aspectLabel}
          />
        ) : (
          <CampaignNowcoderMobilePreview
            imageUrls={imageUrls}
            title={title}
            body={body}
            hashtag={hashtag}
          />
        )}
      </div>

      <div className={styles.actions}>
        {onSavePost && (
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={savingPost}
            onClick={onSavePost}
          >
            保存活动帖
          </Button>
        )}
        <Tooltip title="即将支持牛客发帖 API">
          <Button icon={<SendOutlined />} disabled>
            发布
          </Button>
        </Tooltip>
        <Button icon={<CopyOutlined />} onClick={() => void handleCopy()}>
          复制标题+正文
        </Button>
        {onExport && (
          <Button disabled={exportDisabled} onClick={onExport}>
            下载草稿包 zip
          </Button>
        )}
      </div>
    </div>
  )
}
