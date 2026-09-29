-- MediQueue migration 019: Google OAuth Support & Forgot Password Tokens
-- Safe and additive — does not alter existing data or tables.

-- 1. Add OAuth provider tracking
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'local';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS google_id TEXT;
CREATE INDEX IF NOT EXISTS users_google_id_idx ON public.users (google_id);

-- 2. Add password reset token columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reset_password_token TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reset_password_expires_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS users_reset_token_idx ON public.users (reset_password_token);
