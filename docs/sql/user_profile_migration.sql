-- 用户资料：头像字段 + 密码重置 token 表

ALTER TABLE user ADD COLUMN avatar_url VARCHAR(512) NULL AFTER email;

CREATE TABLE IF NOT EXISTS password_reset_token (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    used TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_token_hash (token_hash),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
