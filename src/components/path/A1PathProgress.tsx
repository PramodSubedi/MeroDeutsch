import { Link } from 'react-router-dom';
import { CheckCircle, Circle, Lock } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { useA1Path } from '../../hooks/useA1Path';
import { A1_CURRICULUM } from '../../data/a1Path';
import { theme } from '../../config/theme';
import type { ReactElement } from 'react';

/**
 * Dashboard unit-wise progress strip: one compact row per band showing
 * step completion x/y, the gate (checkpoint) best score, and a phase icon
 * (done / current / locked). Links into /learn.
 * Reuses useA1Path + A1_CURRICULUM — no new progress state.
 */
interface A1PathProgressProps {
  /** When true, renders a compact horizontal strip (sidebar footer). */
  compact?: boolean;
}

export function A1PathProgress({ compact = false }: A1PathProgressProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { checkpointBestByUnit, isNodeComplete, getUnitPhase } = useA1Path();

  const bands = A1_CURRICULUM.units;

  if (compact) {
    // Compact horizontal strip for sidebar / embedded use.
    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {isDE ? 'A1-Fortschritt' : 'A1 Path'}
        </div>
        <div className="flex items-center gap-1">
          {bands.map((band) => {
            const phase = getUnitPhase(band.index);
            return (
              <span
                key={band.id}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  phase === 'current' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40' :
                  phase === 'done' ? 'bg-green-100 text-green-800 dark:bg-green-900/40' :
                  band.kind === 'support' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40' :
                  'bg-slate-100 text-slate-500 dark:bg-slate-800'
                }`}
                title={isDE ? band.title.de : band.title.en}
                aria-label={isDE ? band.title.de : band.title.en}
              >
                {band.code}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <section className={`${theme.panel.surface} mb-8`}>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {isDE ? 'Lernfortschritt' : 'Learning progress'}
      </h2>
      <div className="space-y-3">
        {bands.map((band) => {
          const phase = getUnitPhase(band.index);
          const done = phase === 'done';
          const active = phase === 'current';
          const isSupport = band.kind === 'support';
          const completedNodes = band.nodeIds.filter((id) => { const n = A1_CURRICULUM.nodeMap[id]; return !!n && isNodeComplete(n); }).length;
          const totalNodes = band.nodeIds.length;
          const pct = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0;
          const ck = band.checkpoint ? checkpointBestByUnit[band.index] : undefined;
          const ckPct = typeof ck === 'number' ? Math.round(ck * 100) : 0;
          const hasGate = !!band.checkpoint;
          const gatePassed = hasGate && ckPct >= 80;
          const gateLabelReached = ck !== undefined;

          let badge: ReactElement;
          if (done) {
            badge = <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />;
          } else if (active) {
            badge = (
              <Circle className="h-5 w-5 shrink-0 text-blue-600 fill-blue-100 dark:fill-blue-900/40" />
            );
          } else {
            badge = <Lock className="h-5 w-5 shrink-0 text-slate-400" />;
          }

          return (
            <Link
              key={band.id}
              to="/learn"
              className="block rounded-xl border border-slate-200 bg-white p-4 text-start text-decoration-none transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    done
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40'
                      : active
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40'
                        : isSupport
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                  }`}
                >
                  {band.code}
                </span>
                <span className="block font-semibold text-slate-950 dark:text-white">
                  {band.title[langMode === 'german' ? 'de' : 'en']}
                </span>
                <span
                  className={`ml-auto text-xs font-semibold ${
                    done
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : active
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {isDE
                    ? `${completedNodes}/${totalNodes} Schritte (${pct}%)`
                    : `${completedNodes}/${totalNodes} steps (${pct}%)`}
                </span>
                {badge}
              </div>

              {hasGate && gateLabelReached && (
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span className="w-32">
                    {isDE ? 'Tor' : 'Gate'}: {ckPct}%
                  </span>
                  <span
                    className={
                      gatePassed
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }
                  >
                    {gatePassed
                      ? isDE
                        ? 'freigeschaltet'
                        : 'unlocked'
                      : isDE
                        ? 'noch nicht'
                        : 'not passed'}
                  </span>
                  {!gatePassed && (
                    <span className="-mb-1 h-1.5 w-16 overflow-hidden rounded bg-amber-200 dark:bg-amber-900/40">
                      <span className="block h-full w-1/4 bg-amber-500" />
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}