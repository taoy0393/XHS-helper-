'use client'
import { useState, useEffect } from 'react'
import { InputPanel } from '@/components/generate/InputPanel'
import { OutputPanel } from '@/components/generate/OutputPanel'
import type { Config, ContentVersion, GenerationOutput, VersionKey, VersionsState } from '@/types'

const IDLE_VERSIONS: VersionsState = {
  a: { status: 'idle', stream: '' },
  b: { status: 'idle', stream: '' },
  c: { status: 'idle', stream: '' },
}

function extractJsonFallback(raw: string): ContentVersion | null {
  try {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    return JSON.parse(match ? match[1].trim() : raw.trim()) as ContentVersion
  } catch {
    return null
  }
}

export default function GeneratePage() {
  const [text, setText] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [configs, setConfigs] = useState<Config[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState('')
  const [versions, setVersions] = useState<VersionsState>(IDLE_VERSIONS)
  const [loading, setLoading] = useState(false)
  const [validationError, setValidationError] = useState('')

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

  // Prefill from history "regenerate"
  useEffect(() => {
    const prefill = sessionStorage.getItem('regenerate_text')
    if (prefill) {
      setText(prefill)
      sessionStorage.removeItem('regenerate_text')
    }
  }, [])

  async function generateVersion(v: VersionKey): Promise<ContentVersion | null> {
    const formData = new FormData()
    formData.append('text', text)
    formData.append('version', v)
    if (selectedConfigId) formData.append('config_id', selectedConfigId)
    images.forEach(img => formData.append('images', img))

    setVersions(prev => ({ ...prev, [v]: { status: 'loading', stream: '' } }))

    const startMs = Date.now()
    let accumulatedText = ''
    let gotDone = false

    try {
      const res = await fetch('/api/generate', { method: 'POST', body: formData })
      if (!res.ok) {
        let msg = `[E1] HTTP ${res.status}`
        try {
          const body = await res.json()
          msg = body.error ?? msg
        } catch { /* ignore */ }
        setVersions(prev => ({ ...prev, [v]: { status: 'error', stream: '', error: msg } }))
        return null
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
          let payload: { type: string; text?: string; result?: ContentVersion; message?: string }
          try { payload = JSON.parse(line.slice(6)) } catch { continue }

          if (payload.type === 'chunk') {
            accumulatedText += payload.text ?? ''
            setVersions(prev => ({
              ...prev,
              [v]: { ...prev[v], stream: prev[v].stream + (payload.text ?? '') },
            }))
          } else if (payload.type === 'done') {
            gotDone = true
            const result = payload.result!
            setVersions(prev => ({ ...prev, [v]: { status: 'done', stream: '', data: result } }))
            return result
          } else if (payload.type === 'error') {
            const msg = payload.message ?? '[E3] 服务端错误'
            setVersions(prev => ({ ...prev, [v]: { status: 'error', stream: '', error: msg } }))
            return null
          }
        }
      }

      // Stream ended without done event — try fallback parse
      if (!gotDone) {
        const elapsed = Math.round((Date.now() - startMs) / 1000)
        const fallback = extractJsonFallback(accumulatedText)
        if (fallback) {
          setVersions(prev => ({ ...prev, [v]: { status: 'done', stream: '', data: fallback } }))
          return fallback
        }
        const chars = accumulatedText.length
        const preview = accumulatedText.slice(-60)
        const msg = chars === 0
          ? `[E4] version_${v}: 无响应 (${elapsed}s) — 可能是函数超时`
          : `[E5] version_${v}: 流中断 (${elapsed}s, ${chars}字符) 末尾:"${preview}"`
        console.warn('[generate]', msg)
        setVersions(prev => ({ ...prev, [v]: { status: 'error', stream: '', error: msg } }))
        return null
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `[E0] version_${v}: 未知错误`
      console.error('[generate]', msg)
      setVersions(prev => ({ ...prev, [v]: { status: 'error', stream: '', error: msg } }))
    }
    return null
  }

  async function handleGenerate() {
    if (!text.trim()) {
      setValidationError('请输入文章内容')
      return
    }
    setValidationError('')
    setVersions({
      a: { status: 'loading', stream: '' },
      b: { status: 'loading', stream: '' },
      c: { status: 'loading', stream: '' },
    })
    setLoading(true)

    try {
      const [resultA, resultB, resultC] = await Promise.all([
        generateVersion('a'),
        generateVersion('b'),
        generateVersion('c'),
      ])

      // Save to history only if all 3 succeeded
      if (resultA && resultB && resultC) {
        const output: GenerationOutput = {
          version_a: resultA,
          version_b: resultB,
          version_c: resultC,
        }
        fetch('/api/histories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input_text: text, config_id: selectedConfigId || null, output }),
        }).catch(e => console.warn('[history save]', e))
      }
    } finally {
      setLoading(false)
    }
  }

  const allIdle = Object.values(versions).every(v => v.status === 'idle')

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
          {validationError && (
            <p className="mt-2 text-sm text-red-500">{validationError}</p>
          )}
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">生成结果</h2>
          {allIdle ? (
            <div className="flex items-center justify-center min-h-[400px] text-gray-400 border-2 border-dashed rounded-xl">
              <p className="text-sm">生成结果将在此显示</p>
            </div>
          ) : (
            <OutputPanel versions={versions} />
          )}
        </div>
      </div>
    </div>
  )
}
