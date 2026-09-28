import { createClient } from '@supabase/supabase-js';

/**
 * `import.meta.env` is a Vite INJECTION. It is absent under bare `tsx`, which is
 * what every `npm run check:*` suite runs on, so reading it unguarded threw
 * `TypeError: Cannot read properties of undefined` at MODULE-EVAL time — which
 * takes a whole suite down before its first assertion, and prints a stack trace
 * that looks like a product bug rather than a harness one.
 *
 * It bit two suites through this one module, because both reach the wire at
 * import scope:
 *
 *   check:chatconfig   → data/chatbot/resolve.ts     → flagReader.ts → here
 *   check:currresolve  → data/curriculum/resolveActive.ts → flagReader.ts → here
 *
 * The defensive read is the same one `lib/qaBridge.ts` and `lib/debugModeLink.ts`
 * already use, for the same reason. A feature flag must never be able to take a
 * check down, and neither must a check take the app down.
 */
const env = (import.meta as { env?: Record<string, string | undefined> }).env;
const supabaseUrl = env?.VITE_SUPABASE_URL;
const supabaseAnonKey = env?.VITE_SUPABASE_ANON_KEY;

// Guarded on `env` existing, not merely on the keys being absent. Inside Vite
// this is exactly the old behaviour — warn in dev, fail fast in prod. Outside
// Vite there was never any expectation of credentials to go missing, so warning
// would be noise on every check run rather than a real diagnostic.
if (env && (!supabaseUrl || !supabaseAnonKey)) {
  // Vite injects `PROD` as a real boolean, but the map above is typed for the
  // two STRING vars so `createClient` accepts them. Read it through its own
  // narrow cast rather than pretending a string is a boolean — `"false"` is
  // truthy, and a config check that cannot tell prod from dev is worthless.
  const isProduction = (env as Record<string, unknown>).PROD === true;
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
