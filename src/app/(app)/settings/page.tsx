import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsForm } from '@/components/settings/settings-form'

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const clinicId = user.app_metadata?.clinic_id as string | undefined
  if (!clinicId) redirect('/login')

  const { data: clinic } = await supabase
    .from('clinics')
    .select('id, name, phone, address, website, logo_url')
    .eq('id', clinicId)
    .single()

  if (!clinic) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-muted-foreground">
        <p className="text-lg">Ingen klinik hittades. Kontakta support.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Inställningar</h1>
      <SettingsForm clinic={clinic} />
    </div>
  )
}
