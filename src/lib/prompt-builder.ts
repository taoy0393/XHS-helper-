import type { Config } from '@/types'

export function buildSystemPrompt(config: Config): string {
  const lines = [
    '你是一位专业的小红书文案创作者，擅长将微信公众号文章改编为小红书爆款内容。',
    '',
    '输出要求：',
    '- 只输出纯 JSON，不要有任何 markdown 标记或解释文字',
    '- 标题不超过 20 字，有吸引力',
    '- 正文 500–800 字，多用换行和 emoji，符合小红书阅读习惯',
    '- 标签 5–8 个，用 # 开头',
  ]

  if (config.target_audience) {
    lines.push('', `目标受众：${config.target_audience}`)
  }

  const tones = [...config.tone_presets]
  if (config.tone_custom) tones.push(config.tone_custom)
  if (tones.length > 0) {
    lines.push(`语气风格：${tones.join('、')}`)
  }

  if (config.reference_samples?.filter(Boolean).length > 0) {
    lines.push('', '参考文案风格（仅参考风格，不要复制内容）：')
    config.reference_samples.filter(Boolean).forEach((s, i) => {
      lines.push(`样本${i + 1}：${s}`)
    })
  }

  if (config.forbidden_words?.length > 0) {
    lines.push('', `禁止使用以下词汇：${config.forbidden_words.join('、')}`)
  }

  if (config.image_style_note) {
    lines.push('', `配图风格偏好：${config.image_style_note}`)
  }

  return lines.join('\n')
}

const VERSION_STYLES: Record<'a' | 'b' | 'c', { label: string; style: string }> = {
  a: { label: '草种型', style: '以真实体验和产品价值为核心，激发读者种草欲望' },
  b: { label: '共鸣型', style: '以情感故事和生活共鸣为核心，引发读者情感认同' },
  c: { label: '干货型', style: '以实用建议和干货知识为核心，提供清晰可操作的信息' },
}

export function buildSingleVersionPrompt(articleText: string, version: 'a' | 'b' | 'c'): string {
  const { label, style } = VERSION_STYLES[version]
  return `请将以下公众号文章改编为一个小红书帖子。

版本类型：${label}（${style}）

文章内容：
${articleText}

只输出以下 JSON，不要其他文字：
{
  "label": "${label}",
  "title": "标题（不超过20字）",
  "body": "正文（500-800字，多用换行和emoji）",
  "tags": ["#标签1", "#标签2", "#标签3", "#标签4", "#标签5"],
  "image_brief": {
    "description": "整体配图方向",
    "scene": "场景",
    "composition": "构图建议",
    "lighting": "光线要求",
    "color_tone": "色调",
    "props": "道具或元素",
    "avoid": "避免出现的内容"
  }
}`
}

export function buildUserPrompt(articleText: string): string {
  return `请将以下公众号文章改编为 3 个小红书帖子版本。

文章内容：
${articleText}

请严格输出以下 JSON 格式（只输出 JSON，不要其他文字）：
{
  "version_a": {
    "label": "草种型",
    "title": "标题",
    "body": "正文",
    "tags": ["#标签1", "#标签2", "#标签3", "#标签4", "#标签5"],
    "image_brief": {
      "description": "整体配图方向",
      "scene": "场景",
      "composition": "构图建议",
      "lighting": "光线要求",
      "color_tone": "色调",
      "props": "道具或元素",
      "avoid": "避免出现的内容"
    }
  },
  "version_b": {
    "label": "共鸣型",
    "title": "标题",
    "body": "正文",
    "tags": ["#标签1", "#标签2", "#标签3", "#标签4", "#标签5"],
    "image_brief": {
      "description": "整体配图方向",
      "scene": "场景",
      "composition": "构图建议",
      "lighting": "光线要求",
      "color_tone": "色调",
      "props": "道具或元素",
      "avoid": "避免出现的内容"
    }
  },
  "version_c": {
    "label": "干货型",
    "title": "标题",
    "body": "正文",
    "tags": ["#标签1", "#标签2", "#标签3", "#标签4", "#标签5"],
    "image_brief": {
      "description": "整体配图方向",
      "scene": "场景",
      "composition": "构图建议",
      "lighting": "光线要求",
      "color_tone": "色调",
      "props": "道具或元素",
      "avoid": "避免出现的内容"
    }
  }
}`
}

export function extractJson(raw: string): string {
  // strip markdown code fences if Claude wraps in ```json ... ```
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  return match ? match[1].trim() : raw.trim()
}
