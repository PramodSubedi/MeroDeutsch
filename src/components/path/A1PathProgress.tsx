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
  /**
   * Suppress the built-in "A1 Path" label. Set when the host already supplies
   * a heading for this component — otherwise the two labels stack and read as
   * a mistake ("YOUR COURSE" sitting directly above "A1 PATH").
   */
  hideLabel?: boolean;
}

export function A1PathProgress({ compact = false, hideLabel = false }: A1PathProgressProps) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { checkpointBestByUnit, isNodeComplete, getUnitPhase } = useA1Path();

  const bands = A1_CURRICULUM.units;

  if (compact) {
    // Compact horizontal strip for sidebar / embedded use.
    return (
      <div className="space-y-2">
        {!hideLabel && (
          <div className="text-meta font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
            {isDE ? 'A1-Fortschritt' : 'A1 Path'}
          </div>
        )}
        <div className="flex items-center gap-1">
          {bands.map((band) => {
            const phase = getUnitPhase(band.index);
            return (
              <span
                key={band.id}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-meta font-bold ${
                  phase === 'current' ? 'bg-accent-100 text-accent-800 dark:bg-accent-900/40' :
                  phase === 'done' ? 'bg-success-100 text-success-800 dark:bg-success-900/40' :
                  band.kind === 'support' ? 'bg-warning-100 text-warning-800 dark:bg-warning-900/40' :
                  'bg-ink-100 text-ink-500 dark:bg-ink-800'
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
    <section className={`${theme.panel.surface} mb-0`}>
      <h2 className="mb-2 text-meta font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
        {isDE ? 'Lernfortschritt' : 'Learning progress'}
      </h2>
      <div className="space-y-2">
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
            badge = <CheckCircle className="h-5 w-5 shrink-0 text-success-600" />;
          } else if (active) {
            badge = (
              <Circle className="h-5 w-5 shrink-0 text-accent-600 fill-accent-100 dark:fill-accent-900/40" />
            );
          } else {
            badge = <Lock className="h-5 w-5 shrink-0 text-ink-500" />;
          }

          return (
            <Link
              key={band.id}
              to="/learn"
              className="block rounded-md border border-ink-200 bg-white p-3 text-start text-decoration-none transition hover:bg-ink-50 dark:border-ink-800 dark:bg-ink-900 dark:hover:bg-ink-800/60 sm:p-3.5"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-meta font-bold ${
                    done
                      ? 'bg-success-100 text-success-700 dark:bg-success-900/40'
                      : active
                        ? 'bg-accent-100 text-accent-700 dark:bg-accent-900/40'
                        : isSupport
                          ? 'bg-warning-100 text-warning-700 dark:bg-warning-900/40'
                          : 'bg-ink-100 text-ink-500 dark:bg-ink-800'
                  }`}
                >
                  {band.code}
                </span>
                <span className="block font-semibold text-ink-950 dark:text-white">
                  {band.title[langMode === 'german' ? 'de' : 'en']}
                </span>
                <span
                  className={`ml-auto text-meta font-semibold ${
                    done
                      ? 'text-success-700 dark:text-success-400'
                      : active
                        ? 'text-accent-700 dark:text-accent-300'
                        : 'text-ink-500 dark:text-ink-400'
                  }`}
                >
                  {isDE
                    ? `${completedNodes}/${totalNodes} Schritte (${pct}%)`
                    : `${completedNodes}/${totalNodes} steps (${pct}%)`}
                </span>
                {badge}
              </div>

              {hasGate && gateLabelReached && (
                <div className="mt-1.5 flex items-center gap-2 text-meta text-ink-600 dark:text-ink-300">
                  <span className="w-32">
                    {isDE ? 'Tor' : 'Gate'}: {ckPct}%
                  </span>
                  <span
                    className={
                      gatePassed
                        ? 'text-success-600 dark:text-success-400'
                        : 'text-warning-600 dark:text-warning-400'
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
                    <span className="-mb-1 h-1.5 w-16 overflow-hidden rounded-sm bg-warning-200 dark:bg-warning-900/40">
                      <span className="block h-full w-1/4 bg-warning-500" />
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