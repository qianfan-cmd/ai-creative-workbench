-- Wave D3.5: 点踩补充说明（选「其他」时用户填写）
-- 执行：mysql workbench < ai_feedback_reason_detail.sql

ALTER TABLE ai_feedback
    ADD COLUMN reason_detail VARCHAR(512) NULL COMMENT '点踩补充说明' AFTER reason;
