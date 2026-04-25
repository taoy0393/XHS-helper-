import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/anthropic'
import { buildSystemPrompt, buildUserPrompt, extractJson } from '@/lib/prompt-builder'
import { NextResponse } from 'next/server'
import type { GenerationOutput } from '@/types'
import type { ImageBlockParam } from '@anthropic-ai/sdk/resources/messages'

export const maxDuration = 60

function log(step: string, detail?: unknown) {
  const ts = new Date().toISOString().slice(11, 23)
  if (detail !== undefined) {
    console.log(`[generate ${ts}] ${step}`, detail)
  } else {
    console.log(`[generate ${ts}] ${step}`)
  }
}

export async function POST(req: Request) {
  log('request received')

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      log('auth error', authError.message)
      return NextResponse.json({ error: 'auth error', detail: authError.message }, { status: 401 })
    }
    if (!user) {
      log('unauthorized — no user in session')
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    log('auth ok', user.email)

    let formData: FormData
    try {
      formData = await req.formData()
    } catch (e) {
      log('formData parse error', e instanceof Error ? e.message : e)
      return NextResponse.json({ error: 'invalid form data', detail: String(e) }, { status: 400 })
    }

    const articleText = formData.get('text') as string
    const configId = formData.get('config_id') as string | null
    const imageFiles = formData.getAll('images') as File[]

    log('input', {
      textLength: articleText?.length ?? 0,
      configId,
      imageCount: imageFiles.length,
    })

    if (!articleText?.trim()) {
      return NextResponse.json({ error: '请输入文章内容' }, { status: 400 })
    }

    // Fetch config
    let config = null
    if (configId) {
      const { data, error } = await supabase
        .from('configs')
        .select('*')
        .eq('id', configId)
        .eq('user_id', user.id)
        .single()
      if (error) log('config fetch error', error.message)
      config = data
    }
    if (!config) {
      const { data, error } = await supabase
        .from('configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .single()
      if (error) log('default config fetch error', error.message)
      config = data
    }

    const blankConfig = {
      id: '', user_id: user.id, name: '默认', is_default: true,
      target_audience: null, tone_presets: [], tone_custom: null,
      reference_samples: [], image_style_note: null, forbidden_words: [],
      created_at: '', updated_at: '',
    }
    const activeConfig = config ?? blankConfig
    log('config resolved', activeConfig.name)

    // Build message content
    const userContent: Array<ImageBlockParam | { type: 'text'; text: string }> = []

    for (const file of imageFiles.slice(0, 4)) {
      const buffer = await file.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
      userContent.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } })
      log('image attached', `${file.name} (${file.size} bytes, ${mediaType})`)
    }

    userContent.push({ type: 'text', text: buildUserPrompt(articleText) })

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: object) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

        try {
          log('calling claude', { model: 'claude-sonnet-4-6', inputBlocks: userContent.length })

          let fullText = ''
          let chunkCount = 0

          const anthropicStream = anthropic.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 4096,
            system: buildSystemPrompt(activeConfig),
            messages: [{ role: 'user', content: userContent }],
          })

          for await (const event of anthropicStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              fullText += event.delta.text
              chunkCount++
              send({ type: 'chunk', text: event.delta.text })
            }
          }

          log('claude stream done', { chunks: chunkCount, totalLength: fullText.length })

          if (!fullText.trim()) {
            log('empty response from claude')
            send({ type: 'error', message: 'Claude 返回了空响应，请重试' })
            controller.close()
            return
          }

          let output: GenerationOutput
          try {
            const jsonStr = extractJson(fullText)
            log('parsing json', `first 120 chars: ${jsonStr.slice(0, 120)}`)
            output = JSON.parse(jsonStr)
          } catch (e) {
            log('json parse failed', { error: e instanceof Error ? e.message : e, rawLength: fullText.length, rawPreview: fullText.slice(0, 200) })
            send({ type: 'error', message: '生成结果解析失败，请重试' })
            controller.close()
            return
          }

          log('json parse ok')

          const { error: insertError } = await supabase.from('histories').insert({
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

          if (insertError) {
            log('history insert error (non-fatal)', insertError.message)
          } else {
            log('history saved')
          }

          send({ type: 'done', result: output })
          controller.close()
          log('done')
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          const stack = err instanceof Error ? err.stack : undefined
          log('stream error', { message, stack })
          send({ type: 'error', message })
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    log('unhandled route error', { message, stack })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
