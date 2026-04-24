# XHS Helper — Claude Code Implementation Guide

> Coding guidelines: follow Karpathy rules — surgical changes, simplicity first, surface assumptions, define verifiable success criteria before each step.

---

## Project Overview

A Next.js web app that converts WeChat Official Account articles into Xiaohongshu (XHS) content. Three output versions per generation (草种型/共鸣型/干货型), with user auth, config profiles, and generation history.

**Tech stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase (Auth + Postgres + Storage) · Anthropic Claude API · Zustand · Vercel (deploy target)

---

## Environment Setup

Before running any steps, ensure `.env.local` exists at project root with:

```bash
NEXT_PUBLIC_SUPABASE_URL=         # from Supabase project settings
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # from Supabase project settings → API
SUPABASE_SERVICE_ROLE_KEY=        # from Supabase project settings → API (never expose to client)
ANTHROPIC_API_KEY=                # Anthropic console
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> ⚠️ If any key is missing, stop and tell the user which keys are needed before proceeding.

---

## Phase 1 — Project Scaffold + Auth

### Step 1.1 — Create Next.js project

```bash
npx create-next-app@latest wx-to-xhs \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-eslint
cd wx-to-xhs
```

**Verify:** `npm run dev` starts without errors, http://localhost:3000 loads.

---

### Step 1.2 — Install dependencies

```bash
npm install @supabase/ssr @supabase/supabase-js
npm install @anthropic-ai/sdk
npm install zustand
npm install @radix-ui/react-slot class-variance-authority clsx tailwind-merge lucide-react
npx shadcn@latest init --defaults
npx shadcn@latest add button input label textarea card tabs badge toast separator dialog alert
```

**Verify:** `npm run build` completes (or `npm run dev` without import errors).

---

### Step 1.3 — Supabase client utilities

Create `src/lib/supabase/client.ts` — browser-side Supabase client:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

Create `src/lib/supabase/server.ts` — server-side client (Server Components + Route Handlers):

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

Create `src/lib/supabase/middleware.ts` — for use in Next.js middleware:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register')
  const isProtected = pathname.startsWith('/generate') || pathname.startsWith('/history') || pathname.startsWith('/settings')

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/generate'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

Create `src/middleware.ts`:

```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

**Verify:** Navigating to `http://localhost:3000/generate` redirects to `/login`.

---

### Step 1.4 — Auth pages

Create `src/app/(auth)/login/page.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('邮箱或密码错误，请重试')
    } else {
      router.push('/generate')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">登录</CardTitle>
          <CardDescription>公众号 → 小红书文案助手</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button className="w-full" onClick={handleLogin} disabled={loading}>
            {loading ? '登录中…' : '登录'}
          </Button>
          <p className="text-sm text-gray-500">
            还没有账号？<Link href="/register" className="text-blue-600 hover:underline">注册</Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
```

Create `src/app/(auth)/register/page.tsx` — same structure, call `supabase.auth.signUp()`, show "请查收验证邮件" on success.

Create `src/app/(auth)/layout.tsx`:

```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

**Verify:** Register with a real email → login → redirected to `/generate` (will 404 for now, that's fine).

---

### Step 1.5 — Root redirect

Update `src/app/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  redirect(user ? '/generate' : '/login')
}
```

---

## Phase 2 — Database Schema

### Step 2.1 — SQL migration

Create `supabase/migrations/001_init.sql` and run it in the Supabase SQL editor:

```sql
-- configs table
CREATE TABLE configs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  is_default       BOOLEAN DEFAULT false,
  target_audience  TEXT CHECK (char_length(target_audience) <= 500),
  tone_presets     TEXT[] DEFAULT '{}',
  tone_custom      TEXT CHECK (char_length(tone_custom) <= 300),
  reference_samples TEXT[] DEFAULT '{}',
  image_style_note TEXT,
  forbidden_words  TEXT[] DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_configs_user_id ON configs(user_id);

-- histories table
CREATE TABLE histories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  input_text      TEXT NOT NULL,
  input_images    JSONB DEFAULT '[]',
  config_snapshot JSONB NOT NULL,
  output          JSONB NOT NULL,
  title_preview   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_histories_user_created ON histories(user_id, created_at DESC);

-- RLS
ALTER TABLE configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own configs" ON configs
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE histories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own histories" ON histories
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Auto-enforce max 10 configs per user
CREATE OR REPLACE FUNCTION check_config_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM configs WHERE user_id = NEW.user_id) >= 10 THEN
    RAISE EXCEPTION 'config_limit_exceeded';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_config_limit
BEFORE INSERT ON configs
FOR EACH ROW EXECUTE FUNCTION check_config_limit();

-- Auto-trim histories to 200 per user
CREATE OR REPLACE FUNCTION trim_user_histories()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM histories
  WHERE user_id = NEW.user_id
    AND id NOT IN (
      SELECT id FROM histories
      WHERE user_id = NEW.user_id
      ORDER BY created_at DESC
      LIMIT 200
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_history_insert
AFTER INSERT ON histories
FOR EACH ROW EXECUTE FUNCTION trim_user_histories();

-- updated_at auto-update for configs
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER configs_updated_at
BEFORE UPDATE ON configs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

**Verify:** In Supabase Table Editor, `configs` and `histories` tables exist with correct columns.

---

### Step 2.2 — TypeScript types

Create `src/types/index.ts`:

```typescript
export interface Config {
  id: string
  user_id: string
  name: string
  is_default: boolean
  target_audience: string | null
  tone_presets: string[]
  tone_custom: string | null
  reference_samples: string[]
  image_style_note: string | null
  forbidden_words: string[]
  created_at: string
  updated_at: string
}

export interface ImageBrief {
  description: string
  scene: string
  composition: string
  lighting: string
  color_tone: string
  props: string
  avoid: string
}

export interface ContentVersion {
  label: string
  title: string
  body: string
  tags: string[]
  image_brief: ImageBrief
}

export interface GenerationOutput {
  version_a: ContentVersion
  version_b: ContentVersion
  version_c: ContentVersion
}

export interface History {
  id: string
  user_id: string
  input_text: string
  input_images: { path: string; name: string }[]
  config_snapshot: Omit<Config, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  output: GenerationOutput
  title_preview: string | null
  created_at: string
}

export const TONE_PRESETS = ['活泼', '专业', '治愈', '种草', '干货'] as const
export type TonePreset = typeof TONE_PRESETS[number]
```

---

## Phase 3 — Config API Routes

### Step 3.1 — Config list + create

Create `src/app/api/configs/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { Config } from '@/types'

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

  // If this is the user's first config, make it default
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
```

### Step 3.2 — Config detail + update + delete

Create `src/app/api/configs/[id]/route.ts`:

```typescript
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

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const config = await getOwnedConfig(supabase, params.id, user.id)
  if (!config) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json(config)
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const existing = await getOwnedConfig(supabase, params.id, user.id)
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
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('configs')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
```

Create `src/app/api/configs/[id]/default/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PUT(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Unset previous default, set new default — two updates
  await supabase
    .from('configs')
    .update({ is_default: false })
    .eq('user_id', user.id)

  const { data, error } = await supabase
    .from('configs')
    .update({ is_default: true })
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

**Verify:** Using `curl` or a REST client:
- `POST /api/configs` with `{"name":"测试账号"}` → 201
- `GET /api/configs` → array with 1 item, `is_default: true`
- `PUT /api/configs/:id` with `{"target_audience":"25-35岁职场人"}` → updated record
- `DELETE /api/configs/:id` → 204

---

## Phase 4 — Config UI

### Step 4.1 — Main layout + nav

Create `src/app/(main)/layout.tsx`:

```typescript
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/LogoutButton'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white px-4 py-3 flex items-center justify-between">
        <Link href="/generate" className="font-semibold text-lg">公众号 → 小红书</Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/history" className="text-gray-600 hover:text-gray-900">历史记录</Link>
          <Link href="/settings/configs" className="text-gray-600 hover:text-gray-900">配置管理</Link>
          <LogoutButton />
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
```

Create `src/components/LogoutButton.tsx`:

```typescript
'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function LogoutButton() {
  const router = useRouter()
  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }
  return <Button variant="ghost" size="sm" onClick={logout}>退出</Button>
}
```

### Step 4.2 — Config form component

Create `src/components/configs/ConfigForm.tsx` — a form with:
- Text input for `name` (required)
- Textarea for `target_audience` (max 500 chars, show counter)
- Checkbox group for `tone_presets` (use `TONE_PRESETS` from types)
- Textarea for `tone_custom` (max 300 chars)
- Dynamic list for `reference_samples` (add/remove up to 5)
- Textarea for `image_style_note`
- Tag input for `forbidden_words` (add/remove)
- Save + Cancel buttons

Props: `defaultValues?: Partial<Config>`, `onSave: (data) => Promise<void>`, `onCancel: () => void`

Use `useState` for all fields. On save, call `onSave` with the form data — the parent page handles the API call.

### Step 4.3 — Config settings page

Create `src/app/(main)/settings/configs/page.tsx`:

- Server component: fetch configs list via Supabase server client
- Display each config as a card with: name, tone presets badges, "设为默认" button (if not default), Edit button, Delete button
- "+ 新建配置" button opens a dialog containing `ConfigForm`
- Edit button opens same dialog pre-filled
- Wire up to `/api/configs` endpoints using `fetch` from client components

### Step 4.4 — Placeholder generate page

Create `src/app/(main)/generate/page.tsx`:

```typescript
export default function GeneratePage() {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-56px)] text-gray-400">
      <p>生成功能即将上线 ✨</p>
    </div>
  )
}
```

**Verify end-to-end:**
1. Register → login → land on generate placeholder
2. Go to `/settings/configs` → create a config → see it in the list
3. Create 2nd config → set it as default → original is no longer default
4. Edit a config → changes persist
5. Delete a config → removed from list

---

## Phase 5 — Ready for Generation (next session)

Once Phase 1–4 pass verification, the next session will implement:

1. `POST /api/generate` — multipart form, Claude streaming, SSE output
2. Supabase Storage bucket `article-images` for image uploads
3. `InputPanel` + `ImageUploader` components
4. `OutputPanel` with three version tabs + image brief
5. `POST /api/histories` + history list page

**Prompt engineering** (already designed in system-design.md) will be extracted into `src/lib/prompt-builder.ts`.

---

## Assumptions (state before coding, ask if wrong)

1. Email confirmation is disabled in Supabase Auth settings (for fast dev iteration — re-enable for production)
2. Supabase project region: any (no latency requirements for MVP)
3. No rate limiting in Phase 1–4 (add in generation phase)
4. `reference_samples` stored as raw text strings (not parsed/validated)
5. Image upload to Supabase Storage deferred to Phase 5
