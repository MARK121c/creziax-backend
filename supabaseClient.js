const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://kgrlfdomrclfivhhmnoy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.warn('⚠️ SUPABASE_ANON_KEY is missing. File uploads to Supabase will fail.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
