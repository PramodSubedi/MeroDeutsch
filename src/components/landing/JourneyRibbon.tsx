import { BookA, Flag, LogIn, Zap } from 'lucide-react';
import { useLang } from '../../hooks/useLang';

/**
 * "How it works" journey ribbon (chosen hero concept, formerly option C):
 * four illustrated steps — try as guest → explore A1 modules → sign in free →
 * guided path unlocks — explaining the sign-in gate WITHOUT jargon. One
 * responsive list — a single column on mobile, 2-up on sm, a horizontal 4-up
 * ribbon with connector rail on md+ — so it works as a full-width landing
 * section. The final step is highlighted in brand blue to show what
 * an account adds. Guest-safe: presentational only, no links, no auth.
 */
export function JourneyRibbon() {
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

  const circleCls = (highlight: boolean) =>
    `relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm ${
      highlight
        ? 'bg-accent-600 text-white'
        : 'border border-ink-200 bg-white text-ink-500 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-400'
    }`;

  const cardCls = (highlight: boolean) =>
    `rounded-md border p-3 ${
      highlight
        ? 'border-accent-200 bg-accent-50 dark:border-accent-800 dark:bg-accent-950/40'
        : 'border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-800'
    }`;

  const cardText = (step: (typeof steps)[number], index: number) => (
    <>
      <p
        className={`text-body font-bold ${
          step.highlight ? 'text-accent-700 dark:text-accent-300' : 'text-ink-900 dark:text-white'
        }`}
      >
        <span className="mr-1.5 text-meta font-black text-ink-500">{String(index + 1).padStart(2, '0')}</span>
        {step.title}
      </p>
      <p
        className={`mt-0.5 text-meta ${
          step.highlight ? 'text-accent-700/80 dark:text-accent-300/80' : 'text-ink-500 dark:text-ink-400'
        }`}
      >
        {step.line}
      </p>
    </>
  );

  return (
    <div className="relative w-full max-w-4xl">
      {/* Steps — single column on mobile, 2-up on sm, 4-up ribbon with rail on md+ */}
      <div className="relative">
        <span
          className="absolute left-5 right-5 top-[19px] h-px hidden bg-ink-200 dark:bg-ink-700 md:block"
          aria-hidden="true"
        />
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          {steps.map((step, i) => (
            <li key={step.title} className="relative flex flex-col items-start">
              <span className={circleCls(step.highlight)}>
                <step.icon className="h-5 w-5" />
              </span>
              <div className={`${cardCls(step.highlight)} mt-3 w-full flex-1`}>{cardText(step, i)}</div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}