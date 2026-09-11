-- Migration 013: Per-doctor advance-booking window
--
-- Patients could book a doctor on any date, however far out. This adds a
-- rolling "how many days ahead bookings are open" number, managed by the
-- receptionist on the Doctors-tab Hours modal.
--
-- It lives beside `max_appointments_per_hour` on BOTH tables: the per-posting
-- `doctor_center_assignments` row (the source of truth since migration 010) and
-- the legacy `doctors` row (still read as a fallback). Default 7 days.
--
-- Safe to run more than once.

ALTER TABLE public.doctor_center_assignments
  ADD COLUMN IF NOT EXISTS advance_booking_days INT NOT NULL DEFAULT 7
  CHECK (advance_booking_days BETWEEN 1 AND 30);

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS advance_booking_days INT NOT NULL DEFAULT 7
  CHECK (advance_booking_days BETWEEN 1 AND 30);
