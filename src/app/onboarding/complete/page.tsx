import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CompleteScreen } from '@/components/onboarding/complete-screen'
import type { OnboardingData } from '@/lib/onboarding/types'

export default async function CompletePage() {
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

  // Step protection: must have completed q7
  const data = (clinic.onboarding_data ?? {}) as OnboardingData
  if (!data.q7_ai_character) redirect('/onboarding/q7')

  return <CompleteScreen aiName={clinic.ai_name} />
}
