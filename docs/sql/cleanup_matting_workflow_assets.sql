-- 清理误入素材库的抠图工作流中间文件（框选裁切 / AI 源图方案预览）
-- 执行前请备份；deleted=1 为逻辑删除（与 @TableLogic 一致）

UPDATE asset
SET deleted = 1, updated_at = NOW()
WHERE deleted = 0
  AND (name LIKE 'matting-crop-%' OR name LIKE 'matting-scheme-%');
