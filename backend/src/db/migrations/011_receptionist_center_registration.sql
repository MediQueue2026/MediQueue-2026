-- Receptionist-only medical-center registration details.
-- Existing centers remain valid; new receptionist requests collect these fields.

-- Approval columns are included here as a safe prerequisite. Existing rows
-- receive the approved default; no existing approval is downgraded or deleted.
ALTER TABLE public.medical_centers
  ADD COLUMN IF NOT EXISTS approval_status TEXT
    CHECK (approval_status IN ('pending', 'approved', 'rejected'))
    DEFAULT 'approved';

ALTER TABLE public.medical_centers
  ADD COLUMN IF NOT EXISTS requested_by_name TEXT;

ALTER TABLE public.medical_centers
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE public.medical_centers
  ADD COLUMN IF NOT EXISTS registration_number TEXT;

ALTER TABLE public.medical_centers
  ADD COLUMN IF NOT EXISTS license_status TEXT
    CHECK (license_status IN ('active', 'pending', 'expired', 'suspended'));

ALTER TABLE public.medical_centers
  ADD COLUMN IF NOT EXISTS province TEXT;

ALTER TABLE public.medical_centers
  ADD COLUMN IF NOT EXISTS website TEXT;
