import { BarChart3, BookOpen, Languages, MessagesSquare, Mic, RefreshCw } from 'lucide-react';
import { useLang } from '../../hooks/useLang';

/**
 * Hero visual — "Floating feature cards" (chosen hero concept, formerly
 * hero option E). Six overlapping glass cards in a staggered two-column
 * collage: A1 modules / Speak / Stats & progress (left) and Smart review /
 * Conversation role-play / Guidance in English + Nepali (right). Gentle
 * offsets, slight rotations and a float animation — disabled under
 * prefers-reduced-motion via the injected media query.
 * Guest-safe: presentational only, no links, no auth.
 */
export function HeroOptionE() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  const shell =
    'rounded-2xl border border-white/60 bg-white/70 p-4 shadow-xl backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/70';

  return (
    <div className="relative h-[500px] w-full max-w-[540px]">
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

      {/* Left column — A1 modules / Speak / Stats */}
      <div className="absolute left-0 top-0 z-10 w-[48.5%] space-y-5">
        {/* A1 modules */}
        <div className="hero-float-slow">
          <div className={`${shell} -rotate-2`}>
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
                ),
              )}
            </div>
          </div>
        </div>

        {/* Speak */}
        <div className="hero-float-fast">
          <div className={`${shell} rotate-2`}>
            <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white">
                <Mic className="h-4 w-4" />
              </span>
              {isDE ? 'Sprechen' : 'Speak'}
            </p>
            <div className="mt-3 flex items-center gap-1">
              {[3, 6, 4, 8, 5, 7, 3, 6].map((h, i) => (
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

        {/* Stats & progress */}
        <div className="hero-float-slow">
          <div className={`${shell} -rotate-2`}>
            <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
                <BarChart3 className="h-4 w-4" />
              </span>
              {isDE ? 'Statistik & Fortschritt' : 'Stats & progress'}
            </p>
            <div className="mt-3 flex items-end justify-between gap-2">
              <span className="flex items-end gap-1" aria-hidden="true">
                {[5, 8, 6, 9, 7].map((h, i) => (
                  <span key={i} className="w-1.5 rounded-t bg-amber-400" style={{ height: `${h * 4}px` }} />
                ))}
              </span>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                {isDE ? '12-Tage-Serie' : '12-day streak'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right column, offset down — Smart review / Role-play / EN+NE guidance */}
      <div className="absolute right-0 top-8 z-20 w-[48.5%] space-y-5">
        {/* Smart review */}
        <div className="hero-float-fast">
          <div className={`${shell} rotate-2`}>
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

        {/* Conversation role-play */}
        <div className="hero-float-slow">
          <div className={`${shell} -rotate-2`}>
            <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white">
                <MessagesSquare className="h-4 w-4" />
              </span>
              {isDE ? 'Gesprächs-Rollenspiele' : 'Conversation role-play'}
            </p>
            <div className="mt-3 space-y-1.5">
              <p className="w-fit rounded-lg rounded-bl-none bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800 dark:bg-blue-950/60 dark:text-blue-200">
                „Wie geht’s?“
              </p>
              <p className="ml-auto w-fit rounded-lg rounded-br-none bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-800 dark:bg-violet-950/60 dark:text-violet-200">
                म ठीक छु, धन्यवाद!
              </p>
            </div>
          </div>
        </div>

        {/* Guidance in English + Nepali */}
        <div className="hero-float-fast">
          <div className={`${shell} rotate-2`}>
            <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white">
                <Languages className="h-4 w-4" />
              </span>
              {isDE ? 'Hilfe: Englisch + Nepali' : 'Guidance: English + Nepali'}
            </p>
            <div className="mt-3 space-y-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              <p className="flex items-center gap-1.5">
                <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-900/60 dark:text-sky-300">
                  EN
                </span>
                the table
              </p>
              <p className="flex items-center gap-1.5">
                <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-900/60 dark:text-sky-300">
                  ने
                </span>
                टेबल · der Tisch
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}