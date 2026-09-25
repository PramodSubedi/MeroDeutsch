import { Check, X } from 'lucide-react';
import { useLang } from '../../hooks/useLang';

/**
 * Hero option D — "Split benefit panel".
 *
 * Marketing clarity over product UI: grey "typical apps" list vs. colored
 * "With MeroDeutsch" checklist. No app chrome needed.
 * Guest-safe: presentational only, no links, no auth.
 */
export function BenefitsPanel() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  const without = [
    isDE ? 'Zufällige Lektions-Menüs' : 'Random lesson menus',
    isDE ? 'Keine nepalesische Hilfe' : 'No Nepali support',
    isDE ? 'Fehler werden vergessen' : 'Mistakes get forgotten',
    isDE ? 'Fortschritt geht verloren' : 'Progress gets lost',
  ];

  const withUs = [
    isDE ? 'Geführter A1-Pfad mit Checkpoints' : 'Guided A1 path with checkpoints',
    isDE ? 'Nepali + Englisch Brücken' : 'Nepali + English bridges',
    isDE ? 'Kluge Wiederholung der Fehler' : 'Smart review of your misses',
    isDE ? 'Fortschritt gespeichert & synchron' : 'Progress saved & synced',
  ];

  return (
    <div className="grid w-full max-w-4xl gap-4 sm:grid-cols-2">
      {/* Without */}
      <div className="rounded-lg border border-ink-200 bg-ink-50 p-6 shadow-sm dark:border-ink-700 dark:bg-ink-800/60">
        <p className="text-meta font-bold uppercase tracking-[0.16em] text-ink-500">
          {isDE ? 'Übliche Apps' : 'Typical apps'}
        </p>
        <ul className="mt-4 space-y-3">
          {without.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-body text-ink-500 dark:text-ink-400">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-200 dark:bg-ink-700">
                <X className="h-3 w-3 text-ink-500 dark:text-ink-400" />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* With MeroDeutsch */}
      <div className="rounded-lg border border-accent-200 bg-accent-50 p-6 shadow-lg shadow-accent-600/10 dark:border-accent-800 dark:bg-accent-950/40">
        <p className="text-meta font-bold uppercase tracking-[0.16em] text-accent-500 dark:text-accent-400">MeroDeutsch</p>
        <ul className="mt-4 space-y-3">
          {withUs.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-body font-medium text-ink-800 dark:text-ink-100">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-600">
                <Check className="h-3 w-3 text-white" />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}