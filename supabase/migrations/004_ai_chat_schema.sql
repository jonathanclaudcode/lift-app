-- ==========================================
-- AI CHAT: Clinic owner's personal AI assistant
-- ==========================================

CREATE TABLE public.ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'assistant')),
  content text NOT NULL,
  model text,
  input_tokens int,
  output_tokens int,
  latency_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  message_id uuid REFERENCES public.ai_chat_messages(id) ON DELETE SET NULL,
  model text NOT NULL,
  input_tokens int,
  output_tokens int,
  latency_ms int NOT NULL,
  finish_reason text,
  error text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.clinic_preferences (
  clinic_id uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  interaction_count int NOT NULL DEFAULT 0,
  relationship_phase text NOT NULL DEFAULT 'dating' CHECK (relationship_phase IN ('dating', 'building', 'trust')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.clinic_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL CHECK (category IN ('treatment', 'policy', 'faq', 'team', 'product', 'preference', 'correction', 'personal')),
  content text NOT NULL,
  source text NOT NULL DEFAULT 'owner' CHECK (source IN ('owner', 'auto_discovery', 'synthetic', 'network', 'ai_learned')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_ai_chat_clinic ON public.ai_chat_messages(clinic_id, created_at DESC);
CREATE INDEX idx_ai_traces_clinic ON public.ai_traces(clinic_id, created_at DESC);
CREATE INDEX idx_ai_traces_message ON public.ai_traces(message_id);
CREATE INDEX idx_knowledge_clinic ON public.clinic_knowledge(clinic_id, category) WHERE is_active = true;

-- RLS
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_chat_messages_clinic" ON public.ai_chat_messages
  FOR ALL TO authenticated USING (clinic_id = (SELECT public.get_clinic_id()));

CREATE POLICY "ai_traces_clinic" ON public.ai_traces
  FOR ALL TO authenticated USING (clinic_id = (SELECT public.get_clinic_id()));

CREATE POLICY "clinic_preferences_clinic" ON public.clinic_preferences
  FOR ALL TO authenticated USING (clinic_id = (SELECT public.get_clinic_id()));

CREATE POLICY "clinic_knowledge_clinic" ON public.clinic_knowledge
  FOR ALL TO authenticated USING (clinic_id = (SELECT public.get_clinic_id()));

-- Triggers (update_updated_at already exists from migration 001)
CREATE TRIGGER set_updated_at_clinic_prefs BEFORE UPDATE ON public.clinic_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_clinic_knowledge BEFORE UPDATE ON public.clinic_knowledge
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Backfill preferences for existing clinics
INSERT INTO public.clinic_preferences (clinic_id)
SELECT id FROM public.clinics
ON CONFLICT (clinic_id) DO NOTHING;

-- Auto-create preferences for future clinics
CREATE OR REPLACE FUNCTION public.auto_create_clinic_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.clinic_preferences (clinic_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_clinic_created AFTER INSERT ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION auto_create_clinic_preferences();

-- Increment interaction count helper
CREATE OR REPLACE FUNCTION public.increment_interaction_count(p_clinic_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.clinic_preferences
  SET interaction_count = interaction_count + 1, updated_at = now()
  WHERE clinic_id = p_clinic_id;
END;
$$;
