import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CharacterQuestionPage } from '@/components/onboarding/character-question-page'
import type { OnboardingData } from '@/lib/onboarding/types'

export default async function Q7Page() {
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
  if (!data.q6_typical_day?.main_text) redirect('/onboarding/q6')

  return (
    <CharacterQuestionPage
      aiName={clinic.ai_name}
      questionNumber={7}
      totalQuestions={7}
      initialAnswer={data.q7_ai_character}
      nextPath="/onboarding/review"
    />
  )
}
