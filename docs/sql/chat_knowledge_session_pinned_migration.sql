-- Chat / 知识库会话侧栏：置顶
-- 若列已存在请跳过对应语句

ALTER TABLE conversation ADD COLUMN pinned TINYINT NOT NULL DEFAULT 0 AFTER title;
ALTER TABLE knowledge_session ADD COLUMN pinned TINYINT NOT NULL DEFAULT 0 AFTER title;
