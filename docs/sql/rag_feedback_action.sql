-- Wave D3.5: RAG 点踩自愈动作审计
CREATE TABLE IF NOT EXISTS rag_feedback_action (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    feedback_id BIGINT NULL,
    turn_id BIGINT NULL,
    triage_step INT NULL COMMENT '9步方法论中的根因阶段',
    action_type VARCHAR(64) NOT NULL COMMENT 'penalize|boost|add_tag|reindex|golden_draft|triage',
    detail_json TEXT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending' COMMENT 'pending|success|failed|skipped',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_rag_action_feedback (feedback_id),
    INDEX idx_rag_action_turn (turn_id),
    INDEX idx_rag_action_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
