-- MediQueue-2026 Consolidated Master Schema Script
-- Resets public schema and creates all authoritative tables in correct dependency order.

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

GRANT ALL ON SCHEMA public TO postgres, public, anon, authenticated, service_role;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;

-- 1. Medical Centers Table
CREATE TABLE public.medical_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  latitude NUMERIC(10,8),
  longitude NUMERIC(11,8),
  opening_hours TEXT NOT NULL,
  services TEXT[] DEFAULT '{}',
  phone TEXT,
  email TEXT,
  status TEXT CHECK (status IN ('operational', 'maintenance', 'closed')) NOT NULL DEFAULT 'operational',
  approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved',
  requested_by_name TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Users Table
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT CHECK (role IN ('patient', 'doctor', 'receptionist', 'admin')) NOT NULL DEFAULT 'patient',
  center_id UUID REFERENCES public.medical_centers(id) ON DELETE SET NULL,
  password_hash TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  avatar_url TEXT,
  no_show_count INT DEFAULT 0,
  is_flagged_late BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Center Documents Table (Required for Receptionist Document Uploads)
CREATE TABLE public.center_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID REFERENCES public.medical_centers(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Doctors Table
CREATE TABLE public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  center_id UUID REFERENCES public.medical_centers(id) ON DELETE SET NULL,
  specialization TEXT NOT NULL,
  max_appointments_per_hour INT DEFAULT 4,
  current_status TEXT CHECK (current_status IN ('active', 'delayed', 'break', 'offline')) DEFAULT 'active',
  approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved',
  requested_by_name TEXT,
  rejection_reason TEXT,
  delay_minutes INT DEFAULT 0,
  room_number TEXT,
  series VARCHAR(5),
  available_hours JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Doctor Requests Inbox Table
CREATE TABLE public.doctor_requests (
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

-- 6. Appointments Table
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE,
  center_id UUID REFERENCES public.medical_centers(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  slot_hour INT NOT NULL CHECK (slot_hour BETWEEN 0 AND 23),
  queue_number INT NOT NULL,
  is_late_number BOOLEAN DEFAULT FALSE,
  status TEXT CHECK (status IN ('booked', 'waiting', 'in_consultation', 'completed', 'cancelled', 'no_show')) DEFAULT 'booked',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Walk-in Queue Table
CREATE TABLE public.walk_in_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE,
  center_id UUID REFERENCES public.medical_centers(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  nic TEXT,
  sms_phone TEXT,
  queue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  queue_number INT NOT NULL,
  source TEXT NOT NULL DEFAULT 'online' CHECK (source IN ('online', 'physical')),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'in_progress', 'completed', 'left')),
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  called_at TIMESTAMPTZ
);

-- 7b. Doctor <-> Center postings (one doctor can work at many centers, each
--     posting with its own room, token series, capacity and on-duty status).
CREATE TABLE public.doctor_center_assignments (
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
CREATE INDEX idx_dca_center ON public.doctor_center_assignments(center_id);
CREATE INDEX idx_dca_center_approval ON public.doctor_center_assignments(center_id, approval_status);
CREATE INDEX idx_dca_doctor ON public.doctor_center_assignments(doctor_id);

-- 8. Doctor Subscriptions Table
CREATE TABLE public.doctor_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id, doctor_id)
);

-- 8b. Delay Alerts Table (one row per published delay notice — see migration 011)
--     Kept after the doctor resumes (cleared_at stamped, row retained) so the
--     patient and reception dashboards can show a delay feed with history.
CREATE TABLE public.delay_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  center_id UUID REFERENCES public.medical_centers(id) ON DELETE SET NULL,
  doctor_name TEXT NOT NULL DEFAULT 'Doctor',
  specialization TEXT,
  room_number TEXT,
  center_name TEXT,
  delay_minutes INT NOT NULL DEFAULT 15 CHECK (delay_minutes >= 0),
  reason TEXT NOT NULL DEFAULT '',
  message TEXT,
  notified_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  raised_by_name TEXT,
  raised_by_role TEXT CHECK (raised_by_role IN ('receptionist', 'doctor', 'admin', 'system')) DEFAULT 'doctor',
  cleared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_delay_alerts_doctor ON public.delay_alerts(doctor_id, created_at DESC);
CREATE INDEX idx_delay_alerts_center ON public.delay_alerts(center_id, created_at DESC);
CREATE INDEX idx_delay_alerts_live ON public.delay_alerts(created_at DESC) WHERE cleared_at IS NULL;

-- 9. Health Records Table
CREATE TABLE public.health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  notes TEXT,
  file_url TEXT,
  record_type TEXT DEFAULT 'lab_report',
  issuing_authority TEXT,
  rx_medications JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Patient Profiles Table
CREATE TABLE public.patient_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  nic TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  blood_group TEXT,
  allergies TEXT,
  chronic_conditions TEXT,
  sms_alerts_enabled BOOLEAN DEFAULT TRUE,
  delay_alerts_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Refresh Sessions Table
CREATE TABLE public.refresh_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  jti UUID NOT NULL UNIQUE,
  user_agent TEXT,
  ip_address TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Login Audit Log Table
CREATE TABLE public.login_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  role TEXT,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. System Audit Logs Table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_name TEXT NOT NULL DEFAULT 'System',
  actor_role TEXT NOT NULL CHECK (actor_role IN ('receptionist', 'patient', 'doctor', 'admin', 'system')) DEFAULT 'system',
  event_type TEXT NOT NULL CHECK (event_type IN ('signup', 'profile_updated', 'user_suspended', 'user_activated', 'user_deleted', 'doctor_approved', 'doctor_rejected', 'center_delete', 'center_suspend', 'center_edit', 'system_warning')) DEFAULT 'system_warning',
  action TEXT NOT NULL,
  center_name TEXT NOT NULL DEFAULT 'Platform',
  status TEXT NOT NULL CHECK (status IN ('approved', 'pending', 'completed', 'rejected')) DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. System Settings Table
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissions & Grants
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role, postgres, public;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role, postgres, public;

-- Prototype RLS Disable
ALTER TABLE public.medical_centers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.center_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_center_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.walk_in_queue DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.delay_alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings DISABLE ROW LEVEL SECURITY;
