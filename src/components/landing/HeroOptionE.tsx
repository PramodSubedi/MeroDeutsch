import { BookOpen, Mic, RefreshCw } from 'lucide-react';
import { useLang } from '../../hooks/useLang';

/**
 * Hero option E — "Floating feature cards".
 *
 * Three overlapping glass cards (A1 modules / Smart review / Speak) with
 * gentle offsets, slight rotations and a float animation — modern and
 * abstract, lighter than full screenshots. The float animation is disabled
 * under prefers-reduced-motion via the injected media query.
 * Guest-safe: presentational only, no links, no auth.
 */
export function HeroOptionE() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  return (
    <div className="relative h-[420px] w-full max-w-[460px]">
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .hero-float-slow { animation: heroFloatY 7s ease-in-out infinite; }
          .hero-float-fast { animation: heroFloatY 5s ease-in-out infinite; }
        }
        @keyframes heroFloatY {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>

      {/* Card 1 — A1 modules (top left) */}
      <div className="hero-float-slow absolute left-0 top-2 z-10 w-64">
        <div className="-rotate-6 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-xl backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/70">
          <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <BookOpen className="h-4 w-4" />
            </span>
            {isDE ? 'A1-Module' : 'A1 modules'}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {['Alphabet', isDE ? 'Zahlen' : 'Numbers', isDE ? 'Artikel' : 'Articles', isDE ? 'Grüße' : 'Greetings'].map(
              (chip) => (
                <span
                  key={chip}
                  className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                >
                  {chip}
                </span>
              )
            )}
          </div>
        </div>
      </div>

      {/* Card 2 — Smart review (right, lower) */}
      <div className="hero-float-fast absolute right-0 top-24 z-20 w-60">
        <div className="rotate-3 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-xl backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/70">
          <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <RefreshCw className="h-4 w-4" />
            </span>
            {isDE ? 'Kluge Wiederholung' : 'Smart review'}
          </p>
          <div className="mt-3 flex items-center justify-between">
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
              {isDE ? '5 fällig' : '5 due'}
            </span>
            <span className="text-[11px] font-medium text-slate-400">{isDE ? 'kommen zurück' : 'come back'}</span>
          </div>
        </div>
      </div>

      {/* Card 3 — Speak (bottom left) */}
      <div className="hero-float-slow absolute bottom-2 left-6 z-30 w-64">
        <div className="-rotate-2 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-xl backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/70">
          <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white">
              <Mic className="h-4 w-4" />
            </span>
            {isDE ? 'Sprechen' : 'Speak'}
          </p>
          <div className="mt-3 flex items-center gap-1">
            {[3, 6, 4, 8, 5, 7, 3, 6, 4].map((h, i) => (
              <span
                key={i}
                className="w-1.5 rounded-full bg-blue-400/80 dark:bg-blue-500/80"
                style={{ height: `${h * 4}px` }}
              />
            ))}
            <span className="ml-2 text-xs font-semibold text-slate-500 dark:text-slate-400">„Guten Tag!“</span>
          </div>
        </div>
      </div>
    </div>
  );
}