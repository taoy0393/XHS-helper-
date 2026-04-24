'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { type Config, TONE_PRESETS } from '@/types'

interface Props {
  defaultValues?: Partial<Config>
  onSave: (data: Partial<Config>) => Promise<void>
  onCancel: () => void
}

export function ConfigForm({ defaultValues, onSave, onCancel }: Props) {
  const [name, setName] = useState(defaultValues?.name ?? '')
  const [targetAudience, setTargetAudience] = useState(defaultValues?.target_audience ?? '')
  const [tonePresets, setTonePresets] = useState<string[]>(defaultValues?.tone_presets ?? [])
  const [toneCustom, setToneCustom] = useState(defaultValues?.tone_custom ?? '')
  const [referenceSamples, setReferenceSamples] = useState<string[]>(defaultValues?.reference_samples ?? [''])
  const [imageStyleNote, setImageStyleNote] = useState(defaultValues?.image_style_note ?? '')
  const [forbiddenWords, setForbiddenWords] = useState<string[]>(defaultValues?.forbidden_words ?? [])
  const [newForbiddenWord, setNewForbiddenWord] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleTonePreset(preset: string) {
    setTonePresets(prev =>
      prev.includes(preset) ? prev.filter(p => p !== preset) : [...prev, preset]
    )
  }

  function updateSample(index: number, value: string) {
    setReferenceSamples(prev => prev.map((s, i) => i === index ? value : s))
  }

  function addSample() {
    if (referenceSamples.length < 5) setReferenceSamples(prev => [...prev, ''])
  }

  function removeSample(index: number) {
    setReferenceSamples(prev => prev.filter((_, i) => i !== index))
  }

  function addForbiddenWord() {
    const word = newForbiddenWord.trim()
    if (word && !forbiddenWords.includes(word)) {
      setForbiddenWords(prev => [...prev, word])
      setNewForbiddenWord('')
    }
  }

  function removeForbiddenWord(word: string) {
    setForbiddenWords(prev => prev.filter(w => w !== word))
  }

  async function handleSave() {
    if (!name.trim()) { setError('配置名称不能为空'); return }
    setError('')
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        target_audience: targetAudience || null,
        tone_presets: tonePresets,
        tone_custom: toneCustom || null,
        reference_samples: referenceSamples.filter(Boolean),
        image_style_note: imageStyleNote || null,
        forbidden_words: forbiddenWords,
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="cfg-name">配置名称 *</Label>
        <Input id="cfg-name" value={name} onChange={e => setName(e.target.value)} placeholder="例：职场干货号" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cfg-audience">目标受众 <span className="text-gray-400 text-xs">({targetAudience.length}/500)</span></Label>
        <Textarea
          id="cfg-audience"
          value={targetAudience}
          onChange={e => setTargetAudience(e.target.value.slice(0, 500))}
          placeholder="描述你的目标读者群体"
          rows={2}
        />
      </div>

      <div className="space-y-1.5">
        <Label>语气风格</Label>
        <div className="flex flex-wrap gap-2">
          {TONE_PRESETS.map(preset => (
            <button
              key={preset}
              type="button"
              onClick={() => toggleTonePreset(preset)}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                tonePresets.includes(preset)
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cfg-tone-custom">自定义语气 <span className="text-gray-400 text-xs">({toneCustom.length}/300)</span></Label>
        <Textarea
          id="cfg-tone-custom"
          value={toneCustom}
          onChange={e => setToneCustom(e.target.value.slice(0, 300))}
          placeholder="例：亲切随和，像朋友聊天"
          rows={2}
        />
      </div>

      <div className="space-y-1.5">
        <Label>参考样本 <span className="text-gray-400 text-xs">(最多5条)</span></Label>
        <div className="space-y-2">
          {referenceSamples.map((sample, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={sample}
                onChange={e => updateSample(i, e.target.value)}
                placeholder={`参考文案 ${i + 1}`}
              />
              {referenceSamples.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => removeSample(i)}>删除</Button>
              )}
            </div>
          ))}
          {referenceSamples.length < 5 && (
            <Button variant="outline" size="sm" onClick={addSample}>+ 添加样本</Button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cfg-image">配图风格说明</Label>
        <Textarea
          id="cfg-image"
          value={imageStyleNote}
          onChange={e => setImageStyleNote(e.target.value)}
          placeholder="例：清新简约，浅色背景，无文字"
          rows={2}
        />
      </div>

      <div className="space-y-1.5">
        <Label>屏蔽词</Label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {forbiddenWords.map(word => (
            <span key={word} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 rounded text-sm">
              {word}
              <button type="button" onClick={() => removeForbiddenWord(word)} className="hover:text-red-900">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newForbiddenWord}
            onChange={e => setNewForbiddenWord(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addForbiddenWord()}
            placeholder="输入后按回车添加"
          />
          <Button variant="outline" size="sm" onClick={addForbiddenWord}>添加</Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3 pt-2">
        <Button onClick={handleSave} disabled={saving}>{saving ? '保存中…' : '保存'}</Button>
        <Button variant="outline" onClick={onCancel}>取消</Button>
      </div>
    </div>
  )
}
