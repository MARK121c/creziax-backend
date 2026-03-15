const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://kgrlfdomrclfivhhmnoy.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Regular anon client (for auth)
const supabase = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey);

// Admin client using service_role (bypasses RLS for storage uploads)
// Falls back to anon client if service key not set
const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : supabase;

if (!supabaseAnonKey) {
  console.warn('⚠️ SUPABASE_ANON_KEY is missing.');
}
if (!supabaseServiceKey) {
  console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY is missing. Storage uploads will use anon key (may be blocked by RLS).');
}

module.exports = { supabase, supabaseAdmin };
