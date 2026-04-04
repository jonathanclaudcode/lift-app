-- Add columns for conversation tracking and cost analysis
ALTER TABLE public.suggestion_events
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS prompt_tokens integer,
  ADD COLUMN IF NOT EXISTS completion_tokens integer;

-- Index for lookup per conversation
CREATE INDEX IF NOT EXISTS idx_suggestion_events_conversation
  ON public.suggestion_events (conversation_id, created_at DESC);
