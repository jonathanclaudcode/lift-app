import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare, Send, Bell, Users } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// --- Types ---

interface DashboardKPIs {
  activeConversations: number | null
  messagesThisMonth: number | null
  unreadMessages: number | null
  totalCustomers: number | null
}

// --- Helpers ---

function formatKPI(value: number | null): string {
  if (value === null) return '—'
  return value.toLocaleString('sv-SE')
}

/**
 * Midnight of the 1st of the current month in Europe/Stockholm, as UTC ISO string.
 * Sweden follows EU DST: CEST (UTC+2) last Sunday of March → last Sunday of October,
 * CET (UTC+1) the rest. Since we only need the 1st of each month, the offset is
 * deterministic by month index (0-indexed):
 *   Jan(0)–Feb(1)–Mar(2) → +01:00, Apr(3)–Oct(9) → +02:00, Nov(10)–Dec(11) → +01:00
 *
 * CET example:  Jan 1 2026 00:00 Stockholm = 2025-12-31T23:00:00.000Z
 * CEST example: Apr 1 2026 00:00 Stockholm = 2026-03-31T22:00:00.000Z
 */
function getStartOfMonthStockholmUTC(): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(now)
  const year = Number(parts.find((p) => p.type === 'year')!.value)
  const month = Number(parts.find((p) => p.type === 'month')!.value) - 1 // 0-indexed

  const offset = month >= 3 && month <= 9 ? '+02:00' : '+01:00'
  const monthStr = String(month + 1).padStart(2, '0')
  return new Date(`${year}-${monthStr}-01T00:00:00${offset}`).toISOString()
}

// --- Per-KPI fetchers (throw on failure) ---

async function fetchActiveConversations(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
  if (error) throw error
  return count ?? 0
}

async function fetchMessagesThisMonth(supabase: SupabaseClient): Promise<number> {
  const startOfMonth = getStartOfMonthStockholmUTC()
  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfMonth)
  if (error) throw error
  return count ?? 0
}

async function fetchUnreadMessages(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.from('conversations').select('unread_count')
  if (error) throw error
  return (data ?? []).reduce((sum, row) => sum + (Number(row.unread_count) || 0), 0)
}

async function fetchTotalCustomers(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

// --- Orchestrator ---

async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const supabase = await createClient()

  const [convResult, msgResult, unreadResult, custResult] = await Promise.allSettled([
    fetchActiveConversations(supabase),
    fetchMessagesThisMonth(supabase),
    fetchUnreadMessages(supabase),
    fetchTotalCustomers(supabase),
  ])

  if (convResult.status === 'rejected') {
    console.error('[dashboard] Failed to fetch activeConversations', convResult.reason)
  }
  if (msgResult.status === 'rejected') {
    console.error('[dashboard] Failed to fetch messagesThisMonth', msgResult.reason)
  }
  if (unreadResult.status === 'rejected') {
    console.error('[dashboard] Failed to fetch unreadMessages', unreadResult.reason)
  }
  if (custResult.status === 'rejected') {
    console.error('[dashboard] Failed to fetch totalCustomers', custResult.reason)
  }

  return {
    activeConversations: convResult.status === 'fulfilled' ? convResult.value : null,
    messagesThisMonth: msgResult.status === 'fulfilled' ? msgResult.value : null,
    unreadMessages: unreadResult.status === 'fulfilled' ? unreadResult.value : null,
    totalCustomers: custResult.status === 'fulfilled' ? custResult.value : null,
  }
}

// --- Page ---

const currentMonth = new Date().toLocaleDateString('sv-SE', {
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Stockholm',
})

export default async function DashboardPage() {
  const kpis = await getDashboardKPIs()

  const cards = [
    {
      icon: MessageSquare,
      iconColor: 'text-blue-500',
      title: 'Aktiva konversationer',
      value: formatKPI(kpis.activeConversations),
      description: 'just nu',
    },
    {
      icon: Send,
      iconColor: 'text-green-500',
      title: 'Meddelanden denna månad',
      value: formatKPI(kpis.messagesThisMonth),
      description: currentMonth,
    },
    {
      icon: Bell,
      iconColor: 'text-yellow-500',
      title: 'Olästa meddelanden',
      value: formatKPI(kpis.unreadMessages),
      description: 'att hantera',
    },
    {
      icon: Users,
      iconColor: 'text-purple-500',
      title: 'Kunder totalt',
      value: formatKPI(kpis.totalCustomers),
      description: 'i databasen',
    },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold">Välkommen till LIFT</h1>
      <p className="text-muted-foreground">
        Här är en översikt av din AI-assistents aktivitet
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.iconColor}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
