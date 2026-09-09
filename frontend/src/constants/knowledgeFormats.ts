/** 知识库上传允许的扩展名（与 Python document_parser、Java ALLOWED_EXT 保持一致） */

export const KNOWLEDGE_ALLOWED_EXTENSIONS = [
  '.txt',
  '.md',
  '.markdown',
  '.pdf',
  '.docx',
] as const

export const KNOWLEDGE_ACCEPT_ATTR = KNOWLEDGE_ALLOWED_EXTENSIONS.join(',')

export const KNOWLEDGE_UPLOAD_HINT =
  '支持 .txt / .md / .pdf / .docx（PDF/DOCX 仅索引，不可在线编辑）'

export function validateKnowledgeFile(file: File): string | null {
  const name = file.name.trim().toLowerCase()
  if (!KNOWLEDGE_ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return `仅支持 ${KNOWLEDGE_ALLOWED_EXTENSIONS.join(' / ')} 文件`
  }
  return null
}

export function isBinaryKnowledgeFile(filename?: string, fileType?: string): boolean {
  const lower = filename?.toLowerCase() ?? ''
  if (lower.endsWith('.pdf') || lower.endsWith('.docx')) return true
  if (fileType === 'application/pdf') return true
  return fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}
