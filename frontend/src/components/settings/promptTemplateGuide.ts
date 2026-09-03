/** 新建模板时可选类型（value 为 API scene，label 为用户可见中文） */
export const SCENE_TYPE_OPTIONS = [
  { value: 'copy_style_custom', label: '自定义文案风格' },
  { value: 'campaign_visual_custom', label: '自定义视觉风格' },
]

/** Campaign Drawer 仅文案风格 */
export const COPY_STYLE_SCENE_OPTIONS = [
  { value: 'copy_style_custom', label: '自定义文案风格' },
]

/** Campaign Drawer 仅视觉风格 */
export const VISUAL_STYLE_SCENE_OPTIONS = [
  { value: 'campaign_visual_custom', label: '自定义视觉风格' },
]

export const VISUAL_STYLE_CONTENT_EXAMPLE =
  '夏日清新、明亮通透、清爽配色、自然光感'

export type PromptTemplateHelpVariant = 'copyStyle' | 'visualStyle' | 'full'

export interface GuideSection {
  id: string
  title: string
  paragraphs?: string[]
  bullets?: string[]
  example?: string
}

export const COPY_STYLE_EXAMPLE = `将以下活动文案改写为正式、清晰、专业的公告风格，保留事实不变。

原文：
{{copy}}

用户补充：
{{hint}}

要求：输出 JSON，包含 title 和 body 字段。`

export const PLAYFUL_STYLE_EXAMPLE = `在保持事实不变的前提下，将以下活动帖改写得更活泼、更有参与感。

原文：
{{copy}}

用户补充：
{{hint}}

要求：输出 JSON，可适当使用 emoji，但不要过多。`

export const PROMPT_TEMPLATE_GUIDE_SECTIONS: Record<
  PromptTemplateHelpVariant,
  GuideSection[]
> = {
  copyStyle: [
    {
      id: 'what',
      title: '文案风格模板是干什么的？',
      paragraphs: [
        '用于活动帖「文案」Tab 的「AI 优化」：你先写好或生成初稿，再选一个风格模板，AI 会按模板要求改写标题和正文。',
      ],
    },
    {
      id: 'how',
      title: '如何新建自己的模板？',
      bullets: [
        '点击「新建模板」，起一个易懂的名字（如「正式风格优化」）',
        '模板类型选「自定义文案风格」',
        '在模板内容里写你希望 AI 怎么改写的说明，并引用下方变量',
      ],
    },
    {
      id: 'vars',
      title: '可用变量',
      bullets: [
        '{{copy}} — 当前文案的标题 + 正文（AI 优化时的输入）',
        '{{hint}} — 「优化要求」输入框里用户补充的要求（可为空）',
      ],
    },
    {
      id: 'example',
      title: '示例（正式风格）',
      example: COPY_STYLE_EXAMPLE,
    },
  ],
  visualStyle: [
    {
      id: 'what',
      title: '视觉风格是干什么的？',
      paragraphs: [
        '视觉风格是一段「画面描述短句」，用来告诉 AI 配图时想要什么氛围和画风。',
        '你填写的内容会作为 {{visualStyle}} 注入系统生图 Prompt，在「配图」Tab 调用 AI 生图时自动生效。',
      ],
    },
    {
      id: 'where',
      title: '效果体现在哪里？',
      bullets: [
        '在活动帖左栏「活动信息 → 视觉风格」下拉中选择',
        '选中后会写入当前活动草稿，生图时替换进配图 Prompt',
        '最终体现在预览 Tab 的封面/配图整体风格上（如清新、电竞、正式等）',
      ],
    },
    {
      id: 'how',
      title: '如何新建自己的视觉风格？',
      bullets: [
        '点击「新建模板」，起一个易懂的名字（如「赛博朋克」）',
        '模板类型选「自定义视觉风格」',
        '在模板内容里写 1–2 句画面/氛围/配色关键词，不需要 {{变量}}',
        '保存后左栏「视觉风格」下拉会自动出现你的预设',
      ],
    },
    {
      id: 'example',
      title: '示例（夏日清新）',
      example: VISUAL_STYLE_CONTENT_EXAMPLE,
    },
    {
      id: 'manage',
      title: '系统内置 vs 我的模板',
      bullets: [
        '系统内置模板只能查看；可点「复制编辑」基于副本自定义',
        '「我的模板」可自由编辑和删除',
      ],
    },
  ],
  full: [
    {
      id: 'overview',
      title: '模板类型一览',
      bullets: [
        '文案风格 — 用于活动帖「AI 优化」，需使用 {{copy}}、{{hint}}',
        '视觉风格 — 用于活动配图的画面描述，写入左栏「视觉风格」后在配图生成时生效',
        '系统内置模板只能查看，不能修改；「我的模板」可自由编辑和删除',
      ],
    },
    {
      id: 'copy-how',
      title: '新建文案风格模板（3 步）',
      bullets: [
        '起名：如「活泼推送」「正式公告」',
        '模板类型：选「自定义文案风格」',
        '写 Prompt：说明改写目标，并包含 {{copy}} 与 {{hint}}',
      ],
    },
    {
      id: 'copy-vars',
      title: '文案风格可用变量',
      bullets: ['{{copy}} — 待优化的标题 + 正文', '{{hint}} — 用户填写的优化补充'],
    },
    {
      id: 'copy-example',
      title: '示例：正式风格',
      example: COPY_STYLE_EXAMPLE,
    },
    {
      id: 'visual',
      title: '视觉风格说明',
      paragraphs: [
        '视觉风格模板是一段画面描述（如「夏日清新、明亮通透」），不是完整 Prompt。',
      ],
      bullets: [
        '在活动帖左栏选择后，配图 AI 会参考这段描述生成宣传图',
        '新建时选「自定义视觉风格」，内容写 1–2 句风格关键词即可',
      ],
    },
  ],
}
