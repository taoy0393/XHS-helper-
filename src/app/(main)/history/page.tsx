'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { OutputPanel, outputToVersionsState } from '@/components/generate/OutputPanel'
import type { History } from '@/types'

export default function HistoryPage() {
  const router = useRouter()
  const [items, setItems] = useState<History[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [selected, setSelected] = useState<History | null>(null)

  const fetchHistory = useCallback(async (p: number) => {
    setLoading(true)
    setFetchError('')
    try {
      const res = await fetch(`/api/histories?page=${p}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setFetchError(`加载失败 (HTTP ${res.status})${body.error ? `: ${body.error}` : ''}`)
        setItems([])
        setTotal(0)
      } else {
        const data = await res.json()
        setItems(data.items ?? [])
        setTotal(data.total ?? 0)
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : '网络错误')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchHistory(page) }, [fetchHistory, page])

  async function handleDelete(id: string) {
    if (!confirm('确认删除该记录？')) return
    await fetch('/api/histories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    fetchHistory(page)
    if (selected?.id === id) setSelected(null)
  }

  function handleRegenerate(item: History) {
    sessionStorage.setItem('regenerate_text', item.input_text)
    router.push('/generate')
  }

  if (loading) return <div className="p-8 text-gray-400">加载中…</div>

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">历史记录</h1>
        <span className="text-sm text-gray-500">共 {total} 条</span>
      </div>

      {fetchError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      {!fetchError && items.length === 0 && (
        <p className="text-gray-500 text-sm">暂无历史记录，去生成一篇吧</p>
      )}

      <div className="space-y-3">
        {items.map(item => (
          <Card
            key={item.id}
            className="hover:shadow-sm transition-shadow cursor-pointer"
            onClick={() => setSelected(item)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="text-base font-medium line-clamp-1">
                  {item.title_preview ?? '（无标题）'}
                </CardTitle>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 px-2"
                    onClick={e => { e.stopPropagation(); handleRegenerate(item) }}
                  >
                    重新生成
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 px-2 text-red-500 hover:text-red-700"
                    onClick={e => { e.stopPropagation(); handleDelete(item.id) }}
                  >
                    删除
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              <p className="text-xs text-gray-500 line-clamp-2">{item.input_text}</p>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>{new Date(item.created_at).toLocaleString('zh-CN')}</span>
                {item.config_snapshot?.name && (
                  <Badge variant="outline" className="text-xs">{item.config_snapshot.name}</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {total > 20 && (
        <div className="flex justify-center gap-4 mt-8">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            上一页
          </Button>
          <span className="text-sm text-gray-500 self-center">第 {page} 页</span>
          <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>
            下一页
          </Button>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-8 line-clamp-1">{selected?.title_preview ?? '历史记录'}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              {/* input text */}
              <div className="text-xs text-gray-500 bg-gray-50 rounded p-3 max-h-32 overflow-y-auto">
                {selected.input_text}
              </div>

              {/* actions */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleRegenerate(selected)}
                  className="text-xs"
                >
                  用此内容重新生成（当前配置）
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-red-500 hover:text-red-700"
                  onClick={() => handleDelete(selected.id)}
                >
                  删除此记录
                </Button>
              </div>

              <OutputPanel versions={outputToVersionsState(selected.output)} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
