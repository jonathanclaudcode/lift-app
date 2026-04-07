import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WriteQuestionPage } from '@/components/onboarding/write-question-page'
import { QUESTIONS } from '@/lib/onboarding/questions'
import type { OnboardingData } from '@/lib/onboarding/types'

export default async function Q6Page() {
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
  if (!data.q5_cancellations) redirect('/onboarding/q5')

  const question = QUESTIONS.find((q) => q.id === 6)
  if (!question || question.type !== 'write') return null

  return (
    <WriteQuestionPage
      question={question}
      aiName={clinic.ai_name}
      questionNumber={6}
      totalQuestions={7}
      initialAnswer={data.q6_typical_day}
      saveKey="q6_typical_day"
      nextPath="/onboarding/q7"
    />
  )
}
