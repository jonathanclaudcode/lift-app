import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function generateSlug(email: string): string {
  const prefix = email.split('@')[0] || 'clinic'
  const base = prefix.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let suffix = ''
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)]
  }
  return `${base}-${suffix}`
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session?.user) {
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
  }

  const user = data.session.user

  // Returning user — already has a clinic
  if (user.app_metadata?.clinic_id) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // First-time login — create clinic
  const supabaseAdmin = createAdminClient()
  let newClinicId: string | null = null

  try {
    // Insert clinic with slug collision retry
    let clinic = null
    for (let attempt = 0; attempt < 3; attempt++) {
      const slug = generateSlug(user.email || 'clinic')
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('clinics')
        .insert({ name: user.email || 'Min klinik', slug })
        .select('id')
        .single()

      if (!insertError && inserted) {
        clinic = inserted
        break
      }
      // If not a unique violation, throw
      if (insertError && !insertError.message.includes('duplicate')) {
        throw insertError
      }
    }

    if (!clinic) {
      throw new Error('Failed to create clinic after 3 attempts')
    }

    newClinicId = clinic.id

    // Create clinic membership
    await supabaseAdmin.from('clinic_members').insert({
      clinic_id: clinic.id,
      user_id: user.id,
      role: 'owner',
    })

    // Set clinic_id in app_metadata
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      app_metadata: { clinic_id: clinic.id },
    })

    // Refresh session to pick up new JWT claims
    const { data: refreshData } = await supabase.auth.refreshSession()
    if (!refreshData.session?.user.app_metadata?.clinic_id) {
      // Wait and retry once
      await new Promise((resolve) => setTimeout(resolve, 500))
      const { data: retryData } = await supabase.auth.refreshSession()
      if (!retryData.session?.user.app_metadata?.clinic_id) {
        return NextResponse.redirect(new URL('/login?error=setup_failed', request.url))
      }
    }

    return NextResponse.redirect(new URL('/dashboard', request.url))
  } catch {
    // Cleanup if clinic was partially created
    if (newClinicId) {
      await supabaseAdmin.from('clinic_members').delete().eq('clinic_id', newClinicId)
      await supabaseAdmin.from('clinics').delete().eq('id', newClinicId)
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        app_metadata: { clinic_id: null },
      })
    }
    return NextResponse.redirect(new URL('/login?error=setup_failed', request.url))
  }
}
