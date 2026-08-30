import { useState } from 'react';
import { HeroOptionA } from './HeroOptionA';
import { HeroOptionB } from './HeroOptionB';
import { HeroOptionC } from './HeroOptionC';
import { HeroOptionD } from './HeroOptionD';
import { HeroOptionE } from './HeroOptionE';

/**
 * Landing hero visual — switchable concept slot (options A–E).
 *
 * Variant resolution order:
 *   1. `?hero=A..E` URL param (review override; the param is stripped from
 *      the address bar after being read so shared links stay clean)
 *   2. `VITE_LANDING_HERO` env var (deployment default) — NOTE: Vite only
 *      exposes VITE_-prefixed env vars to client code
 *   3. 'A' (app-frame collage)
 *
 * The five concepts render in the SAME right-hand slot of the landing hero;
 * the left-column copy is untouched. Once a winner is picked, the losing
 * option files can be deleted and this switch collapsed to one import.
 */
const VARIANTS = ['A', 'B', 'C', 'D', 'E'] as const;

export type HeroVariant = (typeof VARIANTS)[number];

function isVariant(value: unknown): value is HeroVariant {
  return typeof value === 'string' && (VARIANTS as readonly string[]).includes(value);
}

function resolveInitialVariant(): HeroVariant {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('hero');
    if (isVariant(fromUrl)) {
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
      return fromUrl;
    }
  } catch {
    /* non-browser or restricted environment — fall through */
  }
  const fromEnv = import.meta.env.VITE_LANDING_HERO;
  if (isVariant(fromEnv)) return fromEnv;
  return 'A';
}

export function LandingHero() {
  const [variant] = useState<HeroVariant>(resolveInitialVariant);

  return (
    <div className="relative min-h-[440px]">
      {/* Review aid — shows which concept is on screen (?hero=A..E) */}
      <span className="absolute -top-3 right-1 z-10 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        Hero option {variant}
      </span>
      {variant === 'A' && <HeroOptionA />}
      {variant === 'B' && <HeroOptionB />}
      {variant === 'C' && <HeroOptionC />}
      {variant === 'D' && <HeroOptionD />}
      {variant === 'E' && <HeroOptionE />}
    </div>
  );
}