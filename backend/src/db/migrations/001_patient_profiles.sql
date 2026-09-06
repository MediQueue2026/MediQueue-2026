-- Safe Incremental Database Migration for MediQueue Patient Portal
-- ═══════════════════════════════════════════════════════════════════════════════
-- This script does NOT drop any existing tables or schemas.
-- It safely creates the patient_profiles table and adds required columns.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Create dedicated patient_profiles table linked to users(id)
CREATE TABLE IF NOT EXISTS public.patient_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
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

-- 2. Safely add missing columns to health_records table for digital prescriptions & reports
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS record_type TEXT DEFAULT 'lab_report';
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS issuing_authority TEXT;
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS rx_medications JSONB DEFAULT '[]'::jsonb;

-- 3. Grant table privileges & disable RLS for development testing
GRANT ALL PRIVILEGES ON TABLE public.patient_profiles TO anon, authenticated, service_role, postgres, public;
ALTER TABLE public.patient_profiles DISABLE ROW LEVEL SECURITY;

-- 4. Seed initial profile for test patient (Rajan Mehta)
INSERT INTO public.patient_profiles (user_id, nic, emergency_contact_name, emergency_contact_phone, blood_group, allergies, chronic_conditions)
VALUES ('b1000000-0000-0000-0000-000000000001', '199214500823', 'Sunil Mehta', '0779988776', 'O+', 'Penicillin', 'None')
ON CONFLICT (user_id) DO NOTHING;
