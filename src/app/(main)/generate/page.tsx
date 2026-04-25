'use client'
import { useState, useEffect } from 'react'
import { InputPanel } from '@/components/generate/InputPanel'
import { OutputPanel } from '@/components/generate/OutputPanel'
import type { Config, GenerationOutput } from '@/types'

function extractJsonFallback(raw: string): GenerationOutput | null {
  try {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    const cleaned = match ? match[1].trim() : raw.trim()
    return JSON.parse(cleaned) as GenerationOutput
  } catch {
    return null
  }
}

export default function GeneratePage() {
  const [text, setText] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [configs, setConfigs] = useState<Config[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState('')
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [output, setOutput] = useState<GenerationOutput | null>(null)
  const [error, setError] = useState('')

  // Load configs
  useEffect(() => {
    fetch('/api/configs')
      .then(r => r.json())
      .then((data: Config[]) => {
        if (!Array.isArray(data)) return
        setConfigs(data)
        const def = data.find(c => c.is_default) ?? data[0]
        if (def) setSelectedConfigId(def.id)
      })
      .catch(() => {})
  }, [])

  // Prefill text from history "regenerate" action
  useEffect(() => {
    const prefill = sessionStorage.getItem('regenerate_text')
    if (prefill) {
      setText(prefill)
      sessionStorage.removeItem('regenerate_text')
    }
  }, [])

  async function handleGenerate() {
    if (!text.trim()) return
    setError('')
    setOutput(null)
    setStreamText('')
    setLoading(true)
    setStreaming(true)

    const formData = new FormData()
    formData.append('text', text)
    if (selectedConfigId) formData.append('config_id', selectedConfigId)
    images.forEach(img => formData.append('images', img))

    let accumulatedText = ''
    let gotDoneEvent = false

    try {
      const res = await fetch('/api/generate', { method: 'POST', body: formData })
      if (!res.ok) {
        let detail = `[E1] HTTP ${res.status}`
        try {
          const err = await res.json()
          detail = `[E1] HTTP ${res.status} — ${err.error ?? '未知错误'}`
          if (err.detail) detail += ` (${err.detail})`
        } catch {
          detail += ` — ${await res.text().catch(() => '(no body)')}`
        }
        throw new Error(detail)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let lineNum = 0
      const startMs = Date.now()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          lineNum++
          let payload: { type: string; text?: string; result?: GenerationOutput; message?: string }
          try {
            payload = JSON.parse(line.slice(6))
          } catch {
            console.warn('[generate] unparseable SSE line', line)
            continue
          }

          if (payload.type === 'chunk') {
            accumulatedText += payload.text ?? ''
            setStreamText(prev => prev + (payload.text ?? ''))
          } else if (payload.type === 'done') {
            gotDoneEvent = true
            if (payload.result && payload.result.version_a) {
              setOutput(payload.result)
            } else {
              const fallback = extractJsonFallback(accumulatedText)
              if (fallback) {
                setOutput(fallback)
              } else {
                throw new Error(
                  `[E2] done事件收到但结果为空 — chars:${accumulatedText.length} events:${lineNum}`
                )
              }
            }
            setStreaming(false)
          } else if (payload.type === 'error') {
            throw new Error(`[E3] 服务端错误 — ${payload.message ?? '未知'}`)
          }
        }
      }

      // Stream ended without a done event
      if (!gotDoneEvent) {
        const elapsed = Math.round((Date.now() - startMs) / 1000)
        const chars = accumulatedText.length
        console.warn('[generate] no done event', { lineNum, chars, elapsed })
        const fallback = extractJsonFallback(accumulatedText)
        if (fallback) {
          setOutput(fallback)
        } else if (lineNum === 0) {
          throw new Error(`[E4] 服务端无响应 (${elapsed}s) — 请检查Vercel Function日志`)
        } else {
          // Most likely cause: Vercel function timeout cut the stream mid-JSON
          throw new Error(
            `[E5] 流中断 (${elapsed}s) — 已收到${lineNum}行/${chars}字符但JSON不完整。` +
            `可能是Vercel函数超时(Hobby限10s)。末尾: "${accumulatedText.slice(-80)}"`
          )
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '[E0] 生成失败'
      console.error('[generate] client error:', msg)
      setError(msg)
    } finally {
      setLoading(false)
      setStreaming(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="lg:sticky lg:top-8 lg:self-start">
          <h2 className="text-xl font-semibold mb-4">输入文章</h2>
          <InputPanel
            text={text}
            onTextChange={setText}
            images={images}
            onImagesChange={setImages}
            configs={configs}
            selectedConfigId={selectedConfigId}
            onConfigChange={setSelectedConfigId}
            onGenerate={handleGenerate}
            loading={loading}
          />
          {error && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-xs font-semibold text-red-600 mb-1">生成失败</p>
              <pre className="text-xs text-red-700 whitespace-pre-wrap break-all">{error}</pre>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">生成结果</h2>
          <OutputPanel output={output} streaming={streaming} streamText={streamText} />
        </div>
      </div>
    </div>
  )
}
