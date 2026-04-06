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

-- ============================================================
-- RPC: Atomic preference update with upsert
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_preference_atomic(
  p_clinic_id UUID,
  p_preference_key TEXT,
  p_direction TEXT,
  p_weight FLOAT
) RETURNS JSONB
SET search_path = public
AS $$
DECLARE
  alpha_col TEXT;
  beta_col TEXT;
  old_alpha FLOAT;
  old_beta FLOAT;
  new_alpha FLOAT;
  new_beta FLOAT;
  allowed_keys TEXT[] := ARRAY[
    'formality', 'emoji_frequency', 'verbosity',
    'humor_tolerance', 'proactivity_tolerance'
  ];
BEGIN
  IF NOT (p_preference_key = ANY(allowed_keys)) THEN
    RAISE EXCEPTION 'Invalid preference key: %', p_preference_key;
  END IF;
  IF p_direction NOT IN ('positive', 'negative') THEN
    RAISE EXCEPTION 'Invalid direction: %', p_direction;
  END IF;

  alpha_col := p_preference_key || '_alpha';
  beta_col := p_preference_key || '_beta';

  -- Ensure row exists
  INSERT INTO preference_engine (clinic_id)
  VALUES (p_clinic_id)
  ON CONFLICT (clinic_id) DO NOTHING;

  IF p_direction = 'positive' THEN
    EXECUTE format(
      'UPDATE preference_engine SET %I = %I + $1, updated_at = now()
       WHERE clinic_id = $2
       RETURNING %I - $1, %I, %I, %I',
      alpha_col, alpha_col, alpha_col, beta_col, alpha_col, beta_col
    ) INTO old_alpha, old_beta, new_alpha, new_beta USING p_weight, p_clinic_id;
  ELSE
    EXECUTE format(
      'UPDATE preference_engine SET %I = %I + $1, updated_at = now()
       WHERE clinic_id = $2
       RETURNING %I, %I - $1, %I, %I',
      beta_col, beta_col, alpha_col, beta_col, alpha_col, beta_col
    ) INTO old_alpha, old_beta, new_alpha, new_beta USING p_weight, p_clinic_id;
  END IF;

  RETURN jsonb_build_object(
    'old_alpha', old_alpha, 'old_beta', old_beta,
    'new_alpha', new_alpha, 'new_beta', new_beta
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: Increment total_messages (atomic, with upsert)
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_preference_messages(
  p_clinic_id UUID
) RETURNS VOID
SET search_path = public
AS $$
BEGIN
  INSERT INTO preference_engine (clinic_id, total_messages)
  VALUES (p_clinic_id, 1)
  ON CONFLICT (clinic_id)
  DO UPDATE SET total_messages = preference_engine.total_messages + 1, updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: Daily decay (with date guard)
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_preference_decay(
  p_clinic_id UUID,
  p_decay_factor FLOAT,
  p_minimum FLOAT
) RETURNS BOOLEAN
SET search_path = public
AS $$
DECLARE
  last_decay DATE;
BEGIN
  SELECT last_decayed_at INTO last_decay
  FROM preference_engine WHERE clinic_id = p_clinic_id;

  IF last_decay IS NOT NULL AND last_decay = CURRENT_DATE THEN RETURN FALSE; END IF;

  UPDATE preference_engine SET
    formality_alpha = GREATEST(p_minimum, formality_alpha * p_decay_factor),
    formality_beta = GREATEST(p_minimum, formality_beta * p_decay_factor),
    emoji_frequency_alpha = GREATEST(p_minimum, emoji_frequency_alpha * p_decay_factor),
    emoji_frequency_beta = GREATEST(p_minimum, emoji_frequency_beta * p_decay_factor),
    verbosity_alpha = GREATEST(p_minimum, verbosity_alpha * p_decay_factor),
    verbosity_beta = GREATEST(p_minimum, verbosity_beta * p_decay_factor),
    humor_tolerance_alpha = GREATEST(p_minimum, humor_tolerance_alpha * p_decay_factor),
    humor_tolerance_beta = GREATEST(p_minimum, humor_tolerance_beta * p_decay_factor),
    proactivity_tolerance_alpha = GREATEST(p_minimum, proactivity_tolerance_alpha * p_decay_factor),
    proactivity_tolerance_beta = GREATEST(p_minimum, proactivity_tolerance_beta * p_decay_factor),
    last_decayed_at = CURRENT_DATE,
    updated_at = now()
  WHERE clinic_id = p_clinic_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: Upsert trait observation (atomic)
-- ============================================================
CREATE OR REPLACE FUNCTION public.upsert_trait_observation(
  p_clinic_id UUID,
  p_trait_key TEXT
) RETURNS INT
SET search_path = public
AS $$
DECLARE
  new_count INT;
BEGIN
  INSERT INTO trait_observations (clinic_id, trait_key, count, last_seen_at)
  VALUES (p_clinic_id, p_trait_key, 1, now())
  ON CONFLICT (clinic_id, trait_key)
  DO UPDATE SET count = trait_observations.count + 1, last_seen_at = now()
  RETURNING count INTO new_count;

  RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: Promote trait (dedup, max 10)
-- ============================================================
CREATE OR REPLACE FUNCTION public.promote_trait(
  p_clinic_id UUID,
  p_trait_text TEXT
) RETURNS VOID
SET search_path = public
AS $$
BEGIN
  INSERT INTO preference_engine (clinic_id)
  VALUES (p_clinic_id)
  ON CONFLICT (clinic_id) DO NOTHING;

  UPDATE preference_engine SET
    observed_traits = CASE
      WHEN observed_traits @> jsonb_build_array(p_trait_text) THEN observed_traits
      WHEN jsonb_array_length(observed_traits) >= 10 THEN
        (observed_traits - 0) || jsonb_build_array(p_trait_text)
      ELSE
        observed_traits || jsonb_build_array(p_trait_text)
    END,
    updated_at = now()
  WHERE clinic_id = p_clinic_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
