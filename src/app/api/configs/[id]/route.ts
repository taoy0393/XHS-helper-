import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function getOwnedConfig(supabase: Awaited<ReturnType<typeof createClient>>, id: string, userId: string) {
  const { data } = await supabase
    .from('configs')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  return data
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const config = await getOwnedConfig(supabase, id, user.id)
  if (!config) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json(config)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const existing = await getOwnedConfig(supabase, id, user.id)
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const body = await req.json()
  const allowed = ['name', 'target_audience', 'tone_presets', 'tone_custom', 'reference_samples', 'image_style_note', 'forbidden_words']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const { data, error } = await supabase
    .from('configs')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('configs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
