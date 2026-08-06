-- MediQueue Database Schema for Supabase / PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT CHECK (role IN ('patient', 'doctor', 'receptionist', 'admin')) NOT NULL DEFAULT 'patient',
  no_show_count INT DEFAULT 0,
  is_flagged_late BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Medical Centers Table
CREATE TABLE IF NOT EXISTS public.medical_centers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude NUMERIC(10,8),
  longitude NUMERIC(11,8),
  opening_hours TEXT NOT NULL,
  services TEXT[] DEFAULT '{}',
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Doctors Table
CREATE TABLE IF NOT EXISTS public.doctors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  center_id UUID REFERENCES public.medical_centers(id) ON DELETE SET NULL,
  specialization TEXT NOT NULL,
  max_appointments_per_hour INT DEFAULT 4, -- Configurable hourly limit (BR-02)
  current_status TEXT CHECK (current_status IN ('active', 'delayed', 'break', 'offline')) DEFAULT 'active',
  delay_minutes INT DEFAULT 0,
  room_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Appointments Table
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE,
  center_id UUID REFERENCES public.medical_centers(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  slot_hour INT NOT NULL CHECK (slot_hour BETWEEN 0 AND 23),
  queue_number INT NOT NULL,
  is_late_number BOOLEAN DEFAULT FALSE, -- Assigned for repeat no-shows (BR-03)
  status TEXT CHECK (status IN ('booked', 'waiting', 'in_consultation', 'completed', 'cancelled', 'no_show')) DEFAULT 'booked',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Doctor Subscriptions Table (BR-05)
CREATE TABLE IF NOT EXISTS public.doctor_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id, doctor_id)
);

-- 6. Health Records Table (FR-09)
CREATE TABLE IF NOT EXISTS public.health_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  notes TEXT,
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
