import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('CRON_SECRET is not set')
    return Response.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: clinics, error: clinicsError } = await admin
    .from('preference_engine')
    .select('clinic_id')

  if (clinicsError || !clinics) {
    console.error('Failed to fetch clinics for decay:', clinicsError)
    return Response.json({ error: 'Failed' }, { status: 500 })
  }

  let decayed = 0
  let skipped = 0
  let errors = 0

  for (const clinic of clinics) {
    const { data: result, error: decayError } = await admin.rpc('apply_preference_decay', {
      p_clinic_id: clinic.clinic_id,
      p_decay_factor: 0.995,
      p_minimum: 2.0,
    })

    if (decayError) {
      errors++
      console.error(`Decay failed ${clinic.clinic_id}:`, decayError)
    } else if (result) {
      decayed++
    } else {
      skipped++
    }
  }

  console.log(`Daily decay: ${decayed} decayed, ${skipped} skipped, ${errors} errors`)
  return Response.json({ decayed, skipped, errors })
}
