import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PipelineBoard } from '@/components/pipeline/pipeline-board'
import type { PipelineCustomer, PipelineStage } from '@/types/pipeline'

export default async function PipelinePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const clinicId = user.app_metadata?.clinic_id as string | undefined
  if (!clinicId) redirect('/login')

  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, pipeline_stage, bookings(treatment, starts_at), conversations(last_message_at)')
    .eq('clinic_id', clinicId)
    .order('starts_at', { referencedTable: 'bookings', ascending: false })
    .order('last_message_at', { referencedTable: 'conversations', ascending: false, nullsFirst: false })
    .limit(1000)

  const initialCustomers: PipelineCustomer[] = (customers ?? []).map((c) => ({
    id: c.id,
    display_name: c.name || 'Okänd kund',
    pipeline_stage: (c.pipeline_stage ?? 'new') as PipelineStage,
    latest_treatment: (c.bookings as { treatment: string; starts_at: string }[])?.[0]?.treatment ?? null,
    last_contacted_at: (c.conversations as { last_message_at: string | null }[])?.[0]?.last_message_at ?? null,
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Pipeline</h1>
      <PipelineBoard clinicId={clinicId} initialCustomers={initialCustomers} />
    </div>
  )
}
