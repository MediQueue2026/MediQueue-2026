-- Migration: Add approval_status, requested_by_name, and rejection_reason to doctors table
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

ALTER TABLE public.doctors 
ADD COLUMN IF NOT EXISTS approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved';

ALTER TABLE public.doctors 
ADD COLUMN IF NOT EXISTS requested_by_name TEXT;

ALTER TABLE public.doctors 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Update any existing seed doctor records to 'approved'
UPDATE public.doctors SET approval_status = 'approved' WHERE approval_status IS NULL;
