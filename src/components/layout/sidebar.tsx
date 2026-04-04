'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  MessageSquare,
  Kanban,
  Bot,
  Settings,
  LogOut,
} from 'lucide-react'

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Konversationer', href: '/conversations', icon: MessageSquare },
  { label: 'Pipeline', href: '/pipeline', icon: Kanban },
  { label: 'AI Assistent', href: '/assistant', icon: Bot },
  { label: 'Inställningar', href: '/settings', icon: Settings },
]

export function Sidebar({ clinicName }: { clinicName: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch {
      // Ignore sign-out errors
    }
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 w-64 h-full border-r flex-col bg-background z-40">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold">LIFT</h1>
          <p className="text-sm text-muted-foreground truncate">{clinicName}</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Logga ut
          </button>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav
        className="flex md:hidden fixed bottom-0 left-0 w-full border-t bg-background z-50 justify-around"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0.5rem)' }}
      >
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 p-2 ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
            </Link>
          )
        })}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 p-2 text-muted-foreground"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-xs">Logga ut</span>
        </button>
      </nav>
    </>
  )
}
