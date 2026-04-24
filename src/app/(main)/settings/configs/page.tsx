'use client'
import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfigForm } from '@/components/configs/ConfigForm'
import { type Config } from '@/types'

export default function ConfigsPage() {
  const [configs, setConfigs] = useState<Config[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Config | null>(null)

  const fetchConfigs = useCallback(async () => {
    const res = await fetch('/api/configs')
    if (res.ok) setConfigs(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchConfigs() }, [fetchConfigs])

  async function handleSave(data: Partial<Config>) {
    if (editing) {
      const res = await fetch(`/api/configs/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error((await res.json()).error)
    } else {
      const res = await fetch('/api/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error((await res.json()).error)
    }
    setDialogOpen(false)
    setEditing(null)
    await fetchConfigs()
  }

  async function handleDelete(id: string) {
    if (!confirm('确认删除该配置？')) return
    await fetch(`/api/configs/${id}`, { method: 'DELETE' })
    await fetchConfigs()
  }

  async function handleSetDefault(id: string) {
    await fetch(`/api/configs/${id}/default`, { method: 'PUT' })
    await fetchConfigs()
  }

  function openNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(config: Config) {
    setEditing(config)
    setDialogOpen(true)
  }

  if (loading) return <div className="p-8 text-gray-400">加载中…</div>

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">配置管理</h1>
        <Button onClick={openNew}>+ 新建配置</Button>
      </div>

      {configs.length === 0 && (
        <p className="text-gray-500 text-sm">还没有配置，点击右上角新建一个吧</p>
      )}

      <div className="space-y-4">
        {configs.map(config => (
          <Card key={config.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{config.name}</CardTitle>
                  {config.is_default && <Badge variant="secondary">默认</Badge>}
                </div>
                <div className="flex gap-2">
                  {!config.is_default && (
                    <Button variant="outline" size="sm" onClick={() => handleSetDefault(config.id)}>设为默认</Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => openEdit(config)}>编辑</Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(config.id)} className="text-red-600 hover:text-red-700">删除</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {config.tone_presets.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {config.tone_presets.map(preset => (
                    <Badge key={preset} variant="outline" className="text-xs">{preset}</Badge>
                  ))}
                </div>
              )}
              {config.target_audience && (
                <p className="text-sm text-gray-500 mt-1 truncate">{config.target_audience}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) setEditing(null) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑配置' : '新建配置'}</DialogTitle>
          </DialogHeader>
          <ConfigForm
            defaultValues={editing ?? undefined}
            onSave={handleSave}
            onCancel={() => { setDialogOpen(false); setEditing(null) }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
