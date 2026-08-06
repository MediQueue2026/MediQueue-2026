import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load backend/.env file regardless of current working directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const anonKey = (process.env.SUPABASE_ANON_KEY || '').trim();

const supabaseKey = serviceRoleKey || anonKey || 'placeholder-key';

if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
  console.warn('⚠️ Warning: SUPABASE_URL is missing or using placeholder in backend/.env');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
