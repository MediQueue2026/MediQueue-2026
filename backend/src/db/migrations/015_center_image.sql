-- Adds an optional profile photo to medical_centers, shown on the
-- receptionist's "Medical Center Profile" page and the patient-facing
-- center detail views.
ALTER TABLE public.medical_centers
  ADD COLUMN IF NOT EXISTS image_url TEXT;
