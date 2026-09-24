-- Migration 017: Add CREATE_NEW support to doctor_requests
-- Adds slmc_reg_no column and updates the request_type check to include 'CREATE_NEW'
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- 1. Add slmc_reg_no column to doctor_requests
ALTER TABLE public.doctor_requests
  ADD COLUMN IF NOT EXISTS slmc_reg_no TEXT;

-- 2. Add slmc_reg_no column to doctors table (if not already present)
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS slmc_reg_no TEXT;

-- 3. Allow 'CREATE_NEW' as a valid request_type
--    (We drop and re-add the CHECK constraint since Postgres doesn't support ALTER CONSTRAINT inline)
ALTER TABLE public.doctor_requests
  DROP CONSTRAINT IF EXISTS doctor_requests_request_type_check;

ALTER TABLE public.doctor_requests
  ADD CONSTRAINT doctor_requests_request_type_check
    CHECK (request_type IN ('ASSIGN_EXISTING', 'REGISTER_NEW', 'CREATE_NEW'));

-- 4. Add target_doctor_user_id column to store the newly created user's ID on approval
ALTER TABLE public.doctor_requests
  ADD COLUMN IF NOT EXISTS target_doctor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
