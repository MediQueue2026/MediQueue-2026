-- Migration: 022_center_admin_messages.sql
-- Dedicated two-way messaging between Medical Centers (receptionists) and the System Admin.

CREATE TABLE IF NOT EXISTS public.center_admin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.medical_centers(id) ON DELETE CASCADE,
  center_name TEXT,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('receptionist', 'admin')),
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'payment')),
  title TEXT,
  message TEXT NOT NULL,
  attachment_url TEXT,
  attachment_name TEXT,
  parent_id UUID REFERENCES public.center_admin_messages(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performant lookup by center and unread state
CREATE INDEX IF NOT EXISTS idx_center_admin_messages_center_id ON public.center_admin_messages(center_id);
CREATE INDEX IF NOT EXISTS idx_center_admin_messages_created_at ON public.center_admin_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_center_admin_messages_is_read ON public.center_admin_messages(is_read);

-- Prototype security setting consistent with existing tables
ALTER TABLE public.center_admin_messages DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.center_admin_messages TO anon, authenticated, service_role, postgres;
