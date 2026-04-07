-- ============================================================
-- MIGRATION 016: Onboarding flow + background scraping state
-- ============================================================

-- 1. Onboarding completion flag
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

-- 2. AI personality (chosen during onboarding)
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS ai_name TEXT,
  ADD COLUMN IF NOT EXISTS ai_personality_character TEXT;

-- 3. Onboarding answers stored as structured JSONB
-- Holds all quiz answers progressively as the user fills them out.
-- Allows resuming if the user leaves mid-flow.
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS onboarding_data JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 4. Background scraping job state
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS scraping_status TEXT,
  ADD COLUMN IF NOT EXISTS scraping_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scraping_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scraping_error TEXT,
  ADD COLUMN IF NOT EXISTS scraping_result JSONB;

-- 5. CHECK constraint on scraping_status (safe re-run via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_clinics_scraping_status'
  ) THEN
    ALTER TABLE public.clinics
      ADD CONSTRAINT chk_clinics_scraping_status
      CHECK (scraping_status IS NULL OR scraping_status IN ('pending', 'in_progress', 'success', 'failed'));
  END IF;
END $$;
