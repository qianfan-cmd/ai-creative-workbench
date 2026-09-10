-- Wave D3: AI 用户反馈（RAG / Chat / 生图）
-- 执行：mysql workbench < ai_feedback.sql 或在客户端运行

CREATE TABLE IF NOT EXISTS ai_feedback (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    scene VARCHAR(32) NOT NULL COMMENT 'rag|chat|image_gen',
    ref_type VARCHAR(32) NOT NULL COMMENT 'knowledge_turn|message|generation_job',
    ref_id BIGINT NOT NULL,
    rating VARCHAR(8) NOT NULL COMMENT 'up|down',
    reason VARCHAR(64) NULL COMMENT 'incomplete_list|wrong_fact|irrelevant|other',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_feedback_user_ref (user_id, ref_type, ref_id),
    INDEX idx_feedback_scene_rating (scene, rating),
    INDEX idx_feedback_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
