-- Migration 024: Enable Row Level Security (RLS) & Configure Table Privileges
-- 
-- 1. Resolves Supabase Security Advisor vulnerability: rls_disabled_in_public
-- 2. Solves the October 30 Supabase policy change for new tables automatically

-- ==============================================================================
-- PART 1: Enable RLS on all existing tables to block direct public PostgREST abuse
-- ==============================================================================
ALTER TABLE IF EXISTS public.medical_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.center_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.doctor_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.doctor_center_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.walk_in_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.doctor_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.delay_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.center_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.doctor_date_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.center_date_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.patient_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.refresh_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.login_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.center_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.center_admin_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.center_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.center_devices ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- PART 2: Permanent fix for October 30 policy change
-- Automatically grant full permissions on any future tables to service_role
-- ==============================================================================
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT ALL ON TABLES TO service_role, postgres;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT ALL ON SEQUENCES TO service_role, postgres;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT ALL ON FUNCTIONS TO service_role, postgres;

-- Ensure all existing tables and sequences have full grants for service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role, postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role, postgres;
