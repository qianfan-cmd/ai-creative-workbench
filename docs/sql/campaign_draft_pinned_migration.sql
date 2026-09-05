-- 活动帖草稿侧栏：置顶
-- 若列已存在请跳过

ALTER TABLE campaign_draft ADD COLUMN pinned TINYINT NOT NULL DEFAULT 0 AFTER title;
