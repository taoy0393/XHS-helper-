import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PUT(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  await supabase
    .from('configs')
    .update({ is_default: false })
    .eq('user_id', user.id)

  const { data, error } = await supabase
    .from('configs')
    .update({ is_default: true })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
