import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { AI_MODEL } from '@/lib/ai/client'

export const maxDuration = 300

export async function GET(request: Request) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('CRON_SECRET environment variable is not set')
    return Response.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Calculate yesterday's date in Stockholm timezone
  const now = new Date()
  const yesterdayMs = now.getTime() - 86_400_000
  const yesterday = new Date(yesterdayMs)

  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const dateStr = formatter.format(yesterday)

  const nextDay = new Date(yesterdayMs + 86_400_000)
  const nextDayStr = formatter.format(nextDay)

  const startISO = `${dateStr}T00:00:00${getStockholmOffset(yesterday)}`
  const endISO = `${nextDayStr}T00:00:00${getStockholmOffset(nextDay)}`

  const admin = createAdminClient()

  const { data: clinics, error: clinicsError } = await admin.from('clinics').select('id')

  if (clinicsError || !clinics) {
    console.error('Failed to fetch clinics:', clinicsError)
    return Response.json({ error: 'Failed to fetch clinics' }, { status: 500 })
  }

  const results: Array<{ clinicId: string; status: string }> = []

  for (const clinic of clinics) {
    try {
      const result = await generateDailyMemory(admin, clinic.id, dateStr, startISO, endISO)
      results.push({ clinicId: clinic.id, status: result })
    } catch (err) {
      console.error(`Memory generation failed for clinic ${clinic.id}:`, err)
      results.push({ clinicId: clinic.id, status: 'error' })
    }
  }

  const generated = results.filter((r) => r.status === 'generated').length
  const skipped = results.filter((r) => r.status !== 'generated' && r.status !== 'error').length
  const errors = results.filter((r) => r.status === 'error').length

  console.log(
    `Daily memories [${dateStr}]: ${generated} generated, ${skipped} skipped, ${errors} errors out of ${clinics.length} clinics`
  )

  return Response.json({ processed: clinics.length, generated, skipped, errors, date: dateStr })
}

function getStockholmOffset(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Stockholm',
    timeZoneName: 'longOffset',
  }).formatToParts(date)

  const tzPart = parts.find((p) => p.type === 'timeZoneName')
  if (tzPart) {
    const match = tzPart.value.match(/GMT([+-]\d{2}:\d{2})/)
    if (match) return match[1]
  }
  return '+02:00'
}

async function generateDailyMemory(
  admin: ReturnType<typeof createAdminClient>,
  clinicId: string,
  dateStr: string,
  startISO: string,
  endISO: string
): Promise<string> {
  // 1. Idempotency check
  const { data: existing, error: existingError } = await admin
    .from('ai_memories')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('source_date', dateStr)
    .eq('memory_type', 'daily_summary')
    .maybeSingle()

  if (existingError) {
    console.error(`Idempotency check failed for clinic ${clinicId}:`, existingError)
    return 'error'
  }
  if (existing) return 'already_exists'

  // 2. Fetch messages from that Stockholm day
  const { data: messages, error: messagesError } = await admin
    .from('ai_chat_messages')
    .select('role, content')
    .eq('clinic_id', clinicId)
    .gte('created_at', startISO)
    .lt('created_at', endISO)
    .order('created_at', { ascending: true })

  if (messagesError) {
    console.error(`Messages fetch failed for clinic ${clinicId}:`, messagesError)
    return 'error'
  }
  if (!messages || messages.length < 2) return 'too_few_messages'

  // 3. Format conversation — truncate at message boundary
  let formatted = ''
  for (const m of messages) {
    const line = `${m.role === 'owner' ? 'Ägare' : 'AI'}: ${m.content}\n`
    if (formatted.length + line.length > 8000) break
    formatted += line
  }

  if (formatted.trim().length === 0) return 'too_few_messages'

  // 4. Call Haiku for summarization
  const anthropic = new Anthropic()

  let summaryText: string
  try {
    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 300,
      temperature: 0.3,
      system: `Du sammanfattar konversationer mellan en klinikägare och sin AI-assistent.

REGLER:
- Skriv på svenska, i tredje person ("Ägaren diskuterade...", "Frågade om...")
- Använd BARA ord som "diskuterade", "nämnde", "frågade om", "funderade på", "berättade om"
- Använd ALDRIG "beslutade", "bestämde", "ska", "kommer att", "lovade"
- Om ägaren uttryckte osäkerhet, bevara den: "funderar på", "överväger", "osäker på"
- Om konversationen innehåller KÄNSLIG information (hälsa, relationer, ekonomiska problem, familjekriser), skriv BARA:
  "[PRIVAT] Ägaren delade personligt om [kategori]."
  Inkludera INTE specifika detaljer om känsliga ämnen.
- Max 5 punkter
- Max 15 ord per punkt
- Om inget meningsfullt diskuterades, svara ENBART med det exakta ordet SKIP. Inga punkter, ingen förklaring, absolut ingenting annat än ordet SKIP.`,
      messages: [{ role: 'user', content: formatted }],
    })

    const responseText =
      response.content?.length > 0 && response.content[0]?.type === 'text'
        ? response.content[0].text.trim()
        : null

    if (!responseText || responseText.replace(/\.$/, '').trim() === 'SKIP') return 'skipped'
    summaryText = responseText
  } catch (err) {
    console.error(`Haiku summarization failed for clinic ${clinicId}:`, err)
    return 'error'
  }

  // 5. Detect privacy flag
  const isPrivate = summaryText.includes('[PRIVAT]')

  // 6. Save memory
  const { error: insertError } = await admin.from('ai_memories').insert({
    clinic_id: clinicId,
    content: summaryText,
    memory_type: 'daily_summary',
    source_date: dateStr,
    is_private: isPrivate,
  })

  if (insertError) {
    if (insertError.code === '23505') return 'already_exists'
    console.error(`Memory insert failed for clinic ${clinicId}:`, insertError)
    return 'error'
  }

  return 'generated'
}
