const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://kgrlfdomrclfivhhmnoy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.warn('⚠️ SUPABASE_ANON_KEY is missing. File uploads to Supabase will fail.');
}

let supabase;

if (supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.error('❌ Supabase initialization skipped: Missing SUPABASE_ANON_KEY');
  supabase = null; // Or a mock object if needed
}

module.exports = supabase;
