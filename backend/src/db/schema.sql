-- MediQueue Full Database Reset & Fresh Schema Script for Supabase / PostgreSQL

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: COMPLETE DATABASE SCHEMA RESET (Wipes all existing tables)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Restore standard PostgreSQL / Supabase permissions
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;

-- Enable UUID & Crypto extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 2: CREATE FRESH TABLE SCHEMAS
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Users Table (Extends Supabase Auth & Stores System Roles)
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT CHECK (role IN ('patient', 'doctor', 'receptionist', 'admin')) NOT NULL DEFAULT 'patient',
  no_show_count INT DEFAULT 0,
  is_flagged_late BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Medical Centers Table
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Doctors Table
CREATE TABLE public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  center_id UUID REFERENCES public.medical_centers(id) ON DELETE SET NULL,
  specialization TEXT NOT NULL,
  max_appointments_per_hour INT DEFAULT 4, -- BR-02: Configurable max appointments/hour limit
  current_status TEXT CHECK (current_status IN ('active', 'delayed', 'break', 'offline')) DEFAULT 'active',
  delay_minutes INT DEFAULT 0,
  room_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Appointments Table
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE,
  center_id UUID REFERENCES public.medical_centers(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  slot_hour INT NOT NULL CHECK (slot_hour BETWEEN 0 AND 23),
  queue_number INT NOT NULL,
  is_late_number BOOLEAN DEFAULT FALSE, -- BR-03: Penalty queue assignment for repeat no-shows
  status TEXT CHECK (status IN ('booked', 'waiting', 'in_consultation', 'completed', 'cancelled', 'no_show')) DEFAULT 'booked',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Doctor Subscriptions Table (BR-05: Live Delay/Location Alerts)
CREATE TABLE public.doctor_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id, doctor_id)
);

-- 6. Health Records Table (FR-09: Patient Profiles & EHR Timeline)
CREATE TABLE public.health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  notes TEXT,
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 3: EXPLICIT TABLE-LEVEL PERMISSION GRANTS (Fixes 42501 Permission Denied)
-- ═══════════════════════════════════════════════════════════════════════════════
GRANT ALL PRIVILEGES ON TABLE public.users TO anon, authenticated, service_role, postgres, public;
GRANT ALL PRIVILEGES ON TABLE public.medical_centers TO anon, authenticated, service_role, postgres, public;
GRANT ALL PRIVILEGES ON TABLE public.doctors TO anon, authenticated, service_role, postgres, public;
GRANT ALL PRIVILEGES ON TABLE public.appointments TO anon, authenticated, service_role, postgres, public;
GRANT ALL PRIVILEGES ON TABLE public.doctor_subscriptions TO anon, authenticated, service_role, postgres, public;
GRANT ALL PRIVILEGES ON TABLE public.health_records TO anon, authenticated, service_role, postgres, public;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role, postgres, public;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role, postgres, public;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role, postgres, public;

-- Disable Row Level Security (RLS) for prototype development testing
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_centers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_records DISABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 4: SEED INITIAL PROTOTYPE DATA
-- ═══════════════════════════════════════════════════════════════════════════════

-- Insert Medical Centers
INSERT INTO public.medical_centers (id, name, address, city, opening_hours, services, phone) VALUES
('a1000000-0000-0000-0000-000000000001', 'MediQueue Central Clinic', '124 Medical Plaza', 'Colombo 07', '08:00 - 20:00', ARRAY['Cardiology', 'General Medicine', 'Pediatrics'], '0112345678'),
('a1000000-0000-0000-0000-000000000002', 'MediQueue North Branch', '45 Station Road', 'Kandy', '09:00 - 18:00', ARRAY['Orthopedics', 'General Medicine'], '0812345678');

-- Insert Initial Users
INSERT INTO public.users (id, email, full_name, phone, role) VALUES
('b1000000-0000-0000-0000-000000000001', 'patient@mediqueue.io', 'Rajan Mehta', '0771234567', 'patient'),
('b1000000-0000-0000-0000-000000000002', 'dr.carr@mediqueue.io', 'Dr. Ethan Carr', '0779876543', 'doctor'),
('b1000000-0000-0000-0000-000000000003', 'dr.patel@mediqueue.io', 'Dr. Aisha Patel', '0714567890', 'doctor'),
('b1000000-0000-0000-0000-000000000004', 'reception@mediqueue.io', 'Chamari Silva', '0751122334', 'receptionist'),
('b1000000-0000-0000-0000-000000000005', 'admin@mediqueue.io', 'System Administrator', '0709988776', 'admin');

-- Insert Doctor Profiles
INSERT INTO public.doctors (id, user_id, center_id, specialization, max_appointments_per_hour, current_status, delay_minutes, room_number) VALUES
('c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'General Medicine', 4, 'active', 0, 'Room 04'),
('c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'Cardiology', 4, 'active', 8, 'Room 03');
