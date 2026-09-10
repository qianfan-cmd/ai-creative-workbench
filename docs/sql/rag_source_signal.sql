-- Wave D3.6: RAG 文档级反馈信号（整文档降权/升权，跨会话生效）
-- 执行：mysql workbench < rag_source_signal.sql

CREATE TABLE IF NOT EXISTS rag_source_signal (
    source VARCHAR(512) PRIMARY KEY COMMENT '文档 filename，与 Chroma metadata.source 一致',
    penalty INT NOT NULL DEFAULT 0 COMMENT '降权累计次数，上限 5',
    boost INT NOT NULL DEFAULT 0 COMMENT '升权累计次数，上限 5',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
