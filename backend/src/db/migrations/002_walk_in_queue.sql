-- MediQueue migration 002: Reception Desk walk-in queue
--
-- Additive only — safe to run against the live database from schema.sql.
-- Does NOT drop or touch existing tables/rows. Run this once in the Supabase
-- SQL Editor (Project → SQL Editor → New query → paste → Run).

-- 1. Per-doctor token series letter (#A-11, #B-06, ...), used by the
--    Reception Desk to format tokens and keep each doctor's numbering separate.
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS series CHAR(1);

-- Backfill any doctor rows that don't have one yet, in creation order (A, B, C, ...).
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM public.doctors
  WHERE series IS NULL
)
UPDATE public.doctors d
SET series = CHR(64 + ranked.rn::int)
FROM ranked
WHERE d.id = ranked.id;

-- 2. Walk-in queue — one row per token issued at the reception counter today.
--    Deliberately separate from `appointments` (which models patient-booked,
--    date/slot-scheduled visits): a walk-in token has no booking, may belong
--    to someone with no user account yet (name + NIC + phone captured at the
--    counter), and moves through its own waiting → called → in_progress →
--    completed/left lifecycle.
CREATE TABLE IF NOT EXISTS public.walk_in_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  nic TEXT,
  sms_phone TEXT,
  queue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  queue_number INT NOT NULL,
  source TEXT CHECK (source IN ('online', 'physical')) NOT NULL DEFAULT 'online',
  status TEXT CHECK (status IN ('waiting', 'called', 'in_progress', 'completed', 'left')) NOT NULL DEFAULT 'waiting',
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  called_at TIMESTAMPTZ,
  UNIQUE (doctor_id, queue_date, queue_number)
);

CREATE INDEX IF NOT EXISTS idx_walk_in_queue_doctor_date ON public.walk_in_queue (doctor_id, queue_date);

-- Match the rest of the prototype schema: RLS off, full grants (see schema.sql).
ALTER TABLE public.walk_in_queue DISABLE ROW LEVEL SECURITY;
GRANT ALL PRIVILEGES ON TABLE public.walk_in_queue TO anon, authenticated, service_role, postgres, public;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role, postgres, public;
