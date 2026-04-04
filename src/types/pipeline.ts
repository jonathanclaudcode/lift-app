export type PipelineStage =
  | 'new'
  | 'consultation_booked'
  | 'treated'
  | 'follow_up_due'
  | 'loyal'

export const PIPELINE_STAGES = [
  { key: 'new', label: 'Ny kund', borderColor: 'border-l-blue-400', bgHover: 'bg-blue-50' },
  { key: 'consultation_booked', label: 'Konsultation bokad', borderColor: 'border-l-amber-400', bgHover: 'bg-amber-50' },
  { key: 'treated', label: 'Behandlad', borderColor: 'border-l-emerald-400', bgHover: 'bg-emerald-50' },
  { key: 'follow_up_due', label: 'Uppföljning', borderColor: 'border-l-violet-400', bgHover: 'bg-violet-50' },
  { key: 'loyal', label: 'Stamkund', borderColor: 'border-l-rose-400', bgHover: 'bg-rose-50' },
] as const satisfies readonly { key: PipelineStage; label: string; borderColor: string; bgHover: string }[]

export const VALID_STAGES: readonly PipelineStage[] = PIPELINE_STAGES.map((s) => s.key)

export interface PipelineCustomer {
  id: string
  display_name: string
  pipeline_stage: PipelineStage
  latest_treatment: string | null
  last_contacted_at: string | null
}

// Static mapping for Tailwind purge safety — never interpolate dynamically
export const STAGE_BORDER_COLOR: Record<PipelineStage, string> = {
  new: 'border-l-blue-400',
  consultation_booked: 'border-l-amber-400',
  treated: 'border-l-emerald-400',
  follow_up_due: 'border-l-violet-400',
  loyal: 'border-l-rose-400',
}

export const STAGE_BG_HOVER: Record<PipelineStage, string> = {
  new: 'bg-blue-50',
  consultation_booked: 'bg-amber-50',
  treated: 'bg-emerald-50',
  follow_up_due: 'bg-violet-50',
  loyal: 'bg-rose-50',
}
