import { Globe } from 'lucide-react';
import { AppHomePreview } from '../pages/AppHomePreview';

/**
 * `HeroMock` — a browser-window frame that renders a compact, live preview of
 * the MeroDeutsch Home surface in the landing-page hero (desktop only).
 *
 * `variant` corresponds to the `?hero=` URL param on `/welcome`:
 *   A = default guest Home weekly-loop (Warm-up / Push / Challenge)
 *   B = A1 article gender practice
 *   C = speaking / role-play
 *   D = smart review queue
 *   E = Rapid Blitz
 *
 * The preview is guest-safe: it never touches auth state and renders mock
 * data so `/welcome` stays a brochure. Real behaviour lives in GuestHomePage.
 */
export function HeroMock({
  variant,
  isDE,
  eyebrow,
}: {
  variant: 'A' | 'B' | 'C' | 'D' | 'E';
  isDE: boolean;
  eyebrow: string;
}) {
  return (
    <div className="relative w-[340px] rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
      {/* Browser chrome (title bar + traffic lights) */}
      <div className="flex items-center justify-between rounded-t-xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-400" />
          <span className="h-3 w-3 rounded-full bg-yellow-400" />
          <span className="h-3 w-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">merodeutsch.app</p>
        </div>
        <div className="w-12" />
      </div>

      {/* Preview body */}
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
            <Globe className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {eyebrow}
            </p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {variant === 'A'
                ? (isDE ? 'Guten Tag! 👋' : 'Welcome back! 👋')
                : (isDE ? 'Artikel-Übung' : 'Article practice')}
            </p>
          </div>
        </div>

        {/* The live, guest-safe preview surface */}
        <AppHomePreview />
      </div>

      {/* Bottom status hint for the variant */}
      <div className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-right dark:border-slate-700 dark:bg-slate-800">
        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          {variant === 'A'
            ? (isDE ? 'Gast-Modus — Kostenlos starten' : 'Guest mode — start free')
            : (isDE ? `Variante ${variant}` : `Variant ${variant}`)}
        </p>
      </div>
    </div>
  );
}
