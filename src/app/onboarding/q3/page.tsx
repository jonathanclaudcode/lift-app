import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WriteQuestionPage } from '@/components/onboarding/write-question-page'
import { QUESTIONS } from '@/lib/onboarding/questions'
import type { OnboardingData } from '@/lib/onboarding/types'

export default async function Q3Page() {
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
  if (!data.q2_social_media) redirect('/onboarding/q2')

  const question = QUESTIONS.find((q) => q.id === 3)
  if (!question || question.type !== 'write') return null

  return (
    <WriteQuestionPage
      question={question}
      aiName={clinic.ai_name}
      questionNumber={3}
      totalQuestions={7}
      initialAnswer={data.q3_clinic_vision}
      saveKey="q3_clinic_vision"
      nextPath="/onboarding/q4"
    />
  )
}
