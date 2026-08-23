-- Migration: Create audit_logs table for admin platform activity tracking
-- Run this script in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_name TEXT NOT NULL DEFAULT 'System',
  actor_role TEXT NOT NULL CHECK (actor_role IN ('receptionist', 'patient', 'doctor', 'admin', 'system')) DEFAULT 'system',
  event_type TEXT NOT NULL CHECK (event_type IN (
    'signup',
    'profile_updated',
    'user_suspended',
    'user_activated',
    'user_deleted',
    'doctor_approved',
    'doctor_rejected',
    'center_delete',
    'center_suspend',
    'center_edit',
    'system_warning'
  )) DEFAULT 'system_warning',
  action TEXT NOT NULL,
  center_name TEXT NOT NULL DEFAULT 'Platform',
  status TEXT NOT NULL CHECK (status IN ('approved', 'pending', 'completed', 'rejected')) DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

UPDATE public.audit_logs
SET event_type = CASE event_type
  WHEN 'system' THEN 'system_warning'
  WHEN 'request' THEN 'signup'
  WHEN 'approval' THEN 'doctor_approved'
  WHEN 'approved' THEN 'doctor_approved'
  WHEN 'rejected' THEN 'doctor_rejected'
  WHEN 'delete' THEN 'center_delete'
  WHEN 'suspend' THEN 'user_suspended'
  WHEN 'edit' THEN 'center_edit'
  ELSE event_type
END
WHERE event_type NOT IN (
  'signup',
  'profile_updated',
  'user_suspended',
  'user_activated',
  'user_deleted',
  'doctor_approved',
  'doctor_rejected',
  'center_delete',
  'center_suspend',
  'center_edit',
  'system_warning'
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_role ON public.audit_logs(actor_role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON public.audit_logs(status);

GRANT ALL PRIVILEGES ON TABLE public.audit_logs TO anon, authenticated, service_role, postgres, public;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;
