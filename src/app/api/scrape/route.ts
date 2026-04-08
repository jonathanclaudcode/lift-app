import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scrapeClinic, normalizeClinicUrl } from '@/lib/scraping/scrape-clinic'

export const maxDuration = 120

export async function POST(request: Request) {
  let body: { url?: string; clinicId?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Ogiltig förfrågan.' }, { status: 400 })
  }

  const { url, clinicId } = body
  if (!url || typeof url !== 'string' || !clinicId || typeof clinicId !== 'string') {
    return Response.json({ error: 'URL och klinik-ID krävs.' }, { status: 400 })
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
    .select('id')
    .eq('id', clinicId)
    .maybeSingle()

  if (clinicError || !clinic) {
    return Response.json(
      { error: 'Kliniken hittades inte eller du saknar behörighet.' },
      { status: 403 }
    )
  }

  // Validate URL
  let normalizedUrl: string
  try {
    normalizedUrl = normalizeClinicUrl(url)
  } catch {
    return Response.json({ error: 'Ogiltig URL.' }, { status: 400 })
  }

  // Scrape
  const result = await scrapeClinic(normalizedUrl)

  if (!result.success) {
    return Response.json({ error: result.error || 'Scraping misslyckades.' }, { status: 422 })
  }

  // Cache in background (non-critical)
  after(async () => {
    try {
      const admin = createAdminClient()
      const { error } = await admin.from('scrape_cache').upsert(
        {
          clinic_id: clinicId,
          url: normalizedUrl,
          markdown_content: result.raw_markdown,
          pages_scraped: result.pages_scraped,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: 'clinic_id' }
      )
      if (error) console.error('Cache write failed (non-critical):', error)
    } catch (err) {
      console.error('Background cache error:', err)
    }
  })

  return Response.json({
    success: true,
    data: result.data,
    pages_scraped: result.pages_scraped,
    urls_scraped: result.urls_scraped,
  })
}
