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
        const err = await res.json()
        throw new Error(err.error ?? '请求失败')
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = JSON.parse(line.slice(6))

          if (payload.type === 'chunk') {
            setStreamText(prev => prev + payload.text)
          } else if (payload.type === 'done') {
            setOutput(payload.result)
            setStreaming(false)
          } else if (payload.type === 'error') {
            throw new Error(payload.message)
          }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '生成失败，请重试')
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
            <p className="mt-3 text-sm text-red-500">{error}</p>
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
