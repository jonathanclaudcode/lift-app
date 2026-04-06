-- RPC: Increment total_messages (atomic, with upsert)
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
