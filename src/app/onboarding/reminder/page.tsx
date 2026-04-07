import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ReminderScreen } from '@/components/onboarding/reminder-screen'
import type { OnboardingData } from '@/lib/onboarding/types'

export default async function ReminderPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clinicId = user.app_metadata?.clinic_id as string
  const { data: clinic } = await supabase
    .from('clinics')
    .select('ai_name, onboarding_data')
    .eq('id', clinicId)
    .single()

  if (!clinic?.ai_name) redirect('/onboarding/welcome')

  // Step protection: must have entered domain
  const data = (clinic.onboarding_data ?? {}) as OnboardingData
  if (!data.website_domain) redirect('/onboarding/domain')

  return <ReminderScreen aiName={clinic.ai_name} />
}
