-- AI 调用日志：补 token 用量字段

ALTER TABLE ai_call_log
    ADD COLUMN prompt_tokens INT NULL AFTER cost_ms,
    ADD COLUMN completion_tokens INT NULL AFTER prompt_tokens,
    ADD COLUMN total_tokens INT NULL AFTER completion_tokens;

-- AI 调用日志：生图按张计费

ALTER TABLE ai_call_log
    ADD COLUMN image_count INT NULL AFTER total_tokens;
