-- Wave D3.5: RAG chunk 反馈信号（降权/升权）
CREATE TABLE IF NOT EXISTS rag_chunk_signal (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    chunk_id VARCHAR(255) NOT NULL,
    source VARCHAR(512) NULL,
    penalty INT NOT NULL DEFAULT 0,
    boost INT NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_rag_chunk_signal (chunk_id),
    INDEX idx_rag_chunk_source (source(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
