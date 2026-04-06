-- ============================================================
-- MIGRATION 007: Preference Engine (Beta distribution)
-- ============================================================

CREATE TABLE public.preference_engine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,

  -- Beta(α, β) per preference. Start: (5, 5) = mean 0.5 (neutral)
  formality_alpha FLOAT NOT NULL DEFAULT 5.0,
  formality_beta FLOAT NOT NULL DEFAULT 5.0,
  emoji_frequency_alpha FLOAT NOT NULL DEFAULT 5.0,
  emoji_frequency_beta FLOAT NOT NULL DEFAULT 5.0,
  verbosity_alpha FLOAT NOT NULL DEFAULT 5.0,
  verbosity_beta FLOAT NOT NULL DEFAULT 5.0,
  humor_tolerance_alpha FLOAT NOT NULL DEFAULT 5.0,
  humor_tolerance_beta FLOAT NOT NULL DEFAULT 5.0,
  proactivity_tolerance_alpha FLOAT NOT NULL DEFAULT 5.0,
  proactivity_tolerance_beta FLOAT NOT NULL DEFAULT 5.0,

  total_messages INT NOT NULL DEFAULT 0,
  observed_traits JSONB NOT NULL DEFAULT '[]',
  last_decayed_at DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_clinic_pref UNIQUE (clinic_id)
);

CREATE TABLE public.preference_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  preference_key TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  signal_direction TEXT NOT NULL CHECK (signal_direction IN ('positive', 'negative')),
  signal_weight FLOAT NOT NULL DEFAULT 1.0,
  alpha_before FLOAT,
  beta_before FLOAT,
  alpha_after FLOAT,
  beta_after FLOAT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.trait_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  trait_key TEXT NOT NULL,
  count INT NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  promoted BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT unique_clinic_trait UNIQUE (clinic_id, trait_key)
);

-- Indexes
CREATE INDEX idx_pref_engine_clinic ON public.preference_engine(clinic_id);
CREATE INDEX idx_pref_signals_clinic ON public.preference_signals(clinic_id, created_at DESC);
CREATE INDEX idx_trait_obs_clinic ON public.trait_observations(clinic_id, promoted);

-- RLS
ALTER TABLE public.preference_engine ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preference_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trait_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pref_engine_select" ON public.preference_engine
  FOR SELECT TO authenticated USING (clinic_id = (SELECT public.get_clinic_id()));
CREATE POLICY "pref_engine_insert" ON public.preference_engine
  FOR INSERT TO authenticated WITH CHECK (clinic_id = (SELECT public.get_clinic_id()));
CREATE POLICY "pref_engine_update" ON public.preference_engine
  FOR UPDATE TO authenticated
  USING (clinic_id = (SELECT public.get_clinic_id()))
  WITH CHECK (clinic_id = (SELECT public.get_clinic_id()));

CREATE POLICY "pref_signals_select" ON public.preference_signals
  FOR SELECT TO authenticated USING (clinic_id = (SELECT public.get_clinic_id()));
CREATE POLICY "pref_signals_insert" ON public.preference_signals
  FOR INSERT TO authenticated WITH CHECK (clinic_id = (SELECT public.get_clinic_id()));

CREATE POLICY "trait_obs_select" ON public.trait_observations
  FOR SELECT TO authenticated USING (clinic_id = (SELECT public.get_clinic_id()));
CREATE POLICY "trait_obs_insert" ON public.trait_observations
  FOR INSERT TO authenticated WITH CHECK (clinic_id = (SELECT public.get_clinic_id()));
CREATE POLICY "trait_obs_update" ON public.trait_observations
  FOR UPDATE TO authenticated
  USING (clinic_id = (SELECT public.get_clinic_id()))
  WITH CHECK (clinic_id = (SELECT public.get_clinic_id()));
