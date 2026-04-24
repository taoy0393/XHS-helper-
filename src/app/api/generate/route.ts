import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/anthropic'
import { buildSystemPrompt, buildUserPrompt, extractJson } from '@/lib/prompt-builder'
import { NextResponse } from 'next/server'
import type { GenerationOutput } from '@/types'
import type { ImageBlockParam } from '@anthropic-ai/sdk/resources/messages'

export const maxDuration = 60

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const articleText = formData.get('text') as string
  const configId = formData.get('config_id') as string | null
  const imageFiles = formData.getAll('images') as File[]

  if (!articleText?.trim()) {
    return NextResponse.json({ error: '请输入文章内容' }, { status: 400 })
  }

  // Fetch config (fall back to a blank default if none selected)
  let config = null
  if (configId) {
    const { data } = await supabase
      .from('configs')
      .select('*')
      .eq('id', configId)
      .eq('user_id', user.id)
      .single()
    config = data
  }
  if (!config) {
    const { data } = await supabase
      .from('configs')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_default', true)
      .single()
    config = data
  }

  const blankConfig = {
    id: '', user_id: user.id, name: '默认', is_default: true,
    target_audience: null, tone_presets: [], tone_custom: null,
    reference_samples: [], image_style_note: null, forbidden_words: [],
    created_at: '', updated_at: '',
  }
  const activeConfig = config ?? blankConfig

  // Build message content
  const userContent: Array<ImageBlockParam | { type: 'text'; text: string }> = []

  // Attach images if provided (as base64)
  for (const file of imageFiles.slice(0, 4)) {
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: base64 },
    })
  }

  userContent.push({ type: 'text', text: buildUserPrompt(articleText) })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

      try {
        let fullText = ''

        const anthropicStream = anthropic.messages.stream({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          system: buildSystemPrompt(activeConfig),
          messages: [{ role: 'user', content: userContent }],
        })

        for await (const event of anthropicStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            fullText += event.delta.text
            send({ type: 'chunk', text: event.delta.text })
          }
        }

        // Parse structured output
        let output: GenerationOutput
        try {
          output = JSON.parse(extractJson(fullText))
        } catch {
          send({ type: 'error', message: '生成结果解析失败，请重试' })
          controller.close()
          return
        }

        // Save to history
        await supabase.from('histories').insert({
          user_id: user.id,
          input_text: articleText,
          input_images: [],
          config_snapshot: {
            name: activeConfig.name,
            target_audience: activeConfig.target_audience,
            tone_presets: activeConfig.tone_presets,
            tone_custom: activeConfig.tone_custom,
            reference_samples: activeConfig.reference_samples,
            image_style_note: activeConfig.image_style_note,
            forbidden_words: activeConfig.forbidden_words,
            is_default: activeConfig.is_default,
          },
          output,
          title_preview: output.version_a?.title ?? null,
        })

        send({ type: 'done', result: output })
        controller.close()
      } catch (err: unknown) {
        send({ type: 'error', message: err instanceof Error ? err.message : '生成失败，请重试' })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
