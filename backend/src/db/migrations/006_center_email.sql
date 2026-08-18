-- Migration: Add a contact email to medical_centers
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

ALTER TABLE public.medical_centers
ADD COLUMN IF NOT EXISTS email TEXT;
