import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { seedDatabase } from '@/lib/supabase/seed'

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Seeding is not allowed in production' },
      { status: 403 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const clinicId = user.app_metadata?.clinic_id
  if (!clinicId) {
    return NextResponse.json(
      { error: 'No clinic associated with user' },
      { status: 400 }
    )
  }

  try {
    await seedDatabase(clinicId)
    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Seeding failed', details: message },
      { status: 500 }
    )
  }
}
