'use server'

import { createClient } from '@/lib/supabase/server'
import { VALID_STAGES, type PipelineStage } from '@/types/pipeline'

export async function updatePipelineStage(
  customerId: string,
  newStage: PipelineStage
): Promise<{ success: boolean; error?: string }> {
  if (!VALID_STAGES.includes(newStage)) {
    return { success: false, error: 'Ogiltigt pipeline-steg' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Ej autentiserad' }
  }

  const clinicId = user.app_metadata?.clinic_id as string | undefined
  if (!clinicId) {
    return { success: false, error: 'Ej autentiserad' }
  }

  // clinic_id in WHERE is defense-in-depth on top of RLS
  const { data, error } = await supabase
    .from('customers')
    .update({ pipeline_stage: newStage })
    .eq('id', customerId)
    .eq('clinic_id', clinicId)
    .select('id')
    .single()

  if (error || !data) {
    return { success: false, error: 'Kunden hittades inte' }
  }

  return { success: true }
}
