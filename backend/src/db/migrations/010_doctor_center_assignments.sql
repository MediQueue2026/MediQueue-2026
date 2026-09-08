-- Migration: One doctor -> many medical centers (per-center posting)
--
-- Until now a `doctors` row carried both the person (user_id, specialization)
-- AND a single posting (center_id, room_number, series, max_appointments_per_hour,
-- current_status, delay_minutes, available_hours). This splits the posting out
-- into `doctor_center_assignments` so a doctor can work at several centers, each
-- with its own room, token series, capacity and on-duty status.
--
-- The legacy posting columns on `public.doctors` are LEFT IN PLACE (a later
-- cleanup migration drops them) so untouched read paths keep working.
--
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Per-(doctor, center) posting.
CREATE TABLE IF NOT EXISTS public.doctor_center_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  center_id UUID NOT NULL REFERENCES public.medical_centers(id) ON DELETE CASCADE,
  room_number TEXT,
  series VARCHAR(5),
  max_appointments_per_hour INT DEFAULT 4,
  current_status TEXT CHECK (current_status IN ('active', 'delayed', 'break', 'offline')) DEFAULT 'active',
  delay_minutes INT DEFAULT 0,
  available_hours JSONB DEFAULT '{}'::jsonb,
  approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  requested_by_name TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (doctor_id, center_id)
);

CREATE INDEX IF NOT EXISTS idx_dca_center ON public.doctor_center_assignments(center_id);
CREATE INDEX IF NOT EXISTS idx_dca_center_approval ON public.doctor_center_assignments(center_id, approval_status);
CREATE INDEX IF NOT EXISTS idx_dca_doctor ON public.doctor_center_assignments(doctor_id);

GRANT ALL PRIVILEGES ON TABLE public.doctor_center_assignments TO anon, authenticated, service_role, postgres, public;
ALTER TABLE public.doctor_center_assignments DISABLE ROW LEVEL SECURITY;

-- 2. Backfill: one assignment per doctor that currently has a center.
INSERT INTO public.doctor_center_assignments
  (doctor_id, center_id, room_number, series, max_appointments_per_hour,
   current_status, delay_minutes, available_hours, approval_status)
SELECT d.id, d.center_id, d.room_number, d.series,
       COALESCE(d.max_appointments_per_hour, 4),
       COALESCE(d.current_status, 'active'),
       COALESCE(d.delay_minutes, 0),
       COALESCE(d.available_hours, '{}'::jsonb),
       COALESCE(d.approval_status, 'approved')
FROM public.doctors d
WHERE d.center_id IS NOT NULL
ON CONFLICT (doctor_id, center_id) DO NOTHING;

-- 3. A walk-in token now belongs to (doctor, center).
ALTER TABLE public.walk_in_queue
  ADD COLUMN IF NOT EXISTS center_id UUID REFERENCES public.medical_centers(id);

CREATE INDEX IF NOT EXISTS idx_walk_in_queue_center ON public.walk_in_queue(center_id);

-- 4. Backfill existing tokens from their doctor's (old) single center.
UPDATE public.walk_in_queue q
   SET center_id = d.center_id
  FROM public.doctors d
 WHERE q.doctor_id = d.id
   AND q.center_id IS NULL
   AND d.center_id IS NOT NULL;

-- 5. Demo data: the seeded demo doctor gets an approved posting at the same
--    center migration 009 linked the demo receptionist to, so the demo desk
--    has a roster. Idempotent.
INSERT INTO public.doctor_center_assignments
  (doctor_id, center_id, room_number, series, max_appointments_per_hour, current_status, approval_status)
SELECT d.id, 'a1000000-0000-0000-0000-000000000001', 'Room 04', 'A', 4, 'active', 'approved'
FROM public.doctors d
JOIN public.users u ON u.id = d.user_id
WHERE LOWER(u.email) = 'dr.carr@mediqueue.io'
ON CONFLICT (doctor_id, center_id) DO NOTHING;
