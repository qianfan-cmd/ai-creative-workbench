-- 知识库文档元数据表（向量仍在 Chroma，原文件在 uploads/knowledge/）
CREATE TABLE IF NOT EXISTS knowledge_document (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    filename VARCHAR(512) NOT NULL,
    file_type VARCHAR(128) NULL,
    file_size BIGINT NULL DEFAULT 0,
    char_count INT NULL DEFAULT 0,
    chunk_count INT NULL DEFAULT 0,
    stored_path VARCHAR(1024) NULL COMMENT '相对 uploads/ 的路径，如 knowledge/1/5/notes.md',
    chroma_source VARCHAR(512) NOT NULL COMMENT 'Chroma metadata source 键，重命名时更新',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT NOT NULL DEFAULT 0,
    INDEX idx_knowledge_document_user (user_id),
    INDEX idx_knowledge_document_chroma_source (chroma_source),
    INDEX idx_knowledge_document_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
