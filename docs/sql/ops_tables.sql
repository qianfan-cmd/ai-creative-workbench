-- Week 12 Ops 表结构 + 内置 Prompt seed
-- 执行前请确认 campaign_draft、prompt_template 已存在

CREATE TABLE IF NOT EXISTS generation_job (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    job_type VARCHAR(32) NOT NULL COMMENT 'matting | image_gen',
    ref_task_id BIGINT NULL COMMENT 'ops_matting_task.id',
    ref_draft_id BIGINT NULL COMMENT 'campaign_draft.id',
    status VARCHAR(32) NOT NULL DEFAULT 'pending' COMMENT 'pending|running|done|failed',
    provider_used VARCHAR(64) NULL COMMENT 'seedream | dashscope_wanx',
    input_json TEXT NULL,
    candidates_json TEXT NULL,
    selected_ids TEXT NULL,
    error_message VARCHAR(512) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT NOT NULL DEFAULT 0,
    INDEX idx_gen_job_user (user_id),
    INDEX idx_gen_job_task (ref_task_id),
    INDEX idx_gen_job_draft (ref_draft_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ops_matting_task (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    stage TINYINT NOT NULL DEFAULT 1 COMMENT '1源图 2框选 3元素 4候选 5保存',
    status VARCHAR(32) NOT NULL DEFAULT 'draft' COMMENT 'draft|running|done',
    source_asset_id BIGINT NULL,
    group_id BIGINT NULL,
    pinned TINYINT NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    config_json TEXT NULL,
    selected_candidate TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT NOT NULL DEFAULT 0,
    INDEX idx_matting_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ops_matting_task_group (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    name VARCHAR(64) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT NOT NULL DEFAULT 0,
    INDEX idx_matting_group_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 扩展 ops_matting_task（若列已存在请跳过对应语句）
-- ALTER TABLE ops_matting_task ADD COLUMN group_id BIGINT NULL AFTER source_asset_id;
-- ALTER TABLE ops_matting_task ADD COLUMN pinned TINYINT NOT NULL DEFAULT 0 AFTER group_id;
-- ALTER TABLE ops_matting_task ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER pinned;

CREATE TABLE IF NOT EXISTS ai_call_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NULL,
    scene VARCHAR(64) NOT NULL COMMENT 'copy|image_gen|matting',
    provider VARCHAR(64) NULL,
    model VARCHAR(128) NULL,
    prompt TEXT NULL,
    response_summary VARCHAR(512) NULL,
    status VARCHAR(32) NOT NULL COMMENT 'success|failed',
    cost_ms INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ai_log_user (user_id),
    INDEX idx_ai_log_scene (scene)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 内置 Prompt：仅当 scene 不存在时插入
INSERT INTO prompt_template (user_id, name, scene, content, created_at, updated_at, deleted)
SELECT NULL, '活动配图生成', 'image_gen',
'为以下运营活动生成一张高质量宣传配图。活动主题：{{theme}}；时间：{{timeRange}}；受众：{{audience}}；福利：{{benefits}}；视觉风格：{{visualStyle}}；画幅：{{aspectRatio}}。禁用词：{{forbiddenWords}}。要求画面清晰、无文字水印、适合作为活动帖封面。',
NOW(), NOW(), 0
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM prompt_template WHERE scene = 'image_gen' AND user_id IS NULL AND deleted = 0);

INSERT INTO prompt_template (user_id, name, scene, content, created_at, updated_at, deleted)
SELECT NULL, '通用抠图', 'matting',
'提取画面中的主体对象，背景干净（透明或纯白），边缘清晰自然，适合作为运营素材使用。{{hint}}',
NOW(), NOW(), 0
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM prompt_template WHERE scene = 'matting' AND user_id IS NULL AND deleted = 0);

INSERT INTO prompt_template (user_id, name, scene, content, created_at, updated_at, deleted)
SELECT NULL, '元素名称提取', 'matting_region',
'将整张图片中所有主体、物体、物品全部列成一个完整的清单，不要遗漏任何重要元素。

规则：
1. 完全相同的元素仅保留一个；同一元素有不同状态时增加形容词区分
2. 每个元素命名不超过 10 个字，不使用括号补充说明
3. 一堆小元素不拆分，统一命名为一个主体
4. 若元素为主体手持物品，命名格式为"xx 左手拿的包包"
5. 整张图的背景及背景内容不列举
6. 输出两层 JSON 结构，同一元素不同状态进行分组
7. 仅输出 JSON 对象，每个分组的值为字符串数组；元素项只能是名称字符串，禁止输出 {名称, 描述} 等对象结构
8. 分组名使用语义类别（如神兽类、财富类、装饰构件类、文字标识类），禁止使用「主体」「物体」等泛称

输出示例：
{
    "神兽类": ["蓝色神鸟", "金色神鸟", "红色神鸟"],
    "聚宝盆类": ["蓝色聚宝盆", "金色聚宝盆", "红色聚宝盆"],
    "财富类": ["金币", "金元宝"],
    "文字标识类": ["EXTRA 标识", "DOUBLE 标识", "MULTIPLE 标识", "底部提示文字"],
    "装饰构件类": ["金色凤形装饰", "金色圆形装饰"]
}',
NOW(), NOW(), 0
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM prompt_template WHERE scene = 'matting_region' AND user_id IS NULL AND deleted = 0);

INSERT INTO prompt_template (user_id, name, scene, content, created_at, updated_at, deleted)
SELECT NULL, '分组元素提取', 'matting_extract',
'去掉图片中的 {{nonTargetNames}} 等所有主体元素，仅保留 {{targetNames}}，背景改为纯色',
NOW(), NOW(), 0
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM prompt_template WHERE scene = 'matting_extract' AND user_id IS NULL AND deleted = 0);

INSERT INTO prompt_template (user_id, name, scene, content, created_at, updated_at, deleted)
SELECT NULL, '单体元素提取', 'matting_single',
'仅将 {{targetElementName}} 从图片中提取出来，不要有其他任何内容，所有特征和姿势朝向绝不允许变动',
NOW(), NOW(), 0
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM prompt_template WHERE scene = 'matting_single' AND user_id IS NULL AND deleted = 0);
