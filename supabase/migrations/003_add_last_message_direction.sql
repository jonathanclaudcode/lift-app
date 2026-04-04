-- Add last_message_direction to conversations
ALTER TABLE public.conversations
  ADD COLUMN last_message_direction text;

-- Backfill from existing messages
UPDATE public.conversations c
SET last_message_direction = m.direction
FROM (
  SELECT DISTINCT ON (conversation_id) conversation_id, direction
  FROM public.messages
  ORDER BY conversation_id, created_at DESC
) m
WHERE c.id = m.conversation_id;

-- Update trigger to also store direction
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS trigger AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.content, 100),
      last_message_direction = NEW.direction,
      unread_count = CASE
        WHEN NEW.direction = 'inbound' THEN unread_count + 1
        ELSE unread_count
      END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
