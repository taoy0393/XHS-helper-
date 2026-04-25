'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ContentVersion, VersionsState, GenerationOutput } from '@/types'

interface Props {
  versions: VersionsState
}

const CARD_COLORS: Record<'a' | 'b' | 'c', string> = {
  a: 'border-pink-200 bg-pink-50',
  b: 'border-purple-200 bg-purple-50',
  c: 'border-blue-200 bg-blue-50',
}

// Convert a finished GenerationOutput (from history) into VersionsState
export function outputToVersionsState(output: GenerationOutput): VersionsState {
  return {
    a: { status: 'done', stream: '', data: output.version_a },
    b: { status: 'done', stream: '', data: output.version_b },
    c: { status: 'done', stream: '', data: output.version_c },
  }
}

export function OutputPanel({ versions }: Props) {
  return (
    <div className="space-y-6">
      {(['a', 'b', 'c'] as const).map(key => {
        const v = versions[key]
        return (
          <VersionSlot key={key} vkey={key} state={v} color={CARD_COLORS[key]} />
        )
      })}
    </div>
  )
}

function VersionSlot({
  vkey, state, color,
}: {
  vkey: 'a' | 'b' | 'c'
  state: VersionsState['a']
  color: string
}) {
  if (state.status === 'loading') {
    return (
      <div className={`rounded-xl border-2 ${color} overflow-hidden`}>
        <div className="flex items-center gap-2 px-4 py-2 border-b border-inherit">
          <span className="inline-block w-2 h-2 rounded-full bg-current animate-pulse opacity-60" />
          <span className="text-xs text-gray-500">
            version_{vkey} 生成中…{state.stream.length > 0 ? ` (${state.stream.length}字符)` : ''}
          </span>
        </div>
        {state.stream && (
          <pre className="px-4 py-3 text-xs text-gray-400 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-hidden bg-white">
            {state.stream.slice(-300)}
          </pre>
        )}
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-xl border-2 border-red-200 bg-red-50 overflow-hidden">
        <div className="px-4 py-2 border-b border-red-200">
          <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">version_{vkey} 失败</Badge>
        </div>
        <pre className="px-4 py-3 text-xs text-red-700 whitespace-pre-wrap break-all bg-white">
          {state.error}
        </pre>
      </div>
    )
  }

  if (state.status === 'done' && state.data) {
    return <VersionCard version={state.data} color={color} />
  }

  return null
}

function VersionCard({ version, color }: { version: ContentVersion; color: string }) {
  const [copied, setCopied] = useState(false)
  const [briefOpen, setBriefOpen] = useState(false)

  async function copy() {
    const text = `${version.title}\n\n${version.body}\n\n${version.tags.join(' ')}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`rounded-xl border-2 ${color} overflow-hidden`}>
      {/* header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-inherit">
        <Badge variant="secondary" className="text-xs font-semibold">{version.label}</Badge>
        <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={copy}>
          {copied ? '已复制 ✓' : '复制全文'}
        </Button>
      </div>

      {/* XHS post body */}
      <div className="p-4 space-y-3 bg-white">
        <p className="text-base font-bold leading-snug text-gray-900">{version.title}</p>
        <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">{version.body}</p>
        <p className="text-sm text-[#ff2442] font-medium">{version.tags.join(' ')}</p>
      </div>

      {/* image brief collapsible */}
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
                <span key={`${k}-l`} className="font-medium text-gray-500 pt-0.5">{labelFor(k)}</span>
                <span key={`${k}-v`} className="text-gray-700">{v as string}</span>
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
    description: '方向', scene: '场景', composition: '构图',
    lighting: '光线', color_tone: '色调', props: '道具', avoid: '避免',
  }
  return map[key] ?? key
}
