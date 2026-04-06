-- RPC: Daily decay (with date guard)
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
