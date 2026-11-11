import { useCallback, useRef, useState } from 'react'
import { Modal, message } from 'antd'

import {
  KNOWLEDGE_MAX_BATCH_UPLOAD,
  KNOWLEDGE_UPLOAD_CHUNK_SIZE,
  uploadKnowledgeDocumentsApi,
} from '@/api/knowledge'
import { validateKnowledgeFile } from '@/constants/knowledgeFormats'

/** 上传成功回调：便于列表页按「本次上传批次」展示索引进度 */
export interface KnowledgeUploadSuccessMeta {
  /** 本批上传成功落库的 documentId（分母 = 长度） */
  uploadedDocumentIds: number[]
  /** 其中走 MQ 异步索引的 id（仅用于提示文案，进度按 ready 数量计） */
  asyncDocumentIds: number[]
}

/** 上传 Hook 配置项 */
interface UseKnowledgeDocumentUploadOptions {
  onSuccess?: (meta: KnowledgeUploadSuccessMeta) => void | Promise<void>
}

/** 将文件列表按固定大小切分为多批，避免单次 HTTP 超时 */
function chunkFiles(files: File[], size: number): File[][] {
  const chunks: File[][] = []
  for (let i = 0; i < files.length; i += size) {
    chunks.push(files.slice(i, i + size))
  }
  return chunks
}

/** 根据批量上传结果展示成功/失败提示与详情弹窗 */
function showBatchUploadResult(total: number, succeeded: number, failed: { filename: string; reason: string }[]) {
  if (succeeded > 0) {
    message.success(
      succeeded === total
        ? `已成功上传 ${succeeded} 个文档`
        : `已成功上传 ${succeeded}/${total} 个文档`,
    )
  }

  if (failed.length > 0) {
    const detail = failed.map((item) => `${item.filename}：${item.reason}`).join('\n')
    message.error(failed.length === 1 ? detail : `${failed.length} 个文件未能上传`)
    Modal.warning({
      title: `${failed.length} 个文件上传失败`,
      content: detail,
    })
  }

  if (succeeded === 0 && failed.length === 0) {
    message.error('上传失败')
  }
}

function isAsyncIndexItem(item: {
  indexStatus?: string
  jobId?: number
  chunkCount?: number
}): boolean {
  return (
    item.indexStatus === 'pending_index' ||
    item.indexStatus === 'indexing' ||
    (item.jobId != null && (item.chunkCount ?? 0) === 0)
  )
}

/**
 * 知识库文档批量上传 Hook
 * 校验格式 → 分片 POST /knowledge/documents/upload → 汇总结果
 */
export function useKnowledgeDocumentUpload(options: UseKnowledgeDocumentUploadOptions = {}) {
  const onSuccessRef = useRef(options.onSuccess)
  onSuccessRef.current = options.onSuccess

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  /** 上传到服务器进度 0～100，非上传中为 null */
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadProgressLabel, setUploadProgressLabel] = useState<string>('')

  const openFilePicker = useCallback(() => {
    const input = fileInputRef.current
    if (!input) {
      message.error('上传组件未就绪，请刷新页面后重试')
      return
    }
    input.value = ''
    input.click()
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return

    const files = Array.from(fileList)
    e.target.value = ''

    setUploading(true)
    setUploadProgress(0)
    setUploadProgressLabel('准备上传…')
    let hideLoading: (() => void) | undefined

    try {
      if (files.length > KNOWLEDGE_MAX_BATCH_UPLOAD) {
        message.error(`单次最多上传 ${KNOWLEDGE_MAX_BATCH_UPLOAD} 个文件`)
        return
      }

      const invalid: { filename: string; reason: string }[] = []
      const valid: File[] = []
      for (const file of files) {
        const err = validateKnowledgeFile(file)
        if (err) {
          invalid.push({ filename: file.name, reason: err })
        } else {
          valid.push(file)
        }
      }

      if (valid.length === 0) {
        showBatchUploadResult(files.length, 0, invalid)
        return
      }

      const chunks = chunkFiles(valid, KNOWLEDGE_UPLOAD_CHUNK_SIZE)
      let filesDoneBeforeChunk = 0
      let totalSucceeded = 0
      const allFailed = [...invalid]
      let asyncIndexCount = 0
      const asyncDocumentIds: number[] = []
      const uploadedDocumentIds: number[] = []

      hideLoading = message.loading(`正在上传 0/${valid.length}…`, 0)

      for (const chunk of chunks) {
        const chunkStart = filesDoneBeforeChunk
        const result = await uploadKnowledgeDocumentsApi(chunk, {
          onChunkProgress: (ratio) => {
            const virtualDone = chunkStart + ratio * chunk.length
            const percent = Math.min(100, Math.round((virtualDone / valid.length) * 100))
            setUploadProgress(percent)
            setUploadProgressLabel(`正在上传 ${Math.floor(virtualDone)}/${valid.length} 个文件…`)
          },
        })

        filesDoneBeforeChunk += chunk.length
        const percent = Math.min(100, Math.round((filesDoneBeforeChunk / valid.length) * 100))
        setUploadProgress(percent)
        setUploadProgressLabel(`正在上传 ${filesDoneBeforeChunk}/${valid.length} 个文件…`)

        hideLoading()
        hideLoading = message.loading(`正在上传 ${filesDoneBeforeChunk}/${valid.length}…`, 0)
        totalSucceeded += result.succeeded.length
        allFailed.push(...result.failed)

        for (const item of result.succeeded) {
          if (item.documentId != null) {
            uploadedDocumentIds.push(item.documentId)
          }
          if (isAsyncIndexItem(item)) {
            asyncIndexCount += 1
            if (item.documentId != null) {
              asyncDocumentIds.push(item.documentId)
            }
          }
        }
      }

      hideLoading()
      hideLoading = undefined

      showBatchUploadResult(files.length, totalSucceeded, allFailed)

      if (asyncIndexCount > 0) {
        message.info(
          asyncIndexCount === 1
            ? '文件已保存，正在后台建立索引，下方进度条将更新状态'
            : `${asyncIndexCount} 个文件已保存，正在后台建立索引，下方进度条将更新状态`,
        )
      }

      if (totalSucceeded > 0) {
        await onSuccessRef.current?.({ uploadedDocumentIds, asyncDocumentIds })
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '上传失败')
    } finally {
      hideLoading?.()
      setUploading(false)
      setUploadProgress(null)
      setUploadProgressLabel('')
    }
  }, [])

  return {
    uploading,
    uploadProgress,
    uploadProgressLabel,
    fileInputRef,
    openFilePicker,
    handleFileChange,
  }
}
