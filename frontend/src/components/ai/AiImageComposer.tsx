import { FolderOpenOutlined } from '@ant-design/icons'
import { Button, Input, Modal, Spin, message } from 'antd'
import { useCallback, useRef, useState } from 'react'
import { listAssetsApi, uploadAssetApi } from '@/api/assets'
import type { AssetVO } from '@/types/api'
import styles from '@/components/ai/AiImageComposer.module.css'

export interface AiComposerAttachment {
  assetId?: number
  url: string
  name?: string
}

export interface AiComposerPayload {
  text: string
  attachments: AiComposerAttachment[]
}

interface AiImageComposerProps {
  loading?: boolean
  streaming?: boolean
  onStop?: () => void
  placeholder?: string
  maxAttachments?: number
  onSend: (payload: AiComposerPayload) => void
  confirmAction?: React.ReactNode
  toolbarExtra?: React.ReactNode
}

const MAX_FILE_BYTES = 10 * 1024 * 1024

export default function AiImageComposer({
  loading = false,
  streaming = false,
  onStop,
  placeholder = '输入描述，Enter 发送，Shift+Enter 换行',
  maxAttachments = 4,
  onSend,
  confirmAction,
  toolbarExtra,
}: AiImageComposerProps) {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<AiComposerAttachment[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [libraryAssets, setLibraryAssets] = useState<AssetVO[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [librarySelected, setLibrarySelected] = useState<Set<number>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)

  const addAttachment = useCallback(
    (item: AiComposerAttachment) => {
      setAttachments((prev) => {
        if (prev.length >= maxAttachments) {
          message.warning(`最多附加 ${maxAttachments} 张图片`)
          return prev
        }
        if (prev.some((p) => p.url === item.url)) return prev
        return [...prev, item]
      })
    },
    [maxAttachments],
  )

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (list.length === 0) return
    for (const file of list) {
      if (file.size > MAX_FILE_BYTES) {
        message.error(`${file.name} 超过 10MB`)
        continue
      }
      try {
        const uploaded = await uploadAssetApi(file)
        addAttachment({
          assetId: uploaded.id,
          url: uploaded.url,
          name: uploaded.name,
        })
      } catch (e) {
        message.error(e instanceof Error ? e.message : '上传失败')
      }
    }
  }

  const openLibrary = async () => {
    setLibraryOpen(true)
    setLibraryLoading(true)
    try {
      const page = await listAssetsApi({ page: 1, size: 48 })
      setLibraryAssets(page.records ?? [])
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载素材失败')
    } finally {
      setLibraryLoading(false)
    }
  }

  const confirmLibrary = () => {
    for (const id of librarySelected) {
      const asset = libraryAssets.find((a) => a.id === id)
      if (asset) addAttachment({ assetId: asset.id, url: asset.url, name: asset.name })
    }
    setLibrarySelected(new Set())
    setLibraryOpen(false)
  }

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed && attachments.length === 0) return
    onSend({ text: trimmed, attachments })
    setText('')
    setAttachments([])
  }

  return (
    <>
      <div
        className={[styles.composer, dragActive ? styles.composerDrag : ''].filter(Boolean).join(' ')}
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragActive(false)
          if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files)
        }}
        onPaste={(e) => {
          const items = e.clipboardData?.files
          if (items?.length) {
            e.preventDefault()
            void handleFiles(items)
          }
        }}
      >
        {attachments.length > 0 && (
          <div className={styles.attachments}>
            {attachments.map((a) => (
              <div key={a.url} className={styles.chip}>
                <img src={a.url} alt={a.name ?? '附件'} className={styles.chipImg} />
                <button
                  type="button"
                  className={styles.chipRemove}
                  onClick={() => setAttachments((prev) => prev.filter((p) => p.url !== a.url))}
                  aria-label="移除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <Input.TextArea
          className={styles.textarea}
          autoSize={{ minRows: 3, maxRows: 8 }}
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={loading || streaming}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (!loading && !streaming) handleSend()
            }
          }}
        />

        <div className={styles.toolbar}>
          <Button size="small" onClick={() => fileRef.current?.click()} disabled={loading || streaming}>
            上传图片
          </Button>
          <Button
            size="small"
            icon={<FolderOpenOutlined />}
            onClick={() => void openLibrary()}
            disabled={loading || streaming}
          >
            素材库
          </Button>
          {toolbarExtra}
          {confirmAction}
          {streaming ? (
            <Button onClick={onStop}>停止生成</Button>
          ) : (
            <Button type="primary" loading={loading} onClick={handleSend}>
              发送
            </Button>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className={styles.hiddenInput}
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      <Modal
        title="从素材库选择"
        open={libraryOpen}
        onCancel={() => setLibraryOpen(false)}
        onOk={confirmLibrary}
        okText="添加"
        width={640}
        destroyOnClose
        styles={{ body: { paddingTop: 12 } }}
      >
        <div className={styles.libraryBody}>
          {libraryLoading ? (
            <div className={styles.libraryEmpty}>
              <Spin />
            </div>
          ) : libraryAssets.length === 0 ? (
            <p className={styles.libraryEmpty}>暂无素材</p>
          ) : (
            <div className={styles.libraryGrid}>
              {libraryAssets.map((a) => (
                <label
                  key={a.id}
                  className={[
                    styles.libraryCell,
                    librarySelected.has(a.id) ? styles.libraryCellSelected : '',
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    checked={librarySelected.has(a.id)}
                    onChange={() => {
                      setLibrarySelected((prev) => {
                        const next = new Set(prev)
                        if (next.has(a.id)) next.delete(a.id)
                        else next.add(a.id)
                        return next
                      })
                    }}
                  />
                  <img src={a.url} alt={a.name} className={styles.libraryThumb} />
                </label>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
