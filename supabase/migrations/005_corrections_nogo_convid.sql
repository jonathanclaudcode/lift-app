-- ============================================================
-- MIGRATION 005: Corrections, No-Go Zones, Conversation ID
-- ============================================================

-- 1. Add conversation_id to ai_chat_messages (nullable — old messages will have NULL)
--    NOTE: All code that reads conversation_id MUST handle NULL values.
--    Messages created before this migration will not have a conversation_id.
ALTER TABLE public.ai_chat_messages
  ADD COLUMN IF NOT EXISTS conversation_id UUID;

-- Index for "find latest message" query pattern: .eq('clinic_id', X).order('created_at', desc).limit(1)
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_clinic_created
  ON public.ai_chat_messages(clinic_id, created_at DESC);

-- Index for "load conversation" query pattern: .eq('clinic_id', X).eq('conversation_id', Y).order('created_at')
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_conversation
  ON public.ai_chat_messages(clinic_id, conversation_id, created_at)
  WHERE conversation_id IS NOT NULL;

-- 2. Corrections table
CREATE TABLE public.ai_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  correction_text TEXT NOT NULL,
  interpreted_rule TEXT NOT NULL,
  forbidden_phrase TEXT,
  preference_key TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index for duplicate prevention (case-insensitive on forbidden_phrase)
CREATE UNIQUE INDEX IF NOT EXISTS idx_corrections_unique_phrase
  ON public.ai_corrections(clinic_id, lower(forbidden_phrase))
  WHERE is_active = true AND forbidden_phrase IS NOT NULL;

-- For corrections without a forbidden_phrase, deduplicate on interpreted_rule
CREATE UNIQUE INDEX IF NOT EXISTS idx_corrections_unique_rule
  ON public.ai_corrections(clinic_id, lower(interpreted_rule))
  WHERE is_active = true AND forbidden_phrase IS NULL;

CREATE INDEX IF NOT EXISTS idx_corrections_active
  ON public.ai_corrections(clinic_id)
  WHERE is_active = true;

ALTER TABLE public.ai_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_corrections_select"
  ON public.ai_corrections FOR SELECT TO authenticated
  USING (clinic_id = (SELECT public.get_clinic_id()));

CREATE POLICY "ai_corrections_insert"
  ON public.ai_corrections FOR INSERT TO authenticated
  WITH CHECK (clinic_id = (SELECT public.get_clinic_id()));

CREATE POLICY "ai_corrections_update"
  ON public.ai_corrections FOR UPDATE TO authenticated
  USING (clinic_id = (SELECT public.get_clinic_id()))
  WITH CHECK (clinic_id = (SELECT public.get_clinic_id()));

CREATE POLICY "ai_corrections_delete"
  ON public.ai_corrections FOR DELETE TO authenticated
  USING (clinic_id = (SELECT public.get_clinic_id()));

-- 3. No-go zones table
CREATE TABLE public.ai_no_go_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  topic_keywords TEXT[] NOT NULL DEFAULT '{}',
  reason TEXT,
  detected_via TEXT NOT NULL CHECK (detected_via IN ('explicit', 'inferred')),
  confidence FLOAT NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index for duplicate prevention
CREATE UNIQUE INDEX IF NOT EXISTS idx_nogo_unique_topic
  ON public.ai_no_go_zones(clinic_id, lower(topic))
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_nogo_active
  ON public.ai_no_go_zones(clinic_id)
  WHERE is_active = true;

ALTER TABLE public.ai_no_go_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_no_go_zones_select"
  ON public.ai_no_go_zones FOR SELECT TO authenticated
  USING (clinic_id = (SELECT public.get_clinic_id()));

CREATE POLICY "ai_no_go_zones_insert"
  ON public.ai_no_go_zones FOR INSERT TO authenticated
  WITH CHECK (clinic_id = (SELECT public.get_clinic_id()));

CREATE POLICY "ai_no_go_zones_update"
  ON public.ai_no_go_zones FOR UPDATE TO authenticated
  USING (clinic_id = (SELECT public.get_clinic_id()))
  WITH CHECK (clinic_id = (SELECT public.get_clinic_id()));

CREATE POLICY "ai_no_go_zones_delete"
  ON public.ai_no_go_zones FOR DELETE TO authenticated
  USING (clinic_id = (SELECT public.get_clinic_id()));
