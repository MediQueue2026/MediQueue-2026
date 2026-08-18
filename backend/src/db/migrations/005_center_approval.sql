-- Migration: Add approval workflow to medical_centers (Receptionist -> Super Admin)
-- A receptionist is the admin/manager of exactly one medical center, so a
-- receptionist-created center starts 'pending' and the receptionist may not
-- sign in until their center is approved.
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

ALTER TABLE public.medical_centers
ADD COLUMN IF NOT EXISTS approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved';

ALTER TABLE public.medical_centers
ADD COLUMN IF NOT EXISTS requested_by_name TEXT;

ALTER TABLE public.medical_centers
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Existing centers were created directly by admins — treat them as already approved.
UPDATE public.medical_centers SET approval_status = 'approved' WHERE approval_status IS NULL;

-- Links a receptionist to the single medical center they manage.
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS center_id UUID REFERENCES public.medical_centers(id) ON DELETE SET NULL;
