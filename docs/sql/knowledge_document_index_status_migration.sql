-- Wave E-B3：文档列表展示索引状态（与 async_job 配合）

ALTER TABLE knowledge_document
    ADD COLUMN index_status VARCHAR(32) NOT NULL DEFAULT 'ready'
        COMMENT 'ready | pending_index | indexing | index_failed' AFTER chunk_count,
    ADD COLUMN last_job_id BIGINT NULL COMMENT '最近一次索引任务 async_job.id' AFTER index_status;

-- 已有文档：有 chunk 的视为已索引完成
UPDATE knowledge_document
SET index_status = 'ready'
WHERE (chunk_count IS NOT NULL AND chunk_count > 0)
   OR (char_count IS NOT NULL AND char_count > 0);