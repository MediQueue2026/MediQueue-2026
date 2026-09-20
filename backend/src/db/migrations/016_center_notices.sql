-- Lets a receptionist post notices/promotions for their medical center,
-- with an optional image, visible to patients.
CREATE TABLE IF NOT EXISTS public.center_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.medical_centers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  image_url TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_center_notices_center ON public.center_notices(center_id);
