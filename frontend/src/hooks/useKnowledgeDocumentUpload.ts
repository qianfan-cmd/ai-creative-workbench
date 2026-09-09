import { useCallback, useRef, useState } from 'react'
import { Modal, message } from 'antd'

import {
  KNOWLEDGE_MAX_BATCH_UPLOAD,
  KNOWLEDGE_UPLOAD_CHUNK_SIZE,
  uploadKnowledgeDocumentsApi,
} from '@/api/knowledge'
import { validateKnowledgeFile } from '@/constants/knowledgeFormats'

interface UseKnowledgeDocumentUploadOptions {
  onSuccess?: () => void | Promise<void>
}

function chunkFiles(files: File[], size: number): File[][] {
  const chunks: File[][] = []
  for (let i = 0; i < files.length; i += size) {
    chunks.push(files.slice(i, i + size))
  }
  return chunks
}

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

export function useKnowledgeDocumentUpload(options: UseKnowledgeDocumentUploadOptions = {}) {
  const onSuccessRef = useRef(options.onSuccess)
  onSuccessRef.current = options.onSuccess

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const openFilePicker = useCallback(() => {
    const input = fileInputRef.current
    if (!input) {
      message.error('上传组件未就绪，请刷新页面后重试')
      return
    }
    // 允许重复选择同一文件（否则部分浏览器不触发 change）
    input.value = ''
    input.click()
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return

    const files = Array.from(fileList)
    e.target.value = ''

    setUploading(true)
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
      let processed = 0
      let totalSucceeded = 0
      const allFailed = [...invalid]

      hideLoading = message.loading(`正在上传 0/${valid.length}…`, 0)

      for (const chunk of chunks) {
        const result = await uploadKnowledgeDocumentsApi(chunk)
        processed += chunk.length
        hideLoading()
        hideLoading = message.loading(`正在上传 ${processed}/${valid.length}…`, 0)
        totalSucceeded += result.succeeded.length
        allFailed.push(...result.failed)
      }

      hideLoading()
      hideLoading = undefined

      showBatchUploadResult(files.length, totalSucceeded, allFailed)

      if (totalSucceeded > 0) {
        await onSuccessRef.current?.()
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '上传失败')
    } finally {
      hideLoading?.()
      setUploading(false)
    }
  }, [])

  return {
    uploading,
    fileInputRef,
    openFilePicker,
    handleFileChange,
  }
}
