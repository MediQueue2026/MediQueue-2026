-- Migration 014: Date-specific hours (per-doctor and per-centre overrides)
--
-- Doctor hours were only weekly-recurring (`doctor_center_assignments.available_hours`
-- keyed by day-of-week) and a centre had one static `opening_hours` string. The
-- receptionist had no way to say "on this one future date Dr Perera works
-- 14:00-18:00" or "the centre opens late that day" without changing every
-- future weekday.
--
--  * doctor_date_hours — one row overrides ONE doctor's hours for ONE date at a
--    centre. `is_working = false` means off that day. Creating/updating a row
--    auto-cancels that doctor's appointments that now fall outside the new
--    window (the controller SMSes each patient); `cancelled_count` /
--    `notified_count` record that sweep. Deleting the row reverts to the weekly
--    hours and cancels nothing.
--  * center_date_hours — a display-only opening-hours label for the whole centre
--    on ONE date. Shown on the desk and the patient booking modal; it does not
--    restrict slots.
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.doctor_date_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  center_id UUID NOT NULL REFERENCES public.medical_centers(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  is_working BOOLEAN NOT NULL DEFAULT TRUE,
  start_time TEXT,          -- 'HH:MM'; NULL when is_working = false
  end_time TEXT,
  cancelled_count INT NOT NULL DEFAULT 0,
  notified_count INT NOT NULL DEFAULT 0,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (doctor_id, center_id, work_date)
);
CREATE INDEX IF NOT EXISTS idx_ddh_lookup ON public.doctor_date_hours(center_id, work_date);

CREATE TABLE IF NOT EXISTS public.center_date_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.medical_centers(id) ON DELETE CASCADE,
  open_date DATE NOT NULL,
  hours_label TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (center_id, open_date)
);
CREATE INDEX IF NOT EXISTS idx_cdh_lookup ON public.center_date_hours(center_id, open_date);

GRANT ALL PRIVILEGES ON public.doctor_date_hours TO anon, authenticated, service_role, postgres;
GRANT ALL PRIVILEGES ON public.center_date_hours TO anon, authenticated, service_role, postgres;
ALTER TABLE public.doctor_date_hours DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.center_date_hours DISABLE ROW LEVEL SECURITY;
