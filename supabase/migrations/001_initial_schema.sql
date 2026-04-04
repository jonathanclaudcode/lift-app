-- ==========================================
-- HELPER FUNCTIONS
-- ==========================================

-- Get current user's clinic_id from JWT (cached per query for RLS performance)
CREATE OR REPLACE FUNCTION public.get_clinic_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT CASE
    WHEN auth.jwt() IS NULL THEN NULL
    WHEN auth.jwt() -> 'app_metadata' ->> 'clinic_id' IS NULL THEN NULL
    ELSE (auth.jwt() -> 'app_metadata' ->> 'clinic_id')::uuid
  END
$$;

-- Auto-update updated_at timestamp on row modification
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-update conversation last_message fields when a new message is inserted
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS trigger AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.content, 100),
      unread_count = CASE
        WHEN NEW.direction = 'inbound' THEN unread_count + 1
        ELSE unread_count
      END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- TABLES
-- ==========================================

CREATE TABLE public.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  phone text,
  address text,
  website text,
  style_profile jsonb DEFAULT '{}',
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.clinic_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'staff')),
  display_name text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id, user_id)
);

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  birthday date,
  notes text,
  skin_type text,
  allergies text[],
  preferences jsonb DEFAULT '{}',
  treatment_count int DEFAULT 0,
  last_visit_at timestamptz,
  avg_rebooking_days int,
  response_rate decimal(5,4) DEFAULT NULL CHECK (response_rate IS NULL OR (response_rate >= 0 AND response_rate <= 1)),
  pipeline_stage text DEFAULT 'new' CHECK (pipeline_stage IN ('new', 'consultation_booked', 'treated', 'follow_up_due', 'loyal')),
  profile_summary text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id, phone)
);

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  channel text NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'messenger', 'email', 'web')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked')),
  last_message_at timestamptz,
  last_message_preview text,
  unread_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id, customer_id, channel)
);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  author text NOT NULL CHECK (author IN ('customer', 'ai_agent', 'clinic_staff')),
  content text NOT NULL,
  status text DEFAULT 'sent' CHECK (status IN ('draft', 'pending_approval', 'sending', 'sent', 'delivered', 'read', 'failed')),
  channel text NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'messenger', 'email', 'web')),
  ai_suggestions jsonb,
  ai_confidence decimal(5,4) CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1)),
  suggested_text text,
  final_text text,
  edit_distance int,
  external_message_id text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  source text DEFAULT 'email' CHECK (source IN ('bokadirekt_api', 'ical', 'email', 'manual')),
  status text DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'rescheduled', 'completed', 'no_show')),
  treatment text NOT NULL,
  provider_name text,
  location text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  price decimal(10,2),
  bokadirekt_id text,
  raw_email_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.suggestion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  suggestions jsonb NOT NULL,
  chosen_index int,
  suggested_text text,
  final_text text,
  edit_distance int,
  edit_ratio decimal(5,4) CHECK (edit_ratio IS NULL OR (edit_ratio >= 0 AND edit_ratio <= 1)),
  response_time_ms int,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.whatsapp_windows (
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  customer_phone text NOT NULL,
  last_customer_message_at timestamptz NOT NULL,
  window_expires_at timestamptz NOT NULL,
  PRIMARY KEY (clinic_id, customer_phone)
);

-- Auto-compute window_expires_at = last_customer_message_at + 24 hours
CREATE OR REPLACE FUNCTION public.set_whatsapp_window_expiry()
RETURNS trigger AS $$
BEGIN
  NEW.window_expires_at = NEW.last_customer_message_at + INTERVAL '24 hours';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_whatsapp_window_expiry
  BEFORE INSERT OR UPDATE ON public.whatsapp_windows
  FOR EACH ROW EXECUTE FUNCTION set_whatsapp_window_expiry();

-- ==========================================
-- TRIGGERS
-- ==========================================

-- Auto-update updated_at on clinics, customers, conversations, bookings
CREATE TRIGGER set_updated_at_clinics BEFORE UPDATE ON public.clinics FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_customers BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_conversations BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_bookings BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-update conversation metadata when message is inserted
CREATE TRIGGER update_conversation_on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- ==========================================
-- INDEXES
-- ==========================================

CREATE INDEX idx_clinic_members_user ON public.clinic_members(user_id);
CREATE INDEX idx_customers_clinic ON public.customers(clinic_id);
CREATE INDEX idx_customers_clinic_phone ON public.customers(clinic_id, phone);
CREATE INDEX idx_conversations_clinic_last ON public.conversations(clinic_id, last_message_at DESC);
CREATE INDEX idx_conversations_customer ON public.conversations(customer_id);
CREATE INDEX idx_messages_clinic_conv_created ON public.messages(clinic_id, conversation_id, created_at);
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at);
CREATE INDEX idx_messages_status ON public.messages(clinic_id, status) WHERE status IN ('draft', 'pending_approval');
CREATE INDEX idx_bookings_clinic ON public.bookings(clinic_id, starts_at);
CREATE INDEX idx_bookings_customer ON public.bookings(customer_id, starts_at);
CREATE INDEX idx_whatsapp_windows_expires ON public.whatsapp_windows(window_expires_at);

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================

-- Enable RLS on ALL tables
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_windows ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- NOTE: Clinics and clinic_members INSERT operations must go through admin client (service role)
-- because the user doesn't have clinic_id in JWT at creation time.

CREATE POLICY "Users see own clinic" ON public.clinics
  FOR ALL TO authenticated
  USING (id = (SELECT public.get_clinic_id()));

CREATE POLICY "Clinic members scoped" ON public.clinic_members
  FOR ALL TO authenticated
  USING (clinic_id = (SELECT public.get_clinic_id()));

CREATE POLICY "Customers scoped to clinic" ON public.customers
  FOR ALL TO authenticated
  USING (clinic_id = (SELECT public.get_clinic_id()));

CREATE POLICY "Conversations scoped to clinic" ON public.conversations
  FOR ALL TO authenticated
  USING (clinic_id = (SELECT public.get_clinic_id()));

CREATE POLICY "Messages scoped to clinic" ON public.messages
  FOR ALL TO authenticated
  USING (clinic_id = (SELECT public.get_clinic_id()));

CREATE POLICY "Bookings scoped to clinic" ON public.bookings
  FOR ALL TO authenticated
  USING (clinic_id = (SELECT public.get_clinic_id()));

CREATE POLICY "Suggestion events scoped to clinic" ON public.suggestion_events
  FOR ALL TO authenticated
  USING (clinic_id = (SELECT public.get_clinic_id()));

CREATE POLICY "WhatsApp windows scoped to clinic" ON public.whatsapp_windows
  FOR ALL TO authenticated
  USING (clinic_id = (SELECT public.get_clinic_id()));
