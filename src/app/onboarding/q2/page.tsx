import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClickQuestionPage } from '@/components/onboarding/click-question-page'
import { QUESTIONS } from '@/lib/onboarding/questions'
import type { OnboardingData } from '@/lib/onboarding/types'

export default async function Q2Page() {
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
  if (!data.q1_customer_communication) redirect('/onboarding/q1')

  const question = QUESTIONS.find((q) => q.id === 2)
  if (!question || question.type !== 'click') return null

  return (
    <ClickQuestionPage
      question={question}
      aiName={clinic.ai_name}
      questionNumber={2}
      totalQuestions={7}
      initialAnswer={data.q2_social_media}
      saveKey="q2_social_media"
      nextPath="/onboarding/q3"
    />
  )
}
