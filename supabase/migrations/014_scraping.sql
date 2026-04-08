-- ============================================================
-- MIGRATION 014: Website Scraping Infrastructure
-- ============================================================

-- 1. Add last_scanned_at to clinics (website column already exists)
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS last_scanned_at TIMESTAMPTZ;

-- 2. Expand clinic_knowledge source CHECK to include 'website_scrape'
ALTER TABLE public.clinic_knowledge
  DROP CONSTRAINT IF EXISTS clinic_knowledge_source_check;

ALTER TABLE public.clinic_knowledge
  ADD CONSTRAINT clinic_knowledge_source_check
  CHECK (source IN ('owner', 'auto_discovery', 'synthetic', 'network', 'ai_learned', 'website_scrape'));

-- 3. Expand clinic_knowledge category CHECK to include 'staff', 'hours', 'booking'
ALTER TABLE public.clinic_knowledge
  DROP CONSTRAINT IF EXISTS clinic_knowledge_category_check;

ALTER TABLE public.clinic_knowledge
  ADD CONSTRAINT clinic_knowledge_category_check
  CHECK (category IN ('treatment', 'policy', 'faq', 'team', 'product', 'preference', 'correction', 'personal', 'staff', 'hours', 'booking'));

-- 4. Add scraping metadata columns to clinic_knowledge
ALTER TABLE public.clinic_knowledge
  ADD COLUMN IF NOT EXISTS confidence TEXT DEFAULT 'high',
  ADD COLUMN IF NOT EXISTS source_url TEXT;

-- 5. Scrape cache (raw markdown for debugging)
CREATE TABLE IF NOT EXISTS public.scrape_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  markdown_content TEXT,
  pages_scraped INTEGER DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinic_id)
);

ALTER TABLE public.scrape_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scrape_cache_service"
  ON public.scrape_cache FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
