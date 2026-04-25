import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/anthropic'
import { buildSystemPrompt, buildSingleVersionPrompt, extractJson } from '@/lib/prompt-builder'
import { NextResponse } from 'next/server'
import type { ContentVersion } from '@/types'
import type { ImageBlockParam } from '@anthropic-ai/sdk/resources/messages'

// Each call generates one version — target <8s on Hobby plan (10s cap)
export const maxDuration = 60

function log(step: string, detail?: unknown) {
  const ts = new Date().toISOString().slice(11, 23)
  if (detail !== undefined) console.log(`[generate ${ts}] ${step}`, detail)
  else console.log(`[generate ${ts}] ${step}`)
}

export async function POST(req: Request) {
  log('request received')

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      log('auth error', authError.message)
      return NextResponse.json({ error: `[E-AUTH] ${authError.message}` }, { status: 401 })
    }
    if (!user) {
      log('unauthorized — no session')
      return NextResponse.json({ error: '[E-AUTH] unauthorized' }, { status: 401 })
    }
    log('auth ok', user.email)

    let formData: FormData
    try {
      formData = await req.formData()
    } catch (e) {
      log('formData parse error', e)
      return NextResponse.json({ error: `[E-FORM] ${String(e)}` }, { status: 400 })
    }

    const articleText = formData.get('text') as string
    const version = (formData.get('version') as 'a' | 'b' | 'c') ?? 'a'
    const configId = formData.get('config_id') as string | null
    const imageFiles = formData.getAll('images') as File[]

    log('input', { version, textLength: articleText?.length ?? 0, images: imageFiles.length })

    if (!articleText?.trim()) {
      return NextResponse.json({ error: '[E-INPUT] 请输入文章内容' }, { status: 400 })
    }
    if (!['a', 'b', 'c'].includes(version)) {
      return NextResponse.json({ error: '[E-INPUT] invalid version' }, { status: 400 })
    }

    // Fetch config
    let config = null
    if (configId) {
      const { data } = await supabase.from('configs').select('*').eq('id', configId).eq('user_id', user.id).single()
      config = data
    }
    if (!config) {
      const { data } = await supabase.from('configs').select('*').eq('user_id', user.id).eq('is_default', true).single()
      config = data
    }
    const activeConfig = config ?? {
      id: '', user_id: user.id, name: '默认', is_default: true,
      target_audience: null, tone_presets: [], tone_custom: null,
      reference_samples: [], image_style_note: null, forbidden_words: [],
      created_at: '', updated_at: '',
    }
    log('config', activeConfig.name)

    // Build message content
    const userContent: Array<ImageBlockParam | { type: 'text'; text: string }> = []
    for (const file of imageFiles.slice(0, 4)) {
      const buffer = await file.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
      userContent.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } })
    }
    userContent.push({ type: 'text', text: buildSingleVersionPrompt(articleText, version) })

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: object) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

        try {
          log(`calling claude for version_${version}`)
          let fullText = ''
          let chunkCount = 0

          const anthropicStream = anthropic.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 1200,
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

          log(`claude done version_${version}`, { chunks: chunkCount, length: fullText.length })

          if (!fullText.trim()) {
            send({ type: 'error', message: `[E-EMPTY] version_${version}: Claude返回空响应` })
            controller.close()
            return
          }

          let result: ContentVersion
          try {
            result = JSON.parse(extractJson(fullText)) as ContentVersion
            if (!result.title || !result.body) throw new Error('missing required fields')
          } catch (e) {
            log(`parse failed version_${version}`, { error: String(e), preview: fullText.slice(0, 150) })
            send({ type: 'error', message: `[E-PARSE] version_${version}: JSON解析失败 — ${String(e)}` })
            controller.close()
            return
          }

          log(`done version_${version}`)
          send({ type: 'done', result })
          controller.close()
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          log(`stream error version_${version}`, msg)
          send({ type: 'error', message: `[E-STREAM] version_${version}: ${msg}` })
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
    const msg = err instanceof Error ? err.message : String(err)
    log('unhandled route error', msg)
    return NextResponse.json({ error: `[E-ROUTE] ${msg}` }, { status: 500 })
  }
}
