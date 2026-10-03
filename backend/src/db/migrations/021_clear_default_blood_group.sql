-- Migration 021: Clear unintended O+ default blood group for patients who didn't choose it
-- ════════════════════════════════════════════════════════════════════════════════════════
-- Allows blood_group to be NULL/empty by default so patients can specify their real blood group.
-- ════════════════════════════════════════════════════════════════════════════════════════

-- Ensure blood_group column allows NULL values
ALTER TABLE public.patient_profiles
  ALTER COLUMN blood_group DROP DEFAULT;

-- Optional: Run if you wish to reset accounts where O+ was auto-populated by default
-- UPDATE public.patient_profiles
--   SET blood_group = NULL
--   WHERE blood_group = 'O+';
