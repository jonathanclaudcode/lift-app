-- ============================================================
-- MIGRATION 015: WhatsApp Integration
-- ============================================================

-- 1. Add whatsapp_phone to clinics
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clinics_whatsapp_phone_unique
  ON public.clinics (whatsapp_phone)
  WHERE whatsapp_phone IS NOT NULL;

ALTER TABLE public.clinics
  ADD CONSTRAINT chk_clinics_whatsapp_phone_format
  CHECK (whatsapp_phone IS NULL OR whatsapp_phone ~ '^[0-9]+$');

-- 2. Add source column to ai_chat_messages
ALTER TABLE public.ai_chat_messages
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'web';

ALTER TABLE public.ai_chat_messages
  ADD CONSTRAINT chk_ai_chat_messages_source
  CHECK (source IN ('web', 'whatsapp', 'sms'));

-- 3. WhatsApp message dedup log
CREATE TABLE IF NOT EXISTS public.whatsapp_message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_message_id TEXT NOT NULL UNIQUE,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.whatsapp_message_log IS 'Deduplication log for WhatsApp webhook messages. Safe to prune entries older than 7 days.';

ALTER TABLE public.whatsapp_message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct user access to whatsapp_message_log"
  ON public.whatsapp_message_log
  FOR ALL
  USING (false)
  WITH CHECK (false);
