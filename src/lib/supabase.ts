import { createClient } from '@supabase/supabase-js';

// `import.meta.env` is a Vite INJECTION, absent under bare `tsx` and in any
// non-Vite tool. The two helper modules this guards (`debugModeLink`,
// `debugMode`) already read it defensively for the same reason; doing it here
// too means a pure-logic test can import a module that transitively reaches this
// file without exploding on a missing build-time global.
const env = (import.meta as { env?: Record<string, string | undefined> }).env;
const supabaseUrl = env?.VITE_SUPABASE_URL;
const supabaseAnonKey = env?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Online features will be disabled.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
