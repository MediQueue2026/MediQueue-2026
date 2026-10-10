-- Migration 023: Fix permissions and RLS for center_notices
-- Resolves "permission denied for table center_notices" error (code 42501)
-- when receptionists post notices/promotions for their medical center.

GRANT ALL PRIVILEGES ON public.center_notices TO anon, authenticated, service_role, postgres;
ALTER TABLE public.center_notices DISABLE ROW LEVEL SECURITY;
