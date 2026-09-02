import { CloseOutlined } from '@ant-design/icons'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import styles from '@/components/common/ImageLightbox.module.css'

export interface ImageLightboxProps {
  url: string | null
  alt?: string
  onClose: () => void
}

/** 当前页居中查看图片，不跳转、不触发下载 */
export default function ImageLightbox({ url, alt = '', onClose }: ImageLightboxProps) {
  useEffect(() => {
    if (!url) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [url, onClose])

  if (!url) return null

  return createPortal(
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="图片预览" onClick={onClose}>
      <button
        type="button"
        className={styles.closeBtn}
        aria-label="关闭预览"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      >
        <CloseOutlined />
      </button>
      <div className={styles.frame} onClick={(e) => e.stopPropagation()}>
        <img src={url} alt={alt} className={styles.image} />
      </div>
    </div>,
    document.body,
  )
}
