/**
 * src/components/path/UnitSpine.tsx
 *
 * The /learn campaign: a VERTICAL LINEAR spine of 5 A1 units (index 0..4).
 * Replaces the flat module grid on /learn only (Home keeps its discoverability
 * grid). Each unit card shows its ordered nodes (Learn -> Practice ->
 * Checkpoint), optional bonus chips that never gate, and the pedagogical
 * bridges required by the guide (honorifics table, gender legend/tokens,
 * EN/NE/DE word-order panel).
 *
 * Layout (daisyUI-timeline-inspired, pure Tailwind): units hang on a LEFT RAIL
 * with connector lines and numbered node markers so the linear "path" reads at
 * a glance on mobile and desktop. Fluid spacing (p-4 -> p-6) keeps density
 * right across breakpoints. All interactive targets >=44px; primary CTAs use
 * active:scale-95 (E1.4).
 *
 * Locked/current/done state comes from useA1Path. Deep links to lesson routes
 * still load (soft lock = unit unlock, not 404).
 */

import { Link } from 'react-router-dom';
import { useLang } from '../../hooks/useLang';
import { useA1Path } from '../../hooks/useA1Path';
import { useAuth } from '../../hooks/useAuth';
import { A1_UNITS, A1_CURRICULUM, type PathNode } from '../../data/a1Path';
import { PathNodeItem } from './PathNode';
import { HonorificsTable } from '../grammar/HonorificsTable';
import { GrammarComparisonTable } from '../grammar/GrammarComparisonTable';
import { GenderBadge } from '../ui/GenderBadge';

function resolveNodes(unitIndex: number): PathNode[] {
  const unit = A1_UNITS[unitIndex];
  if (!unit) return [];
  return unit.nodeIds
    .map((id) => A1_CURRICULUM.nodeMap[id])
    .filter((n): n is PathNode => Boolean(n));
}

function UnitCard({ unitIndex }: { unitIndex: number }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { getUnitPhase, isCheckpointComplete, checkpointBestByUnit } = useA1Path();
  const { isAuthenticated } = useAuth();

  const unit = A1_UNITS[unitIndex];
  if (!unit) return null;
  const phase = getUnitPhase(unitIndex);
  const resolved = resolveNodes(unitIndex);
  const best = checkpointBestByUnit[unitIndex];
  const passed = isCheckpointComplete(unitIndex);

  const headerTone =
    phase === 'done'
      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30'
      : phase === 'current'
        ? 'border-blue-300 bg-white shadow-sm dark:border-blue-800 dark:bg-slate-900'
        : 'border-slate-200 bg-slate-100 opacity-70 dark:border-slate-700 dark:bg-slate-800';

  // Rail node marker color follows the unit phase.
  const markerTone =
    phase === 'done'
      ? 'bg-emerald-600 text-white'
      : phase === 'current'
        ? 'bg-blue-600 text-white ring-4 ring-blue-600/20'
        : 'bg-slate-300 text-slate-600 dark:bg-slate-700 dark:text-slate-300';

  return (
    <li className="relative pl-12 sm:pl-14">
      {/* Rail node marker — sits on the connecting line */}
      <span
        aria-hidden="true"
        className={`absolute left-0 top-5 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shadow-sm ${markerTone}`}
      >
        {phase === 'done' ? '✓' : unitIndex + 1}
      </span>

      <section className={`rounded-3xl border p-4 transition-colors sm:p-5 md:p-6 ${headerTone}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              {isDE ? `Einheit ${unitIndex + 1}` : `Unit ${unitIndex + 1}`}
            </div>
            <h2 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">
              {isDE ? unit.title.de : unit.title.en}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {isDE ? `${unit.theme.de} · ${unit.goal.de}` : `${unit.theme.en} · ${unit.goal.en}`}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
              phase === 'done'
                ? 'bg-emerald-600 text-white'
                : phase === 'current'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            {phase === 'done'
              ? isDE ? 'Abgeschlossen' : 'Done'
              : phase === 'current'
                ? isDE ? 'Aktuell' : 'Current'
                : isDE ? 'Gesperrt' : 'Locked'}
          </span>
        </div>

        {/* Nodes */}
        <div className="mt-4 flex flex-wrap gap-2">
          {resolved.map((node) => (
            <PathNodeItem key={node.id} node={node} unitPhase={phase} />
          ))}
        </div>

        {/* Bonus chips — never gate */}
        {phase !== 'locked' &&
          resolved
            .filter((n) => n.kind === 'bonus')
            .map((n) => (
              <Link
                key={n.id}
                to={n.to}
                className="mt-3 inline-flex min-h-[44px] items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 active:scale-95 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
              >
                ⭐ {isDE ? n.label.de : n.label.en}
              </Link>
            ))}

        {/* Pedagogy bridges */}
        {phase !== 'locked' && unit.pedagogy && (
          <div className="mt-4 space-y-3">
            {unit.pedagogy.honorifics && (
              <HonorificsTable title={unit.pedagogy.honorifics.title} rows={unit.pedagogy.honorifics.rows} />
            )}
            {unit.pedagogy.genderLegend && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <GenderBadge article="der" />
                  <GenderBadge article="die" />
                  <GenderBadge article="das" />
                  <GenderBadge article="plural" />
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {isDE ? unit.pedagogy.genderLegend.de : unit.pedagogy.genderLegend.en}
                </p>
              </div>
            )}
            {unit.pedagogy.umlautCallout && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                💡 {isDE ? unit.pedagogy.umlautCallout.de : unit.pedagogy.umlautCallout.en}
              </p>
            )}
            {unit.pedagogy.suffixNote && (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                📝 {isDE ? unit.pedagogy.suffixNote.de : unit.pedagogy.suffixNote.en}
              </p>
            )}
            {unit.pedagogy.grammarComparison && (
              <GrammarComparisonTable
                title={unit.pedagogy.grammarComparison.title}
                rows={unit.pedagogy.grammarComparison.rows}
              />
            )}
          </div>
        )}

        {/* Checkpoint status footer */}
        {phase === 'current' && !passed && (
          <p className="mt-3 text-xs font-medium text-blue-700 dark:text-blue-300">
            {isDE
              ? `Puffer ${unitIndex + 1}: brauche ≥80% zum Freischalten der nächsten Einheit.${typeof best === 'number' ? ` Bestes Ergebnis: ${Math.round(best * 100)}%.` : ''}`
              : `Checkpoint ${unitIndex + 1}: need ≥80% to unlock the next unit.${typeof best === 'number' ? ` Best score: ${Math.round(best * 100)}%.` : ''}`}
          </p>
        )}
        {phase === 'locked' && (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span>
              {isAuthenticated
                ? isDE
                  ? 'Beende den vorherigen Puffer, um diese Einheit freizuschalten.'
                  : 'Pass the previous checkpoint to unlock this unit.'
                : isDE
                  ? 'Melde dich an, um deinen Fortschritt zu speichern.'
                  : 'Sign in to save your path progress.'}
            </span>
            {!isAuthenticated && (
              <Link
                to="/auth"
                className="inline-flex min-h-[44px] items-center rounded-lg px-2 font-semibold text-blue-600 hover:text-blue-800 active:scale-95 dark:text-blue-300"
              >
                {isDE ? 'Anmelden →' : 'Sign in →'}
              </Link>
            )}
          </p>
        )}
      </section>
    </li>
  );
}

export function UnitSpine() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  return (
    <section id="a1-spine" className="mb-8">
      <div className="mb-3">
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          {isDE ? 'Dein A1-Lernpfad' : 'Your A1 learning path'}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isDE
            ? 'Lerne Einheit für Einheit. Jeder Puffer schaltet die nächste Einheit frei.'
            : 'Learn unit by unit. Each checkpoint unlocks the next unit.'}
        </p>
      </div>
      {/* Timeline rail: connector line runs behind the unit markers */}
      <ol className="relative space-y-4 before:absolute before:bottom-6 before:left-4 before:top-6 before:w-0.5 before:-translate-x-1/2 before:bg-gradient-to-b before:from-blue-300 before:via-slate-200 before:to-slate-200 dark:before:from-blue-800 dark:before:via-slate-700 dark:before:to-slate-700 sm:before:left-5">
        {A1_UNITS.map((u) => (
          <UnitCard key={u.id} unitIndex={u.index} />
        ))}
      </ol>
    </section>
  );
}