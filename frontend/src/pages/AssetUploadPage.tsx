import { useState, useEffect } from 'react'
import { Button, Upload, Progress, message, Input, Select } from 'antd'
import { InboxOutlined, PlusOutlined } from '@ant-design/icons'
import { uploadAssetApi, updateAssetNameApi, replaceAssetTagsApi } from '@/api/assets'
import styles from './AssetUploadPage.module.css'
import validateFile from '@/utils/validateFile'
import { ALLOWED_EXT } from '@/utils/validateFile'
import { splitFileName, joinFileName } from '@/utils/assetName'
import { formatFileSize } from '@/utils/format'
import { listTagsApi } from '@/api/tags'
import type { TagVO } from '@/api/tags'
import TagOptionLabel from '@/components/assets/TagOptionLabel'
import CreateTagModal from '@/components/assets/CreateTagModal'

export default function AssetUploadPage() {
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [nameBase, setNameBase] = useState('')
  const [fileExt, setFileExt] = useState('')
  const [uploading, setUploading] = useState(false)
  const [percent, setPercent] = useState(0)

  const [tags, setTags] = useState<TagVO[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [createTagOpen, setCreateTagOpen] = useState(false)

  /**进入上传页就拉标签 */
  useEffect(() => {
    listTagsApi().then(setTags)
  }, [])

  /**新建标签成功后回调，更新列表 */
  const handleTagCreated = (created: TagVO) => {
    setCreateTagOpen(false)
    setTags((prev) => {
      if (prev.some((t) => t.id === created.id)) return prev
      return [created, ...prev]
    })
    setSelectedTagIds((prev) => (prev.includes(created.id) ? prev : [...prev, created.id]))
  }

  // 拦截上传文件
  const handleBeforeUpload = (file: File) => {
    const error = validateFile(file);
    if (error) {
      message.error(error);
      return Upload.LIST_IGNORE;// 非法文件：不加入，不显示
    }

    const { base, ext } = splitFileName(file.name);
    setPendingFile(file); // 暂存原始文件
    setNameBase(base);
    setFileExt(ext);
    setSelectedTagIds([])

    return false;// 阻止 Upload 默认 POST
  }

  /**重新选择 */
  const handleResetFile = () => {
    setPendingFile(null)
    setNameBase('')
    setFileExt('')
    setSelectedTagIds([])
    setPercent(0)
  }

  /**确认上传 */
  const handleConfirmUpload = async () => {
    if (!pendingFile) return;

    if (!nameBase.trim()) {
      message.error("文件名不能为空")
      return;
    }

    const finalName = joinFileName(nameBase, fileExt);

    setUploading(true)
    setPercent(0)

    try {
      const uploaded = await uploadAssetApi(pendingFile, {
        onProgress: setPercent,
      })


        // ② 用户改过显示名才 PATCH（后端 upload 用的是原始文件名）
      if (finalName !== uploaded.name) {
          await updateAssetNameApi(uploaded.id, finalName)
      }
        
    // ③ 选了标签才 PUT（空数组也可调，表示清空；这里仅在有选择时调）
    if (selectedTagIds.length > 0) {
      await replaceAssetTagsApi(uploaded.id, selectedTagIds)
    }

    message.success('上传成功')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>上传 Upload</h1>
          <p className={styles.pageDesc}>拖拽或选择文件上传到素材库</p>
        </div>
      </header>

      <div className={styles.uploadPanel}>
        <Upload.Dragger
          name="file"
          multiple={false}
          showUploadList={false}
          disabled={uploading}
          beforeUpload={handleBeforeUpload}
          accept={ALLOWED_EXT.map((e) => `.${e}`).join(',')}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持 PNG / JPG / GIF / WebP / PDF / MD，单文件最大 50MB
          </p>
        </Upload.Dragger>

        {/* 两阶段上传：选文件后才显示配置区 */}
        {pendingFile && (
          <div className={styles.configPanel}>
            <p className={styles.fileMeta}>
              已选择：{pendingFile.name}（{formatFileSize(pendingFile.size)}）
            </p>

            {/* addonAfter 展示只读扩展名，避免用户改成无后缀文件 */}
            <Input
              value={nameBase}
              onChange={(e) => setNameBase(e.target.value)}
              addonAfter={fileExt || undefined}
              placeholder="显示名称"
              disabled={uploading} // 上传途中禁止输入
              maxLength={200}
            />
            <div className={styles.tagRow} style={{ marginTop: 'var(--space-4)' }}>
              <Select
                mode="multiple"
                allowClear
                placeholder="选择标签（可选）"
                className={styles.tagSelect}
                value={selectedTagIds}
                onChange={setSelectedTagIds}
                disabled={uploading}
                options={tags.map((tag) => ({
                  value: tag.id,
                  label: tag.name,
                  tag,
                }))}
                optionRender={(option) => {
                  const tag = (option.data as { tag?: TagVO }).tag
                  if (!tag) return option.label
                  return <TagOptionLabel tag={tag} />
                }}
              />

              <Button
                icon={<PlusOutlined />}
                onClick={() => setCreateTagOpen(true)}
                disabled={uploading}
              >
                新建标签
              </Button>
            </div>
            <div className={styles.configActions}>
              <Button onClick={handleResetFile} disabled={uploading}>
                重新选择
              </Button>
              <Button type="primary" loading={uploading} onClick={handleConfirmUpload}>
                确认上传
              </Button>
            </div>
          </div>
        )}

        {uploading && (
          <Progress percent={percent} status="active" className={styles.progress} />
        )}

        <CreateTagModal
          open={createTagOpen}
          onCancel={() => setCreateTagOpen(false)}
          onSuccess={handleTagCreated}
        />
      </div>
    </div>
  )
}