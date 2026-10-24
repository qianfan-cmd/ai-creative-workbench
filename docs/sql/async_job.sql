-- Wave E-B3：异步任务表（知识库索引、后续 reindex / 抠图 MQ 共用）

CREATE TABLE IF NOT EXISTS async_job (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL COMMENT '任务所属用户，查询时校验',
    type VARCHAR(64) NOT NULL COMMENT 'document_index | reindex | reindex_all',
    status VARCHAR(32) NOT NULL COMMENT 'pending | running | succeeded | failed',
    payload_json TEXT NULL COMMENT '业务参数 JSON，如 {"documentId":1,"filename":"a.pdf"}',
    error_message VARCHAR(512) NULL COMMENT '失败原因摘要',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_async_job_user (user_id),
    INDEX idx_async_job_status (status),
    INDEX idx_async_job_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;