-- Migration 004: Add available_hours to public.doctors
-- Allows storing doctor scheduling hours (JSONB structure per day of week)

ALTER TABLE public.doctors
ADD COLUMN IF NOT EXISTS available_hours JSONB DEFAULT '{
  "mon": {"available": true, "start": "09:00", "end": "17:00"},
  "tue": {"available": true, "start": "09:00", "end": "17:00"},
  "wed": {"available": true, "start": "09:00", "end": "17:00"},
  "thu": {"available": true, "start": "09:00", "end": "17:00"},
  "fri": {"available": true, "start": "09:00", "end": "17:00"},
  "sat": {"available": false, "start": "09:00", "end": "13:00"},
  "sun": {"available": false, "start": "09:00", "end": "13:00"}
}'::jsonb;
