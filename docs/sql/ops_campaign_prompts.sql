-- Campaign 文案与视觉风格 Prompt 种子
-- 执行前请确认 prompt_template 表已存在（见 ops_tables.sql）
-- 幂等：仅当 scene + user_id IS NULL 不存在时插入

INSERT INTO prompt_template (user_id, name, scene, content, created_at, updated_at, deleted)
SELECT NULL, '活动文案初稿', 'copy_draft',
'你是一名游戏/互联网运营文案。根据以下活动信息撰写一篇适合在牛客等社区发布的活动帖文案。

活动主题：{{theme}}
活动时间：{{timeRange}}
目标受众：{{audience}}
福利亮点：{{benefits}}

要求：
1. 输出严格 JSON，格式：{"title":"标题","body":"正文"}
2. 标题简洁有吸引力，不超过 30 字
3. 正文分段清晰，语气友好，适合社区传播
4. 不要夸大承诺，不要使用绝对化用语
5. 仅输出 JSON，不要 markdown 代码块或其它说明',
NOW(), NOW(), 0
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM prompt_template WHERE scene = 'copy_draft' AND user_id IS NULL AND deleted = 0);

INSERT INTO prompt_template (user_id, name, scene, content, created_at, updated_at, deleted)
SELECT NULL, '活泼推送', 'copy_style_playful',
'你是一名擅长社区运营的文案编辑。请在保持事实不变的前提下，将以下活动帖改写得更活泼、更有参与感。

原文：
{{copy}}

补充要求：{{hint}}

要求：
1. 输出严格 JSON：{"title":"标题","body":"正文"}
2. 可适当使用 emoji，但不要过多
3. 仅输出 JSON',
NOW(), NOW(), 0
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM prompt_template WHERE scene = 'copy_style_playful' AND user_id IS NULL AND deleted = 0);

INSERT INTO prompt_template (user_id, name, scene, content, created_at, updated_at, deleted)
SELECT NULL, '正式公告', 'copy_style_formal',
'你是一名企业公告文案编辑。请将以下活动帖改写为正式、克制、专业的公告风格。

原文：
{{copy}}

补充要求：{{hint}}

要求：
1. 输出严格 JSON：{"title":"标题","body":"正文"}
2. 语气正式，避免口语和网络梗
3. 仅输出 JSON',
NOW(), NOW(), 0
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM prompt_template WHERE scene = 'copy_style_formal' AND user_id IS NULL AND deleted = 0);

INSERT INTO prompt_template (user_id, name, scene, content, created_at, updated_at, deleted)
SELECT NULL, '强转化推送', 'copy_style_push',
'你是一名转化导向的运营文案。请在保持合规的前提下，强化以下活动帖的行动号召（CTA）。

原文：
{{copy}}

补充要求：{{hint}}

要求：
1. 输出严格 JSON：{"title":"标题","body":"正文"}
2. 突出福利与时间限制，引导用户参与
3. 禁止绝对化、虚假宣传
4. 仅输出 JSON',
NOW(), NOW(), 0
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM prompt_template WHERE scene = 'copy_style_push' AND user_id IS NULL AND deleted = 0);

INSERT INTO prompt_template (user_id, name, scene, content, created_at, updated_at, deleted)
SELECT NULL, '夏日清新', 'campaign_visual_summer',
'夏日清新、明亮通透、清爽配色、自然光感',
NOW(), NOW(), 0
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM prompt_template WHERE scene = 'campaign_visual_summer' AND user_id IS NULL AND deleted = 0);

INSERT INTO prompt_template (user_id, name, scene, content, created_at, updated_at, deleted)
SELECT NULL, '电竞热血', 'campaign_visual_esports',
'电竞热血、高对比、霓虹光效、动感构图、年轻潮流',
NOW(), NOW(), 0
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM prompt_template WHERE scene = 'campaign_visual_esports' AND user_id IS NULL AND deleted = 0);

INSERT INTO prompt_template (user_id, name, scene, content, created_at, updated_at, deleted)
SELECT NULL, '简约正式', 'campaign_visual_minimal',
'简约正式、商务感、留白充足、低饱和配色、专业可信',
NOW(), NOW(), 0
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM prompt_template WHERE scene = 'campaign_visual_minimal' AND user_id IS NULL AND deleted = 0);
