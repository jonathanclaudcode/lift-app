import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClickQuestionPage } from '@/components/onboarding/click-question-page'
import { QUESTIONS } from '@/lib/onboarding/questions'
import type { OnboardingData } from '@/lib/onboarding/types'

export default async function Q1Page() {
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
  if (!data.website_domain) redirect('/onboarding/domain')

  const question = QUESTIONS.find((q) => q.id === 1)
  if (!question || question.type !== 'click') return null

  return (
    <ClickQuestionPage
      question={question}
      aiName={clinic.ai_name}
      questionNumber={1}
      totalQuestions={7}
      initialAnswer={data.q1_customer_communication}
      saveKey="q1_customer_communication"
      nextPath="/onboarding/q2"
    />
  )
}
