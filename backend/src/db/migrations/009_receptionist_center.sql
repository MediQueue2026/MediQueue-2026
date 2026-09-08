-- Migration: Link the demo receptionist to a medical center, and give that
-- center a doctor, so the (now center-scoped) Reception Desk has data to show.
--
-- The Reception Desk only lists doctors assigned to the receptionist's own
-- medical center (users.center_id, migration 005). Accounts with no center see
-- an empty roster. The seeded demo receptionist (reception@mediqueue.io, from
-- migration 004) had no center, so this backfills one.
--
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Ensure the "MediQueue Central Clinic" row exists. This is the same id the
--    API has long used as its fallback center, so nothing else has to change.
--    (No `status` column here — this table doesn't carry one; the API defaults
--    it to 'operational' on read.)
INSERT INTO public.medical_centers (id, name, address, city, opening_hours, services, phone, email, approval_status)
VALUES (
  'a1000000-0000-0000-0000-000000000001',
  'MediQueue Central Clinic',
  '124 Medical Plaza',
  'Colombo 07',
  '08:00 - 20:00',
  ARRAY['Cardiology', 'General Medicine', 'Pediatrics'],
  '0112345678',
  'central@mediqueue.io',
  'approved'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Link the demo receptionist to that center (only if not already linked).
UPDATE public.users
   SET center_id  = 'a1000000-0000-0000-0000-000000000001',
       updated_at = NOW()
 WHERE LOWER(email) = 'reception@mediqueue.io'
   AND center_id IS NULL;

-- 3. Assign the demo doctor to that center so the scoped roster isn't empty.
UPDATE public.doctors AS d
   SET center_id = 'a1000000-0000-0000-0000-000000000001'
  FROM public.users AS u
 WHERE d.user_id = u.id
   AND LOWER(u.email) = 'dr.carr@mediqueue.io'
   AND d.center_id IS NULL;
