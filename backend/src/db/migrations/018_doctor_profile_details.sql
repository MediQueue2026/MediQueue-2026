-- Migration 018: Add Extended Doctor Profile Fields and Center Joined Date
-- Run this script in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- 1. Add personal and professional profile columns to doctors table
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS slmc_reg_no TEXT,
  ADD COLUMN IF NOT EXISTS qualifications TEXT,
  ADD COLUMN IF NOT EXISTS experience_start_year INT,
  ADD COLUMN IF NOT EXISTS years_of_experience INT,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS nic TEXT;

-- 2. Add center-specific joined date to doctor_center_assignments table
ALTER TABLE public.doctor_center_assignments
  ADD COLUMN IF NOT EXISTS joined_date DATE DEFAULT CURRENT_DATE;

-- 3. Add extended fields to doctor_requests table (for pending requests)
ALTER TABLE public.doctor_requests
  ADD COLUMN IF NOT EXISTS slmc_reg_no TEXT,
  ADD COLUMN IF NOT EXISTS qualifications TEXT,
  ADD COLUMN IF NOT EXISTS experience_start_year INT,
  ADD COLUMN IF NOT EXISTS years_of_experience INT,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS nic TEXT,
  ADD COLUMN IF NOT EXISTS joined_date DATE DEFAULT CURRENT_DATE;
