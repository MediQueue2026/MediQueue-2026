-- ═══════════════════════════════════════════════════════════════════════════════
-- MEDIQUEUE-2026: INCREMENTAL DATABASE PATCH FOR EXISTING DB
-- Run this ONCE in Supabase SQL Editor (Project -> SQL Editor -> New Query -> Run)
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Add approval and tracking columns to medical_centers
ALTER TABLE public.medical_centers
ADD COLUMN IF NOT EXISTS approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS requested_by_name TEXT,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;

UPDATE public.medical_centers SET approval_status = 'approved' WHERE approval_status IS NULL;

-- 2. Link users to their assigned medical center
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS center_id UUID REFERENCES public.medical_centers(id) ON DELETE SET NULL;

-- 3. Add approval and tracking columns to doctors
ALTER TABLE public.doctors
ADD COLUMN IF NOT EXISTS approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS requested_by_name TEXT,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

UPDATE public.doctors SET approval_status = 'approved' WHERE approval_status IS NULL;

-- 4. Create doctor_requests table (For Receptionist -> Admin Doctor Approval Inbox)
CREATE TABLE IF NOT EXISTS public.doctor_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type TEXT NOT NULL CHECK (request_type IN ('ASSIGN_EXISTING', 'REGISTER_NEW')) DEFAULT 'REGISTER_NEW',
  receptionist_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  receptionist_name TEXT NOT NULL DEFAULT 'Receptionist',
  center_id UUID REFERENCES public.medical_centers(id) ON DELETE CASCADE,
  center_name TEXT NOT NULL DEFAULT 'Medical Center',
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  doctor_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  specialization TEXT NOT NULL,
  room_number TEXT,
  series TEXT,
  max_appointments_per_hour INTEGER DEFAULT 4,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create center_documents table (For Receptionist Center Document Uploads)
CREATE TABLE IF NOT EXISTS public.center_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID REFERENCES public.medical_centers(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Indexes & Grant Permissions
--    RLS is intentionally disabled on every table in this project (see the
--    "Prototype RLS Disable" block in schema.sql). All access goes through the
--    Express API with a service-role key; authorization is enforced in
--    middleware (authMiddleware + requireRole), not in the database. The
--    Supabase editor's "no RLS" warning is expected here — run anyway.
CREATE INDEX IF NOT EXISTS idx_doctor_requests_status ON public.doctor_requests(status);
CREATE INDEX IF NOT EXISTS idx_doctor_requests_center ON public.doctor_requests(center_id);
CREATE INDEX IF NOT EXISTS idx_center_documents_center ON public.center_documents(center_id);

GRANT ALL PRIVILEGES ON TABLE public.doctor_requests TO anon, authenticated, service_role, postgres, public;
GRANT ALL PRIVILEGES ON TABLE public.center_documents TO anon, authenticated, service_role, postgres, public;

ALTER TABLE public.doctor_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.center_documents DISABLE ROW LEVEL SECURITY;

-- 7. Give the demo receptionist a medical center so the center-scoped Reception
--    Desk has data (see migration 009_receptionist_center.sql).
INSERT INTO public.medical_centers (id, name, address, city, opening_hours, services, phone, email, approval_status)
VALUES (
  'a1000000-0000-0000-0000-000000000001',
  'MediQueue Central Clinic', '124 Medical Plaza', 'Colombo 07', '08:00 - 20:00',
  ARRAY['Cardiology', 'General Medicine', 'Pediatrics'], '0112345678', 'central@mediqueue.io',
  'approved'
)
ON CONFLICT (id) DO NOTHING;

UPDATE public.users
   SET center_id = 'a1000000-0000-0000-0000-000000000001', updated_at = NOW()
 WHERE LOWER(email) = 'reception@mediqueue.io' AND center_id IS NULL;

UPDATE public.doctors AS d
   SET center_id = 'a1000000-0000-0000-0000-000000000001'
  FROM public.users AS u
 WHERE d.user_id = u.id AND LOWER(u.email) = 'dr.carr@mediqueue.io' AND d.center_id IS NULL;

-- 8. One doctor -> many centers: per-center posting table (migration 010).
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

ALTER TABLE public.walk_in_queue
  ADD COLUMN IF NOT EXISTS center_id UUID REFERENCES public.medical_centers(id);
CREATE INDEX IF NOT EXISTS idx_walk_in_queue_center ON public.walk_in_queue(center_id);

UPDATE public.walk_in_queue q
   SET center_id = d.center_id
  FROM public.doctors d
 WHERE q.doctor_id = d.id AND q.center_id IS NULL AND d.center_id IS NOT NULL;

INSERT INTO public.doctor_center_assignments
  (doctor_id, center_id, room_number, series, max_appointments_per_hour, current_status, approval_status)
SELECT d.id, 'a1000000-0000-0000-0000-000000000001', 'Room 04', 'A', 4, 'active', 'approved'
FROM public.doctors d
JOIN public.users u ON u.id = d.user_id
WHERE LOWER(u.email) = 'dr.carr@mediqueue.io'
ON CONFLICT (doctor_id, center_id) DO NOTHING;
