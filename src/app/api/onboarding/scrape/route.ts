import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scrapeClinic, normalizeClinicUrl } from '@/lib/scraping/scrape-clinic'

export const maxDuration = 120

export async function POST(request: Request) {
  // Verify shared secret — this endpoint is excluded from middleware auth
  // but must NOT be publicly callable. Only internal server-to-server calls
  // from server actions are allowed.
  const providedSecret = request.headers.get('x-internal-secret')
  const expectedSecret = process.env.ONBOARDING_INTERNAL_SECRET

  if (!expectedSecret) {
    console.error('[Onboarding Scrape] ONBOARDING_INTERNAL_SECRET not configured')
    return Response.json({ error: 'Server configuration error' }, { status: 500 })
  }

  if (providedSecret !== expectedSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { clinicId?: string; domain?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { clinicId, domain } = body
  if (!clinicId || !domain) {
    return Response.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Return 200 immediately. All scraping happens inside after().
  after(async () => {
    const admin = createAdminClient()

    try {
      // Mark as in_progress
      await admin
        .from('clinics')
        .update({ scraping_status: 'in_progress' })
        .eq('id', clinicId)

      // Normalize URL
      let url: string
      try {
        url = normalizeClinicUrl(domain)
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Invalid URL'
        await admin
          .from('clinics')
          .update({
            scraping_status: 'failed',
            scraping_error: errMsg,
            scraping_completed_at: new Date().toISOString(),
          })
          .eq('id', clinicId)
        return
      }

      // Run scraping pipeline
      const result = await scrapeClinic(url)

      if (!result.success) {
        await admin
          .from('clinics')
          .update({
            scraping_status: 'failed',
            scraping_error: result.error || 'Scraping failed',
            scraping_completed_at: new Date().toISOString(),
          })
          .eq('id', clinicId)
        return
      }

      // Save success result
      await admin
        .from('clinics')
        .update({
          scraping_status: 'success',
          scraping_result: {
            data: result.data,
            url,
            pages_scraped: result.pages_scraped,
            urls_scraped: result.urls_scraped,
          },
          scraping_completed_at: new Date().toISOString(),
        })
        .eq('id', clinicId)

      console.log(`[Onboarding Scrape] Success for clinic ${clinicId}: ${result.pages_scraped} pages`)
    } catch (err) {
      console.error('[Onboarding Scrape] Background error:', err)
      try {
        await admin
          .from('clinics')
          .update({
            scraping_status: 'failed',
            scraping_error: err instanceof Error ? err.message : 'Unknown error',
            scraping_completed_at: new Date().toISOString(),
          })
          .eq('id', clinicId)
      } catch (updateErr) {
        console.error('[Onboarding Scrape] Failed to mark as failed:', updateErr)
      }
    }
  })

  return Response.json({ status: 'ok' }, { status: 200 })
}
