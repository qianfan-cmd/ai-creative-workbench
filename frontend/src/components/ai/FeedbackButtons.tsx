import { DislikeFilled, DislikeOutlined, LikeFilled, LikeOutlined } from '@ant-design/icons'
import { Input, Modal, Select, message } from 'antd'
import { useEffect, useState } from 'react'
import {
  submitFeedbackApi,
  type AiFeedbackReason,
  type AiFeedbackRefType,
  type AiFeedbackScene,
} from '@/api/feedback'
import { showApiError } from '@/utils/apiError'
import styles from '@/components/ai/FeedbackButtons.module.css'

const { TextArea } = Input

const DOWN_REASONS: { value: AiFeedbackReason; label: string }[] = [
  { value: 'incomplete_list', label: '列举不全' },
  { value: 'wrong_fact', label: '事实错误' },
  { value: 'irrelevant', label: '答非所问' },
  { value: 'other', label: '其他' },
]

interface FeedbackButtonsProps {
  scene: AiFeedbackScene
  refType: AiFeedbackRefType
  refId?: number
  disabled?: boolean
  /** 从服务端恢复的已保存反馈 */
  initialRating?: 'up' | 'down' | null
}

export default function FeedbackButtons({
  scene,
  refType,
  refId,
  disabled = false,
  initialRating = null,
}: FeedbackButtonsProps) {
  const [rating, setRating] = useState<'up' | 'down' | null>(initialRating)

  useEffect(() => {
    setRating(initialRating ?? null)
  }, [initialRating, refId])
  const [submitting, setSubmitting] = useState(false)
  const [downModalOpen, setDownModalOpen] = useState(false)
  const [downReason, setDownReason] = useState<AiFeedbackReason>('incomplete_list')
  const [reasonDetail, setReasonDetail] = useState('')

  const canSubmit = refId != null && refId > 0 && !disabled

  const sendFeedback = async (
    nextRating: 'up' | 'down',
    reason?: AiFeedbackReason,
    detail?: string,
  ) => {
    if (!canSubmit) {
      message.warning('请等待回答保存后再反馈')
      return
    }
    setSubmitting(true)
    try {
      await submitFeedbackApi({
        scene,
        refType,
        refId: refId!,
        rating: nextRating,
        reason: nextRating === 'down' ? reason : undefined,
        reasonDetail: nextRating === 'down' ? detail : undefined,
      })
      setRating(nextRating)
      message.success(nextRating === 'up' ? '感谢反馈' : '已记录，我们会持续改进')
    } catch (error) {
      showApiError(error, '反馈提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUp = () => {
    if (submitting) return
    void sendFeedback('up')
  }

  const handleDownClick = () => {
    if (submitting || !canSubmit) {
      message.warning('请等待回答保存后再反馈')
      return
    }
    setReasonDetail('')
    setDownModalOpen(true)
  }

  const handleDownConfirm = () => {
    if (downReason === 'other' && !reasonDetail.trim()) {
      message.warning('选择「其他」时请填写补充说明')
      return
    }
    if (reasonDetail.length > 500) {
      message.warning('补充说明不能超过 500 字')
      return
    }
    setDownModalOpen(false)
    void sendFeedback('down', downReason, reasonDetail.trim() || undefined)
  }

  return (
    <>
      <div className={styles.group}>
        <button
          type="button"
          className={`${styles.btn} ${rating === 'up' ? styles.btnActiveUp : ''}`}
          title="有帮助"
          disabled={!canSubmit || submitting}
          onClick={handleUp}
        >
          {rating === 'up' ? <LikeFilled /> : <LikeOutlined />}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${rating === 'down' ? styles.btnActiveDown : ''}`}
          title="没帮助"
          disabled={!canSubmit || submitting}
          onClick={handleDownClick}
        >
          {rating === 'down' ? <DislikeFilled /> : <DislikeOutlined />}
        </button>
      </div>

      <Modal
        title="反馈原因"
        open={downModalOpen}
        onOk={handleDownConfirm}
        onCancel={() => setDownModalOpen(false)}
        okText="提交"
        cancelText="取消"
        destroyOnClose
      >
        <Select
          style={{ width: '100%', marginBottom: 12 }}
          value={downReason}
          options={DOWN_REASONS}
          onChange={setDownReason}
        />
        {downReason === 'other' && (
          <TextArea
            placeholder="请描述问题，例如：文档有修复步骤但未答出"
            value={reasonDetail}
            onChange={(e) => setReasonDetail(e.target.value)}
            maxLength={500}
            showCount
            rows={3}
          />
        )}
      </Modal>
    </>
  )
}
