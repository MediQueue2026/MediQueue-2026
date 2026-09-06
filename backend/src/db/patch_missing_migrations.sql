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
CREATE INDEX IF NOT EXISTS idx_doctor_requests_status ON public.doctor_requests(status);
CREATE INDEX IF NOT EXISTS idx_doctor_requests_center ON public.doctor_requests(center_id);
CREATE INDEX IF NOT EXISTS idx_center_documents_center ON public.center_documents(center_id);

GRANT ALL PRIVILEGES ON TABLE public.doctor_requests TO anon, authenticated, service_role, postgres, public;
GRANT ALL PRIVILEGES ON TABLE public.center_documents TO anon, authenticated, service_role, postgres, public;

ALTER TABLE public.doctor_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.center_documents DISABLE ROW LEVEL SECURITY;
