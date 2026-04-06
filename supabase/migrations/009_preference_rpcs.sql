-- ============================================================
-- MIGRATION 007a: Preference Engine RPC functions
-- ============================================================

-- RPC: Atomic preference update with upsert
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
