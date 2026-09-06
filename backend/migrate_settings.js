import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { error: err1 } = await supabase.rpc('exec_sql', { sql: `
    CREATE TABLE IF NOT EXISTS public.system_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    GRANT ALL PRIVILEGES ON TABLE public.system_settings TO anon, authenticated, service_role, postgres, public;
    ALTER TABLE public.system_settings DISABLE ROW LEVEL SECURITY;
    INSERT INTO public.system_settings (id, maintenance_mode) VALUES ('f1000000-0000-0000-0000-000000000001', false) ON CONFLICT DO NOTHING;
  ` });
  
  if (err1) {
    console.log('Error or no exec_sql RPC found. To proceed, please run the SQL manually in Supabase.');
    console.log(err1);
  } else {
    console.log('Migration successful');
  }
}
run();
