import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('configs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, target_audience, tone_presets, tone_custom, reference_samples, image_style_note, forbidden_words } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: '配置名称不能为空' }, { status: 400 })
  }

  const { count } = await supabase
    .from('configs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const { data, error } = await supabase
    .from('configs')
    .insert({
      user_id: user.id,
      name: name.trim(),
      is_default: count === 0,
      target_audience: target_audience || null,
      tone_presets: tone_presets || [],
      tone_custom: tone_custom || null,
      reference_samples: reference_samples || [],
      image_style_note: image_style_note || null,
      forbidden_words: forbidden_words || [],
    })
    .select()
    .single()

  if (error) {
    if (error.message.includes('config_limit_exceeded')) {
      return NextResponse.json({ error: '最多保存 10 套配置' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
