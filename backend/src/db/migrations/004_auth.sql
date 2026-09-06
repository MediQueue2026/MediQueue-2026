-- MediQueue migration 003: real staff + patient authentication
--
-- Additive only — safe to run against the live database from schema.sql and
-- migration 002. Does NOT drop or touch existing tables/rows. Run this once in
-- the Supabase SQL Editor (Project → SQL Editor → New query → paste → Run).
--
-- Replaces the previous mock sign-in (any email, no password) with real
-- credentials: bcrypt password hashes, short-lived JWT access tokens, rotating
-- refresh sessions, account suspension, and an audit trail of every login
-- attempt. Ported from the QueueManagementProto auth module.

-- pgcrypto gives us crypt()/gen_salt('bf') so the seeded demo passwords below
-- are hashed by the database itself — no plaintext password ever lands in this
-- file, and the resulting $2a$ hashes verify against bcryptjs in the API.
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Credential + account-state columns on users
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active     BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url    TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Email is the login identifier — match it case-insensitively so
-- "Reception@MediQueue.io" and "reception@mediqueue.io" are the same account.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON public.users (LOWER(email));

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Refresh sessions — one row per signed-in device
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The API stores a hash of each refresh token, never the token itself. Rotation
-- deletes the old row and inserts a new one, so a stolen-and-replayed refresh
-- token finds nothing to match and is rejected. Deleting a user's rows is
-- "sign out everywhere".

CREATE TABLE IF NOT EXISTS public.refresh_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- bcrypt hash of the refresh token (jti is the token's own identifier)
  token_hash TEXT NOT NULL,
  jti        UUID NOT NULL UNIQUE,
  user_agent TEXT,
  ip_address TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS refresh_sessions_user_idx    ON public.refresh_sessions (user_id);
CREATE INDEX IF NOT EXISTS refresh_sessions_expires_idx ON public.refresh_sessions (expires_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Login audit log — every attempt, successful or not
-- ═══════════════════════════════════════════════════════════════════════════
--
-- user_id is nullable on purpose: a failed attempt against an unknown email has
-- no user to point at, and those rows are exactly the ones worth keeping.

CREATE TABLE IF NOT EXISTS public.login_audit_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  email          TEXT NOT NULL,
  role           TEXT,
  ip_address     TEXT,
  user_agent     TEXT,
  status         TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  failure_reason TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS login_audit_log_email_idx   ON public.login_audit_log (LOWER(email));
CREATE INDEX IF NOT EXISTS login_audit_log_created_idx ON public.login_audit_log (created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Permissions + RLS (same prototype posture as schema.sql)
-- ═══════════════════════════════════════════════════════════════════════════

GRANT ALL PRIVILEGES ON TABLE public.refresh_sessions TO anon, authenticated, service_role, postgres;
GRANT ALL PRIVILEGES ON TABLE public.login_audit_log  TO anon, authenticated, service_role, postgres;

ALTER TABLE public.refresh_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_audit_log  DISABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Seed passwords for the demo accounts from schema.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️  DEMO CREDENTIALS — every seeded account below gets the same password:
--
--         MediQueue@2026
--
--     These exist so the team can sign in to a fresh database. Change them
--     before this touches anything real:
--         UPDATE public.users
--            SET password_hash = crypt('<new password>', gen_salt('bf', 12))
--          WHERE email = 'admin@mediqueue.io';
--
-- Only fills accounts that have no password yet, so re-running this migration
-- never resets a password somebody has already changed.

-- One demo account per role, so the "Use demo account" button on each login
-- portal signs in through the real login path against a real row. Created only
-- if missing, so a database seeded from schema.sql keeps its existing users.
INSERT INTO public.users (email, full_name, phone, role)
VALUES
  ('patient@mediqueue.io',   'Rajan Mehta',           '0771234567', 'patient'),
  ('dr.carr@mediqueue.io',   'Dr. Ethan Carr',        '0779876543', 'doctor'),
  ('reception@mediqueue.io', 'Chamari Silva',         '0751122334', 'receptionist'),
  ('admin@mediqueue.io',     'System Administrator',  '0709988776', 'admin')
ON CONFLICT (email) DO NOTHING;

-- A demo account's role is part of its definition: the "Sign in as demo" button
-- on the admin portal is broken the moment admin@mediqueue.io stops being an
-- admin, and it fails confusingly — the sign-in succeeds, then the route guard
-- redirects to whatever console that role does own. Re-assert the four demo
-- roles so re-running this migration repairs that drift.
-- Scoped to these four addresses only; no other account's role is touched.
UPDATE public.users AS u
   SET role       = v.role,
       updated_at = NOW()
  FROM (VALUES
         ('patient@mediqueue.io',   'patient'),
         ('dr.carr@mediqueue.io',   'doctor'),
         ('reception@mediqueue.io', 'receptionist'),
         ('admin@mediqueue.io',     'admin')
       ) AS v(email, role)
 WHERE LOWER(u.email) = v.email
   AND u.role IS DISTINCT FROM v.role;

UPDATE public.users
   SET password_hash = crypt('MediQueue@2026', gen_salt('bf', 12)),
       updated_at    = NOW()
 WHERE password_hash IS NULL
   AND email IN (
     'patient@mediqueue.io',
     'dr.carr@mediqueue.io',
     'dr.patel@mediqueue.io',
     'reception@mediqueue.io',
     'admin@mediqueue.io'
   );

-- A doctor account is only usable at the Reception Desk once it has a row in
-- `doctors` carrying its room and token series, so make sure the demo doctor
-- has one. Series letters are assigned in creation order (A, B, C, …).
INSERT INTO public.doctors (user_id, specialization, room_number, current_status, series)
SELECT u.id, 'General Medicine', 'Room 04', 'active',
       CHR(64 + (SELECT COUNT(*) + 1 FROM public.doctors)::int)
  FROM public.users u
 WHERE u.email = 'dr.carr@mediqueue.io'
   AND NOT EXISTS (SELECT 1 FROM public.doctors d WHERE d.user_id = u.id);

-- Accounts that never got a password can't be signed into; that's the safe
-- default, and the API reports it as invalid credentials rather than leaking
-- which emails exist.
