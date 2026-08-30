import { BookA, Flag, LogIn, Zap } from 'lucide-react';
import { useLang } from '../../hooks/useLang';

/**
 * Hero option C — "Journey ribbon".
 *
 * Four illustrated steps (try as guest → explore A1 modules → sign in free →
 * guided path unlocks) that explain the sign-in gate WITHOUT jargon. The
 * final step is visually highlighted in brand blue to show what an account
 * adds. Guest-safe: presentational only, no links, no auth.
 */
export function HeroOptionC() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  const steps = [
    {
      icon: Zap,
      title: isDE ? 'Kostenlos als Gast testen' : 'Try as a guest',
      line: isDE ? 'Kein Konto nötig — ein Klick und los.' : 'No account needed — one click and go.',
      highlight: false,
    },
    {
      icon: BookA,
      title: isDE ? 'A1-Module entdecken' : 'Explore A1 modules',
      line: isDE ? 'Alphabet, Zahlen, Artikel, Begrüßungen …' : 'Alphabet, numbers, articles, greetings…',
      highlight: false,
    },
    {
      icon: LogIn,
      title: isDE ? 'Kostenlos anmelden' : 'Sign in free',
      line: isDE ? 'Fortschritt speichern & synchronisieren.' : 'Save your progress and sync it.',
      highlight: false,
    },
    {
      icon: Flag,
      title: isDE ? 'Geführter Lernpfad freigeschaltet' : 'Your guided path unlocks',
      line: isDE ? 'Einheiten, Checkpoints & kluge Wiederholung.' : 'Units, checkpoints & smart review.',
      highlight: true,
    },
  ];

  return (
    <div className="relative w-full max-w-[460px] rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
        {isDE ? 'So funktioniert es' : 'How it works'}
      </p>

      <div className="relative mt-5">
        {/* Connector rail behind the step circles */}
        <span
          className="absolute bottom-5 left-[19px] top-5 w-px bg-slate-200 dark:bg-slate-700"
          aria-hidden="true"
        />

        <ol className="space-y-4">
          {steps.map((step, i) => (
            <li key={step.title} className="relative flex items-start gap-3">
              <span
                className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm ${
                  step.highlight
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                <step.icon className="h-5 w-5" />
              </span>
              <div
                className={`flex-1 rounded-xl border p-3 ${
                  step.highlight
                    ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40'
                    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                }`}
              >
                <p
                  className={`text-sm font-bold ${
                    step.highlight ? 'text-blue-700 dark:text-blue-300' : 'text-slate-900 dark:text-white'
                  }`}
                >
                  <span className="mr-1.5 text-xs font-black text-slate-400">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {step.title}
                </p>
                <p
                  className={`mt-0.5 text-xs ${
                    step.highlight ? 'text-blue-700/80 dark:text-blue-300/80' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {step.line}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}