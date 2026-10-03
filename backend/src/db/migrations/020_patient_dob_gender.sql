-- Migration 020: Add date_of_birth and gender to patient_profiles table
-- ═══════════════════════════════════════════════════════════════════════════
-- Supports patient demographics during signup, dashboard overview, and settings.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT;
