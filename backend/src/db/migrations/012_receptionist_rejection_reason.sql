-- Preserve receptionist accounts after a medical-center request is rejected.
-- The account can display the reason and submit corrected details.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
