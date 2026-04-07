import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ReviewPage } from '@/components/onboarding/review-page'
import type { OnboardingData } from '@/lib/onboarding/types'

export default async function ScrapeReviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clinicId = user.app_metadata?.clinic_id as string
  const { data: clinic } = await supabase
    .from('clinics')
    .select('ai_name, scraping_status, scraping_result, scraping_error, onboarding_data')
    .eq('id', clinicId)
    .single()

  if (!clinic?.ai_name) redirect('/onboarding/welcome')

  const data = (clinic.onboarding_data ?? {}) as OnboardingData
  if (!data.q7_ai_character) redirect('/onboarding/q7')

  return (
    <ReviewPage
      clinicId={clinicId}
      aiName={clinic.ai_name}
      initialStatus={
        clinic.scraping_status as 'pending' | 'in_progress' | 'success' | 'failed' | null
      }
      initialResult={clinic.scraping_result}
      initialError={clinic.scraping_error}
    />
  )
}
