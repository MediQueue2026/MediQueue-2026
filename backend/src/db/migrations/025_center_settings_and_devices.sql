-- Migration 025: Center Settings, Feature Flags, and Clinic Devices
--
-- Supports:
-- 1. Center-level feature flags, custom branding, and printer configurations
-- 2. Device pairing and enrollment for TV Displays, Reception Desks, and Kiosks

-- ==============================================================================
-- PART 1: Center Settings & Feature Flags
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.center_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.medical_centers(id) ON DELETE CASCADE,
  plan VARCHAR(50) DEFAULT 'standard', -- 'listing_only', 'basic', 'standard', 'premium'
  is_listed_publicly BOOLEAN DEFAULT true, -- Allows private internal clinics to be hidden from search
  features JSONB DEFAULT '{
    "walk_in_tokens": true,
    "online_booking": true,
    "health_records": true,
    "sms_notifications": true,
    "tv_display": true,
    "kiosk_checkin": false,
    "billing_invoicing": false,
    "pharmacy_inventory": false
  }'::jsonb,
  custom_branding JSONB DEFAULT '{
    "logo_url": null,
    "accent_color": "#0D9488",
    "ticket_header": "MediQueue Clinic Token",
    "ticket_footer": "Thank you for waiting patiently"
  }'::jsonb,
  printer_config JSONB DEFAULT '{
    "auto_print": false,
    "paper_width": "80mm"
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_center_settings_center UNIQUE(center_id)
);

-- ==============================================================================
-- PART 2: Enrolled Clinic Devices (TV Displays, Reception Stations, Kiosks)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.center_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.medical_centers(id) ON DELETE CASCADE,
  device_name VARCHAR(100) NOT NULL, -- e.g., 'Reception Front Desk 01', 'Waiting Room TV 55in'
  device_role VARCHAR(50) NOT NULL, -- 'reception', 'doctor', 'tv_display', 'kiosk'
  pairing_code VARCHAR(12) UNIQUE, -- 6-digit code for quick enrollment
  device_token VARCHAR(255) UNIQUE, -- persistent device auth secret
  is_active BOOLEAN DEFAULT true,
  last_heartbeat TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb, -- browser, OS, screen resolution
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- PART 3: Indexes & Performance
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_center_settings_center ON public.center_settings(center_id);
CREATE INDEX IF NOT EXISTS idx_center_devices_center ON public.center_devices(center_id);
CREATE INDEX IF NOT EXISTS idx_center_devices_token ON public.center_devices(device_token);
CREATE INDEX IF NOT EXISTS idx_center_devices_pairing ON public.center_devices(pairing_code);

-- ==============================================================================
-- PART 4: Row Level Security & Permissions
-- ==============================================================================
ALTER TABLE public.center_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.center_devices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'center_settings' AND policyname = 'service_role_center_settings_policy'
  ) THEN
    CREATE POLICY service_role_center_settings_policy ON public.center_settings
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'center_devices' AND policyname = 'service_role_center_devices_policy'
  ) THEN
    CREATE POLICY service_role_center_devices_policy ON public.center_devices
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'center_settings' AND policyname = 'public_read_center_settings'
  ) THEN
    CREATE POLICY public_read_center_settings ON public.center_settings
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

GRANT ALL ON public.center_settings TO postgres, service_role;
GRANT ALL ON public.center_devices TO postgres, service_role;
GRANT SELECT ON public.center_settings TO anon, authenticated;
