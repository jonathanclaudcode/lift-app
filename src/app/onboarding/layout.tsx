import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Välkommen till LIFT' }

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const clinicId = user.app_metadata?.clinic_id as string | undefined
  if (!clinicId) redirect('/login')

  // Already onboarded → kick out to dashboard
  const { data: clinic } = await supabase
    .from('clinics')
    .select('onboarded_at')
    .eq('id', clinicId)
    .single()

  if (clinic?.onboarded_at) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-dvh bg-background flex items-start justify-center py-6 px-4">
      <div className="w-full max-w-[500px]">
        {children}
      </div>
    </div>
  )
}
