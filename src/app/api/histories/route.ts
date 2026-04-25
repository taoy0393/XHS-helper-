import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = 20
  const from = (page - 1) * limit
  const to = from + limit - 1

  const { data, error, count } = await supabase
    .from('histories')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data, total: count ?? 0 })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { input_text, config_id, output } = await req.json()
  if (!input_text || !output?.version_a) {
    return NextResponse.json({ error: 'missing input_text or output' }, { status: 400 })
  }

  // Resolve config for snapshot
  let config = null
  if (config_id) {
    const { data } = await supabase.from('configs').select('*').eq('id', config_id).eq('user_id', user.id).single()
    config = data
  }
  if (!config) {
    const { data } = await supabase.from('configs').select('*').eq('user_id', user.id).eq('is_default', true).single()
    config = data
  }
  const c = config ?? { name: '默认', target_audience: null, tone_presets: [], tone_custom: null, reference_samples: [], image_style_note: null, forbidden_words: [], is_default: true }

  const { data, error } = await supabase.from('histories').insert({
    user_id: user.id,
    input_text,
    input_images: [],
    config_snapshot: {
      name: c.name,
      target_audience: c.target_audience,
      tone_presets: c.tone_presets,
      tone_custom: c.tone_custom,
      reference_samples: c.reference_samples,
      image_style_note: c.image_style_note,
      forbidden_words: c.forbidden_words,
      is_default: c.is_default,
    },
    output,
    title_preview: output.version_a?.title ?? null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  const { error } = await supabase
    .from('histories')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
