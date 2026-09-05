-- 工作流配图暂存表：upload / library / ai_gen × matting / campaign
-- 直接上传不入 asset 表；保存活动帖 / 抠图最终保存时才 import

CREATE TABLE IF NOT EXISTS ops_workflow_source (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    context VARCHAR(16) NOT NULL COMMENT 'matting|campaign',
    ref_task_id BIGINT NULL COMMENT 'ops_matting_task.id',
    ref_draft_id BIGINT NULL COMMENT 'campaign_draft.id',
    source_type VARCHAR(16) NOT NULL COMMENT 'upload|library|ai_gen',
    image_url VARCHAR(512) NOT NULL,
    storage_path VARCHAR(512) NULL,
    asset_id BIGINT NULL COMMENT 'library 引用已有素材',
    original_name VARCHAR(255) NULL,
    size BIGINT NULL,
    content_type VARCHAR(64) NULL,
    selected TINYINT NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    meta_json TEXT NULL COMMENT 'prompt, generationJobId, referenceUrls 等',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT NOT NULL DEFAULT 0,
    INDEX idx_wf_source_user (user_id),
    INDEX idx_wf_source_matting (context, ref_task_id),
    INDEX idx_wf_source_campaign (context, ref_draft_id),
    INDEX idx_wf_source_asset (asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
