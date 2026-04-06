-- ============================================================
-- MIGRATION 008: AI Tasks (reminders)
-- ============================================================

CREATE TABLE public.ai_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  description TEXT NOT NULL CHECK (length(btrim(description)) > 0),
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'dismissed')),
  source_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_tasks_clinic_pending
  ON public.ai_tasks(clinic_id, due_date)
  WHERE status = 'pending';

ALTER TABLE public.ai_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_tasks_select" ON public.ai_tasks
  FOR SELECT TO authenticated USING (clinic_id = (SELECT public.get_clinic_id()));
CREATE POLICY "ai_tasks_insert" ON public.ai_tasks
  FOR INSERT TO authenticated WITH CHECK (clinic_id = (SELECT public.get_clinic_id()));
CREATE POLICY "ai_tasks_update" ON public.ai_tasks
  FOR UPDATE TO authenticated
  USING (clinic_id = (SELECT public.get_clinic_id()))
  WITH CHECK (clinic_id = (SELECT public.get_clinic_id()));
CREATE POLICY "ai_tasks_delete" ON public.ai_tasks
  FOR DELETE TO authenticated
  USING (clinic_id = (SELECT public.get_clinic_id()));
