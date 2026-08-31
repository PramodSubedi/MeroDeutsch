import { Check, X } from 'lucide-react';
import { useLang } from '../../hooks/useLang';

/**
 * Hero option D — "Split benefit panel".
 *
 * Marketing clarity over product UI: grey "typical apps" list vs. colored
 * "With MeroDeutsch" checklist. No app chrome needed.
 * Guest-safe: presentational only, no links, no auth.
 */
export function HeroOptionD() {
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
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
          {isDE ? 'Übliche Apps' : 'Typical apps'}
        </p>
        <ul className="mt-4 space-y-3">
          {without.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-slate-500 dark:text-slate-400">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700">
                <X className="h-3 w-3 text-slate-500 dark:text-slate-400" />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* With MeroDeutsch */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-lg shadow-blue-600/10 dark:border-blue-800 dark:bg-blue-950/40">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-500 dark:text-blue-400">MeroDeutsch</p>
        <ul className="mt-4 space-y-3">
          {withUs.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm font-medium text-slate-800 dark:text-slate-100">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600">
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