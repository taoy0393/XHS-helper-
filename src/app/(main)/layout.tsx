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
