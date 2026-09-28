import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const isProduction = import.meta.env.PROD;
  const message = 'Supabase credentials missing. Online features will be disabled.';
  
  if (isProduction) {
    // In production, this is a configuration error - throw to fail fast
    throw new Error(message);
  }
  
  console.warn(message);
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
