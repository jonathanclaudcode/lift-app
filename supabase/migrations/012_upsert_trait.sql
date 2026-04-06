-- RPC: Upsert trait observation (atomic)
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
