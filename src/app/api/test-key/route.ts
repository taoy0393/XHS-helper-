import { NextResponse } from 'next/server'

export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY ?? ''
  const preview = key ? `${key.slice(0, 20)}...${key.slice(-4)}` : '(not set)'

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    })

    const body = await res.json()
    return NextResponse.json({ status: res.status, key_preview: preview, body })
  } catch (err) {
    return NextResponse.json({ error: String(err), key_preview: preview })
  }
}
