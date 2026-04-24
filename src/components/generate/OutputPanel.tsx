'use client'
import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { GenerationOutput, ContentVersion } from '@/types'

interface Props {
  output: GenerationOutput | null
  streaming: boolean
  streamText: string
}

export function OutputPanel({ output, streaming, streamText }: Props) {
  if (!output && !streaming) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-gray-400 border-2 border-dashed rounded-xl">
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
        <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed max-h-[500px] overflow-y-auto">
          {streamText}
        </pre>
      </div>
    )
  }

  if (!output) return null

  const versions = [
    { key: 'version_a', data: output.version_a },
    { key: 'version_b', data: output.version_b },
    { key: 'version_c', data: output.version_c },
  ]

  return (
    <Tabs defaultValue="version_a">
      <TabsList className="w-full mb-4">
        {versions.map(({ key, data }) => (
          <TabsTrigger key={key} value={key} className="flex-1">
            {data?.label ?? key}
          </TabsTrigger>
        ))}
      </TabsList>
      {versions.map(({ key, data }) => (
        <TabsContent key={key} value={key}>
          <VersionCard version={data} />
        </TabsContent>
      ))}
    </Tabs>
  )
}

function VersionCard({ version }: { version: ContentVersion }) {
  const [copied, setCopied] = useState(false)
  const [briefOpen, setBriefOpen] = useState(false)

  async function copyAll() {
    const text = `${version.title}\n\n${version.body}\n\n${version.tags.join(' ')}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold leading-snug">{version.title}</h2>
        <Button variant="outline" size="sm" onClick={copyAll} className="shrink-0">
          {copied ? '已复制' : '复制全文'}
        </Button>
      </div>

      <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
        {version.body}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {version.tags.map(tag => (
          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
        ))}
      </div>

      <Card className="bg-amber-50 border-amber-200">
        <CardHeader
          className="pb-2 cursor-pointer flex flex-row items-center justify-between"
          onClick={() => setBriefOpen(v => !v)}
        >
          <CardTitle className="text-sm text-amber-800">📷 配图创作简报</CardTitle>
          <span className="text-amber-600 text-xs">{briefOpen ? '收起' : '展开'}</span>
        </CardHeader>
        {briefOpen && (
          <CardContent className="pt-0 text-sm space-y-1 text-amber-900">
            {Object.entries(version.image_brief).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="font-medium shrink-0 w-16">{labelFor(k)}</span>
                <span>{v}</span>
              </div>
            ))}
          </CardContent>
        )}
      </Card>
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
