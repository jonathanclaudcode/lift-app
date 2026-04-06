-- RPC: Promote trait (dedup, max 10)
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
