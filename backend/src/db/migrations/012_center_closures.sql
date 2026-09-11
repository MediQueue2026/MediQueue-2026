-- Migration 012: Per-date medical center closures
--
-- A medical center previously had only a single indefinite `status`
-- ('operational' | 'maintenance' | 'closed') on `medical_centers`, so there was
-- no way to say "this clinic is shut on the 21st for a public holiday" without
-- taking the whole center offline. `createAppointment` had no closure concept at
-- all and would book patients straight onto a holiday.
--
-- Each row here is one closed calendar day for one center. Creating a row is
-- what auto-cancels that day's appointments (the controller SMSes each patient);
-- `cancelled_count` / `notified_count` record what that sweep actually did.
-- Deleting a row re-opens the day for new bookings — it does NOT un-cancel the
-- appointments that were already cancelled.
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.center_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.medical_centers(id) ON DELETE CASCADE,
  closed_date DATE NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  -- Snapshot of the cancel sweep run when this closure was created.
  cancelled_count INT NOT NULL DEFAULT 0,
  notified_count INT NOT NULL DEFAULT 0,
  created_by_name TEXT,
  created_by_role TEXT CHECK (created_by_role IN ('receptionist', 'admin', 'system')) DEFAULT 'receptionist',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One closure per (center, day); a repeat POST is a no-op upsert.
  UNIQUE (center_id, closed_date)
);

-- Booking checks "is this center closed on this date"; the desk lists the next
-- few days for one center. Both are covered by (center_id, closed_date).
CREATE INDEX IF NOT EXISTS idx_center_closures_lookup
  ON public.center_closures(center_id, closed_date);

GRANT ALL PRIVILEGES ON public.center_closures TO anon, authenticated, service_role, postgres;
ALTER TABLE public.center_closures DISABLE ROW LEVEL SECURITY;
