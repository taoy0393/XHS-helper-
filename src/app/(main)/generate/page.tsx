'use client'
import { useState, useEffect } from 'react'
import { InputPanel } from '@/components/generate/InputPanel'
import { OutputPanel } from '@/components/generate/OutputPanel'
import type { Config, GenerationOutput } from '@/types'

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

  useEffect(() => {
    fetch('/api/configs')
      .then(r => r.json())
      .then((data: Config[]) => {
        setConfigs(data)
        const def = data.find(c => c.is_default) ?? data[0]
        if (def) setSelectedConfigId(def.id)
      })
      .catch(() => {})
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

    try {
      const res = await fetch('/api/generate', { method: 'POST', body: formData })
      if (!res.ok) {
        let detail = `HTTP ${res.status}`
        try {
          const err = await res.json()
          detail = err.error ?? detail
          if (err.detail) detail += `: ${err.detail}`
        } catch {
          detail += ` — ${await res.text().catch(() => '(no body)')}`
        }
        throw new Error(detail)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let lineNum = 0

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
            setStreamText(prev => prev + (payload.text ?? ''))
          } else if (payload.type === 'done') {
            setOutput(payload.result!)
            setStreaming(false)
          } else if (payload.type === 'error') {
            throw new Error(payload.message ?? '服务端错误')
          }
        }
      }

      if (lineNum === 0) {
        throw new Error('服务端无响应 — 请检查终端日志')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '生成失败，请重试'
      console.error('[generate] client error:', msg)
      setError(msg)
      setStreaming(false)
    } finally {
      setLoading(false)
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
