const { createClient } = require('@supabase/supabase-js');

let _client = null;

/**
 * Returns a singleton Supabase client using the service-role key.
 * Throws clearly if env vars are missing so startup fails loudly.
 */
function getSupabaseClient() {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      '[Supabase] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.\n' +
      'Copy .env.example → .env and fill in the values from your Supabase project settings.'
    );
  }

  _client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession:   false,
    },
  });

  console.log('[Supabase] Client initialised for', url);
  return _client;
}

module.exports = { getSupabaseClient };