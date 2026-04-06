-- ============================================================
-- MIGRATION 006: AI Memories (nightly summaries)
-- ============================================================

CREATE TABLE public.ai_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  memory_type TEXT NOT NULL DEFAULT 'daily_summary'
    CHECK (memory_type IN ('daily_summary', 'weekly_summary', 'manual')),
  source_date DATE NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for "fetch latest N memories" — sorted by source_date for correct chronological order
CREATE INDEX idx_ai_memories_clinic_source
  ON public.ai_memories(clinic_id, source_date DESC);

-- Idempotency: one summary per clinic per date per memory_type
CREATE UNIQUE INDEX idx_ai_memories_unique_daily
  ON public.ai_memories(clinic_id, source_date, memory_type);

ALTER TABLE public.ai_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_memories_select"
  ON public.ai_memories FOR SELECT TO authenticated
  USING (clinic_id = (SELECT public.get_clinic_id()));

CREATE POLICY "ai_memories_insert"
  ON public.ai_memories FOR INSERT TO authenticated
  WITH CHECK (clinic_id = (SELECT public.get_clinic_id()));

CREATE POLICY "ai_memories_update"
  ON public.ai_memories FOR UPDATE TO authenticated
  USING (clinic_id = (SELECT public.get_clinic_id()))
  WITH CHECK (clinic_id = (SELECT public.get_clinic_id()));

CREATE POLICY "ai_memories_delete"
  ON public.ai_memories FOR DELETE TO authenticated
  USING (clinic_id = (SELECT public.get_clinic_id()));
