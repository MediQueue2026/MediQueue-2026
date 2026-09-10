-- Migration 011: Per-doctor delay alerts (BR-05, FR-07)
--
-- A delay was previously only transient state on the doctor's posting
-- (current_status = 'delayed' + delay_minutes), so the moment a doctor went
-- back to 'active' every trace of the notice vanished — nothing for the patient
-- or reception dashboards to display, and no record of who was actually SMSed.
--
-- Each row here is one published delay notice. It stays after the doctor
-- resumes (cleared_at is stamped instead of the row being deleted), which is
-- what makes a readable alert feed possible on both dashboards.
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.delay_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  -- The posting the delay applies to. A doctor working at several centers can
  -- run late at one and be on time at another, so an alert is center-scoped.
  -- NULL means "all of this doctor's postings" (legacy pre-migration-010 rows).
  center_id UUID REFERENCES public.medical_centers(id) ON DELETE SET NULL,
  -- Denormalised so the feed still reads correctly if the doctor row is renamed
  -- or the posting is later removed.
  doctor_name TEXT NOT NULL DEFAULT 'Doctor',
  specialization TEXT,
  room_number TEXT,
  center_name TEXT,
  delay_minutes INT NOT NULL DEFAULT 15 CHECK (delay_minutes >= 0),
  reason TEXT NOT NULL DEFAULT '',
  -- The exact SMS body that went out, kept verbatim for auditing.
  message TEXT,
  notified_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  raised_by_name TEXT,
  raised_by_role TEXT CHECK (raised_by_role IN ('receptionist', 'doctor', 'admin', 'system')) DEFAULT 'doctor',
  -- Stamped when the doctor resumes; a NULL here means the delay is still live.
  cleared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feed queries are always "latest first", scoped by doctor or by center.
CREATE INDEX IF NOT EXISTS idx_delay_alerts_doctor ON public.delay_alerts(doctor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delay_alerts_center ON public.delay_alerts(center_id, created_at DESC);
-- Partial index: the dashboards poll for live alerts every few seconds.
CREATE INDEX IF NOT EXISTS idx_delay_alerts_live ON public.delay_alerts(created_at DESC) WHERE cleared_at IS NULL;

GRANT ALL PRIVILEGES ON public.delay_alerts TO anon, authenticated, service_role, postgres;
ALTER TABLE public.delay_alerts DISABLE ROW LEVEL SECURITY;
