import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DomainForm } from '@/components/onboarding/domain-form'
import type { OnboardingData } from '@/lib/onboarding/types'

export default async function DomainPage() {
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

  const data = (clinic.onboarding_data ?? {}) as OnboardingData
  const initialDomain = data.website_domain || ''

  return <DomainForm aiName={clinic.ai_name} initialDomain={initialDomain} />
}
