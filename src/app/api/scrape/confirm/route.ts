import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ScrapedTreatment, ScrapedStaff } from '@/lib/scraping/scrape-clinic'

export const maxDuration = 30

interface ConfirmBody {
  clinicId: string
  sourceUrl: string
  confirmed: {
    treatments: ScrapedTreatment[]
    staff: ScrapedStaff[]
    opening_hours: string | null
    policies: {
      cancellation: string | null
      consultation: string | null
      payment: string | null
    } | null
    booking_url: string | null
  }
}

function formatPrice(amount: number): string {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function formatTreatmentContent(t: ScrapedTreatment): string {
  let s = t.name
  if (t.category) s = `[${t.category}] ${s}`
  if (t.price_sek !== null) {
    const prefix =
      t.price_type === 'from'
        ? 'från '
        : t.price_type === 'consultation'
          ? 'konsultation '
          : ''
    s += `: ${prefix}${formatPrice(t.price_sek)} kr`
  }
  if (t.price_note) s += ` (${t.price_note})`
  if (t.duration_minutes !== null && t.duration_minutes > 0) s += ` — ${t.duration_minutes} min`
  if (t.description) s += `. ${t.description.slice(0, 150)}`
  return s.slice(0, 500)
}

export async function POST(request: Request) {
  let body: ConfirmBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Ogiltig förfrågan.' }, { status: 400 })
  }

  const { clinicId, sourceUrl, confirmed } = body
  if (!clinicId || !sourceUrl || !confirmed || typeof confirmed !== 'object') {
    return Response.json({ error: 'Saknade fält.' }, { status: 400 })
  }

  // Auth + ownership via RLS
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .select('id, last_scanned_at')
    .eq('id', clinicId)
    .maybeSingle()

  if (clinicError || !clinic) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Rate limit: 24h since last confirmed save
  if (clinic.last_scanned_at) {
    const msSince = Date.now() - new Date(clinic.last_scanned_at).getTime()
    if (msSince < 24 * 60 * 60 * 1000) {
      return Response.json(
        {
          error: 'Du kan bara uppdatera klinikdata en gång per dygn.',
          next_available: new Date(
            new Date(clinic.last_scanned_at).getTime() + 86_400_000
          ).toISOString(),
        },
        { status: 429 }
      )
    }
  }

  // Validate confirmed data
  const treatments = Array.isArray(confirmed.treatments) ? confirmed.treatments : []
  const staff = Array.isArray(confirmed.staff) ? confirmed.staff : []

  const validTreatments = treatments
    .filter(
      (t): t is ScrapedTreatment =>
        typeof t?.name === 'string' && t.name.trim().length > 0
    )
    .slice(0, 150)

  const validStaff = staff
    .filter(
      (s): s is ScrapedStaff =>
        typeof s?.name === 'string' && s.name.trim().length > 0
    )
    .slice(0, 30)

  // Build rows
  const rows: Array<Record<string, unknown>> = []

  for (const t of validTreatments) {
    rows.push({
      clinic_id: clinicId,
      category: 'treatment',
      content: formatTreatmentContent(t),
      source: 'website_scrape',
      source_url: sourceUrl,
      confidence: t.confidence || 'medium',
      is_active: true,
    })
  }

  for (const s of validStaff) {
    rows.push({
      clinic_id: clinicId,
      category: 'staff',
      content: `${s.name}${s.role ? ', ' + s.role : ''}`.slice(0, 200),
      source: 'website_scrape',
      source_url: sourceUrl,
      confidence: s.confidence || 'medium',
      is_active: true,
    })
  }

  if (confirmed.opening_hours && typeof confirmed.opening_hours === 'string') {
    rows.push({
      clinic_id: clinicId,
      category: 'hours',
      content: confirmed.opening_hours.slice(0, 500),
      source: 'website_scrape',
      source_url: sourceUrl,
      is_active: true,
    })
  }

  if (confirmed.policies) {
    const p = confirmed.policies
    if (p.cancellation) {
      rows.push({
        clinic_id: clinicId,
        category: 'policy',
        content: ('Avbokning: ' + p.cancellation).slice(0, 500),
        source: 'website_scrape',
        source_url: sourceUrl,
        is_active: true,
      })
    }
    if (p.consultation) {
      rows.push({
        clinic_id: clinicId,
        category: 'policy',
        content: ('Konsultation: ' + p.consultation).slice(0, 500),
        source: 'website_scrape',
        source_url: sourceUrl,
        is_active: true,
      })
    }
    if (p.payment) {
      rows.push({
        clinic_id: clinicId,
        category: 'policy',
        content: ('Betalning: ' + p.payment).slice(0, 500),
        source: 'website_scrape',
        source_url: sourceUrl,
        is_active: true,
      })
    }
  }

  if (confirmed.booking_url && typeof confirmed.booking_url === 'string') {
    rows.push({
      clinic_id: clinicId,
      category: 'booking',
      content: confirmed.booking_url.slice(0, 500),
      source: 'website_scrape',
      source_url: sourceUrl,
      is_active: true,
    })
  }

  if (rows.length === 0) {
    return Response.json({ success: true, saved: { treatments: 0, staff: 0 } })
  }

  const admin = createAdminClient()

  // Insert new rows first (data safety — if this fails, old data remains)
  const { error: insertError } = await admin.from('clinic_knowledge').insert(rows)

  if (insertError) {
    console.error('Insert failed:', insertError)
    return Response.json({ error: 'Kunde inte spara data. Försök igen.' }, { status: 500 })
  }

  // Delete OLD website_scrape rows (created before this batch)
  const cutoff = new Date(Date.now() - 60_000).toISOString()
  const { error: deleteError } = await admin
    .from('clinic_knowledge')
    .delete()
    .eq('clinic_id', clinicId)
    .eq('source', 'website_scrape')
    .lt('created_at', cutoff)

  if (deleteError) {
    console.error('Delete old rows failed (non-critical):', deleteError)
  }

  // Update clinic metadata
  const { error: updateError } = await admin
    .from('clinics')
    .update({
      last_scanned_at: new Date().toISOString(),
      website: sourceUrl,
    })
    .eq('id', clinicId)

  if (updateError) console.error('Clinic metadata update failed:', updateError)

  return Response.json({
    success: true,
    saved: {
      treatments: validTreatments.length,
      staff: validStaff.length,
      has_hours: !!confirmed.opening_hours,
      policies: [
        confirmed.policies?.cancellation,
        confirmed.policies?.consultation,
        confirmed.policies?.payment,
      ].filter(Boolean).length,
    },
  })
}
