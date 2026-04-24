'use client'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { Config } from '@/types'

interface Props {
  text: string
  onTextChange: (v: string) => void
  images: File[]
  onImagesChange: (files: File[]) => void
  configs: Config[]
  selectedConfigId: string
  onConfigChange: (id: string) => void
  onGenerate: () => void
  loading: boolean
}

export function InputPanel({
  text, onTextChange, images, onImagesChange,
  configs, selectedConfigId, onConfigChange,
  onGenerate, loading,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 4)
    onImagesChange(files)
    e.target.value = ''
  }

  function removeImage(index: number) {
    onImagesChange(images.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      {configs.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="config-select">使用配置</Label>
          <select
            id="config-select"
            value={selectedConfigId}
            onChange={e => onConfigChange(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
          >
            {configs.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.is_default ? ' （默认）' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="article-text">
          公众号文章内容 <span className="text-gray-400 text-xs">({text.length} 字)</span>
        </Label>
        <Textarea
          id="article-text"
          value={text}
          onChange={e => onTextChange(e.target.value)}
          placeholder="粘贴公众号文章正文内容…"
          rows={14}
          className="resize-none font-mono text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <Label>配图参考 <span className="text-gray-400 text-xs">（可选，最多 4 张）</span></Label>
        <div className="flex flex-wrap gap-2">
          {images.map((file, i) => (
            <div key={i} className="relative group">
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="h-16 w-16 object-cover rounded border"
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
          {images.length < 4 && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="h-16 w-16 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 hover:border-gray-500 hover:text-gray-600 transition-colors text-2xl"
            >
              +
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <Button
        onClick={onGenerate}
        disabled={loading || !text.trim()}
        className="w-full"
        size="lg"
      >
        {loading ? '生成中…' : '✨ 生成小红书文案'}
      </Button>
    </div>
  )
}
