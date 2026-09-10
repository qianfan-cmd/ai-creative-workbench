-- Wave D1.6b: 知识库文档标签（复用 tag 表）
CREATE TABLE IF NOT EXISTS knowledge_document_tag (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    document_id BIGINT NOT NULL,
    tag_id BIGINT NOT NULL,
    source VARCHAR(16) NOT NULL DEFAULT 'user' COMMENT 'ai|user',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_kdoc_tag (document_id, tag_id),
    INDEX idx_kdoc_tag_document (document_id),
    INDEX idx_kdoc_tag_tag (tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
