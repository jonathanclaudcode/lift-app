'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { updatePipelineStage } from '@/actions/update-pipeline-stage'
import type { PipelineCustomer, PipelineStage } from '@/types/pipeline'

async function fetchPipelineCustomers(clinicId: string): Promise<PipelineCustomer[]> {
  const supabase = createClient()

  // Fetch customers with latest booking and latest conversation contact
  // Using approach B: Supabase relation with ordering, take first result
  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, name, pipeline_stage, bookings(treatment, starts_at), conversations(last_message_at)')
    .eq('clinic_id', clinicId)
    .order('starts_at', { referencedTable: 'bookings', ascending: false })
    .order('last_message_at', { referencedTable: 'conversations', ascending: false, nullsFirst: false })
    .limit(1000)

  if (error) throw error

  return (customers ?? []).map((c: Record<string, unknown>) => ({
    id: c.id,
    display_name: c.name || 'Okänd kund',
    pipeline_stage: (c.pipeline_stage ?? 'new') as PipelineStage,
    latest_treatment: (c.bookings as { treatment: string; starts_at: string }[])?.[0]?.treatment ?? null,
    last_contacted_at: (c.conversations as { last_message_at: string | null }[])?.[0]?.last_message_at ?? null,
  }))
}

export { fetchPipelineCustomers }

export function usePipelineCustomers(clinicId: string, initialCustomers: PipelineCustomer[]) {
  return useQuery({
    queryKey: ['pipeline-customers', clinicId],
    queryFn: () => fetchPipelineCustomers(clinicId),
    initialData: initialCustomers,
    staleTime: 60_000,
  })
}

export function useUpdatePipelineStage(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ customerId, newStage }: { customerId: string; newStage: PipelineStage }) => {
      const result = await updatePipelineStage(customerId, newStage)
      if (!result.success) {
        throw new Error(result.error)
      }
      return result
    },
    onMutate: async ({ customerId, newStage }) => {
      await queryClient.cancelQueries({ queryKey: ['pipeline-customers', clinicId] })
      const previous = queryClient.getQueryData<PipelineCustomer[]>(['pipeline-customers', clinicId])
      queryClient.setQueryData<PipelineCustomer[]>(
        ['pipeline-customers', clinicId],
        (old) => old?.map((c) => (c.id === customerId ? { ...c, pipeline_stage: newStage } : c)) ?? []
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['pipeline-customers', clinicId], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-customers', clinicId] })
    },
  })
}
