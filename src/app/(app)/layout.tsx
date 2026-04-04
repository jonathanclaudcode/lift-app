import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const clinicId = user.app_metadata?.clinic_id as string | undefined
    if (!clinicId) redirect('/login')

    const { data: clinic } = await supabase
      .from('clinics')
      .select('name')
      .eq('id', clinicId)
      .single()

    if (!clinic) redirect('/login')

    return (
      <div className="flex h-dvh">
        <Sidebar clinicName={clinic.name} />
        <main className="flex-1 md:ml-64 pb-20 md:pb-0 overflow-auto">
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    )
  } catch {
    redirect('/login')
  }
}
