-- Migration: Create doctor_requests table for Receptionist -> Super Admin Doctor Approval flow
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

CREATE TABLE IF NOT EXISTS public.doctor_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type TEXT NOT NULL CHECK (request_type IN ('ASSIGN_EXISTING', 'REGISTER_NEW')),
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

-- Indexes for efficient querying by status and center
CREATE INDEX IF NOT EXISTS idx_doctor_requests_status ON public.doctor_requests(status);
CREATE INDEX IF NOT EXISTS idx_doctor_requests_center ON public.doctor_requests(center_id);
CREATE INDEX IF NOT EXISTS idx_doctor_requests_created ON public.doctor_requests(created_at DESC);
