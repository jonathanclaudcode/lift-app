import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WelcomeForm } from '@/components/onboarding/welcome-form'

export default async function WelcomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clinicId = user.app_metadata?.clinic_id as string
  const { data: clinic } = await supabase
    .from('clinics')
    .select('ai_name')
    .eq('id', clinicId)
    .single()

  return <WelcomeForm initialName={clinic?.ai_name || ''} />
}
