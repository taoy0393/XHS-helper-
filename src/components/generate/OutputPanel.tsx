'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { GenerationOutput, ContentVersion } from '@/types'

interface Props {
  output: GenerationOutput | null
  streaming: boolean
  streamText: string
}

export function OutputPanel({ output, streaming, streamText }: Props) {
  if (!output && !streaming) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-gray-400 border-2 border-dashed rounded-xl">
        <p className="text-sm">生成结果将在此显示</p>
      </div>
    )
  }

  if (streaming && !output) {
    return (
      <div className="border rounded-xl p-6 min-h-[400px]">
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
          <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          正在生成中…
        </div>
        <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono leading-relaxed max-h-[500px] overflow-y-auto">
          {streamText}
        </pre>
      </div>
    )
  }

  if (!output) return null

  const versions: { key: keyof GenerationOutput; color: string }[] = [
    { key: 'version_a', color: 'border-pink-200 bg-pink-50' },
    { key: 'version_b', color: 'border-purple-200 bg-purple-50' },
    { key: 'version_c', color: 'border-blue-200 bg-blue-50' },
  ]

  return (
    <div className="space-y-6">
      {versions.map(({ key, color }) => {
        const version = output[key]
        if (!version) return null
        return <VersionCard key={key} version={version} borderColor={color} />
      })}
    </div>
  )
}

function VersionCard({ version, borderColor }: { version: ContentVersion; borderColor: string }) {
  const [copied, setCopied] = useState(false)
  const [briefOpen, setBriefOpen] = useState(false)

  const copyText = `${version.title}\n\n${version.body}\n\n${version.tags.join(' ')}`

  async function copy() {
    await navigator.clipboard.writeText(copyText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`rounded-xl border-2 ${borderColor} overflow-hidden`}>
      {/* card header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-inherit">
        <Badge variant="secondary" className="text-xs font-semibold">{version.label}</Badge>
        <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={copy}>
          {copied ? '已复制 ✓' : '复制全文'}
        </Button>
      </div>

      {/* XHS post preview */}
      <div className="p-4 space-y-3 bg-white">
        {/* title */}
        <p className="text-base font-bold leading-snug text-gray-900">{version.title}</p>

        {/* body */}
        <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">{version.body}</p>

        {/* tags — rendered as plain text the way XHS shows them */}
        <p className="text-sm text-[#ff2442] font-medium leading-relaxed">
          {version.tags.join(' ')}
        </p>
      </div>

      {/* image brief — collapsible */}
      <div className="border-t border-inherit">
        <button
          className="w-full flex items-center justify-between px-4 py-2 text-xs text-gray-500 hover:bg-black/5 transition-colors"
          onClick={() => setBriefOpen(v => !v)}
        >
          <span>📷 配图创作简报</span>
          <span>{briefOpen ? '▲ 收起' : '▼ 展开'}</span>
        </button>
        {briefOpen && (
          <div className="px-4 pb-4 grid grid-cols-[64px_1fr] gap-x-3 gap-y-1.5 text-xs bg-white">
            {Object.entries(version.image_brief ?? {}).map(([k, v]) => (
              <>
                <span key={`${k}-label`} className="font-medium text-gray-500 pt-0.5">{labelFor(k)}</span>
                <span key={`${k}-value`} className="text-gray-700">{v as string}</span>
              </>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function labelFor(key: string): string {
  const map: Record<string, string> = {
    description: '方向',
    scene: '场景',
    composition: '构图',
    lighting: '光线',
    color_tone: '色调',
    props: '道具',
    avoid: '避免',
  }
  return map[key] ?? key
}
