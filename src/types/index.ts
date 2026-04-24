export interface Config {
  id: string
  user_id: string
  name: string
  is_default: boolean
  target_audience: string | null
  tone_presets: string[]
  tone_custom: string | null
  reference_samples: string[]
  image_style_note: string | null
  forbidden_words: string[]
  created_at: string
  updated_at: string
}

export interface ImageBrief {
  description: string
  scene: string
  composition: string
  lighting: string
  color_tone: string
  props: string
  avoid: string
}

export interface ContentVersion {
  label: string
  title: string
  body: string
  tags: string[]
  image_brief: ImageBrief
}

export interface GenerationOutput {
  version_a: ContentVersion
  version_b: ContentVersion
  version_c: ContentVersion
}

export interface History {
  id: string
  user_id: string
  input_text: string
  input_images: { path: string; name: string }[]
  config_snapshot: Omit<Config, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  output: GenerationOutput
  title_preview: string | null
  created_at: string
}

export const TONE_PRESETS = ['活泼', '专业', '治愈', '种草', '干货'] as const
export type TonePreset = typeof TONE_PRESETS[number]
