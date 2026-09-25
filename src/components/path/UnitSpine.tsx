/**
 * src/components/path/UnitSpine.tsx
 *
 * The /learn campaign: a VERTICAL LINEAR stepper of 5 A1 units (index 0..4).
 *
 * Visual design (stepper):
 *  - Continuous dashed gray rail behind all units (locked territory).
 *  - Solid blue rail segments overlay the rail wherever progress has reached
 *    (previous unit done/current) — colors update automatically from state.
 *  - Timeline node circles: emerald (done) / solid blue (current) / slate (locked).
 *  - Unit cards: white + shadow-md for unlocked, compact tinted slate-50 for locked.
 *  - Module pills: green completed / solid blue active / white locked — derived
 *    per node from useA1Path so the UI updates itself from real progress.
 *
 * Data comes from A1_UNITS/A1_CURRICULUM; status from useA1Path. Deep links to
 * lesson routes still load (soft lock = unit unlock, not 404). Pedagogy bridges
 * (honorifics table, gender legend/tokens, EN/NE/DE word-order panel) render
 * inside each unlocked unit card. Interactive targets >=44px; primary CTAs use
 * active:scale-95.
 */

import { Link } from 'react-router-dom';
import { CheckCircle, Lock, Play } from 'lucide-react';
import { useLang } from '../../hooks/useLang';
import { useA1Path } from '../../hooks/useA1Path';
import { useAuth } from '../../hooks/useAuth';
import { A1_UNITS, A1_CURRICULUM, type PathNode } from '../../data/a1Path';
import { HonorificsTable } from '../grammar/HonorificsTable';
import { GrammarComparisonTable } from '../grammar/GrammarComparisonTable';
import { GenderBadge } from '../ui/GenderBadge';
import { theme } from '../../config/theme';
import { ANCHORS } from '../../lib/anchors';

type UnitPhase = 'locked' | 'current' | 'done';
type PillState = 'completed' | 'active' | 'locked';

function resolveNodes(unitIndex: number): PathNode[] {
  const unit = A1_UNITS[unitIndex];
  if (!unit) return [];
  
  // Main nodes (learn/practice/checkpoint) from unit.nodeIds
  const mainNodes = unit.nodeIds
    .map((id) => A1_CURRICULUM.nodeMap[id])
    .filter((n): n is PathNode => Boolean(n));
  
  // Bonus nodes for this unit (from A1_CURRICULUM.nodes, filtered by unitIndex)
  const bonusNodes = A1_CURRICULUM.nodes.filter(
    (n) => n.kind === 'bonus' && n.unitIndex === unitIndex
  );
  
  return [...mainNodes, ...bonusNodes];
}

/** Module pill styles — green completed vs solid blue active vs white locked. */
const PILL_STYLES: Record<PillState, string> = {
  completed:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
  active:
    'bg-blue-600 text-white shadow-sm hover:bg-blue-700 dark:bg-blue-700',
  locked:
    'bg-white text-slate-400 shadow-sm dark:bg-slate-800 dark:text-slate-500',
};

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

function UnitCard({ unitIndex }: { unitIndex: number }) {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { getUnitPhase, isCheckpointComplete, checkpointBestByUnit, isNodeUnlocked, isNodeComplete, completeNode } =
    useA1Path();
  const { isAuthenticated } = useAuth();
  const [pedagogyOpen, setPedagogyOpen] = useState(false);

  const unit = A1_UNITS[unitIndex];
  if (!unit) return null;
  const isSupport = unit.kind === 'support';
  const phase = getUnitPhase(unitIndex);
  const resolved = resolveNodes(unitIndex);
  const best = checkpointBestByUnit[unitIndex];
  const passed = isCheckpointComplete(unitIndex);

  // Rail connector ABOVE this card: solid blue once progress has reached this
  // unit (previous unit done/current), dashed gray while still locked.
  const prevPhase: UnitPhase | null = unitIndex === 0 ? null : getUnitPhase(unitIndex - 1);
  const progressReached = prevPhase !== null && prevPhase !== 'locked';

  // Node marker color follows the unit phase.
  const markerTone =
    phase === 'done'
      ? 'bg-emerald-600 text-white'
      : phase === 'current'
        ? 'bg-blue-600 text-white'
        : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400';

  // Card surface: elevated white when unlocked, compact tinted when locked.
  const cardTone =
    phase === 'locked'
      ? 'rounded-2xl bg-slate-50 p-5 dark:bg-slate-800/60'
      : 'rounded-2xl bg-white p-6 shadow-md dark:bg-slate-900';

  // Status pill tone.
  const statusPillTone =
    phase === 'done'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
      : phase === 'current'
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
        : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400';

  /** Pill state per module node, derived from real path progress. */
  const pillStateFor = (node: PathNode): PillState => {
    if (isNodeComplete(node)) return 'completed';
    const unlocked = phase !== 'locked' && isNodeUnlocked(node);
    return unlocked ? 'active' : 'locked';
  };

  return (
    <li className="relative z-10 pl-12 sm:pl-14">
      {/* Rail connector segment from previous marker to this marker */}
      {unitIndex > 0 && (
        <span aria-hidden="true" className="absolute left-[15px] -top-10 h-14 w-[2px] sm:left-[19px]">
          {progressReached ? (
            <span className="block h-full w-[2px] bg-blue-600" />
          ) : (
            <span className="block h-full w-0 border-l-2 border-dashed border-slate-300 dark:border-slate-600" />
          )}
        </span>
      )}

      {/* Timeline node (circle) */}
      <div
        aria-hidden="true"
        className={`absolute left-0 top-4 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold shadow-sm ring-4 ring-slate-50 transition-colors dark:ring-slate-950 ${markerTone}`}
      >
        {phase === 'done' ? <CheckCircle className="h-4 w-4" /> : unit.code}
      </div>

      {/* Unit card */}
      <section className={`transition-all ${cardTone}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            {/* Eyebrow — band letter; SUPPORT band B is labelled optional */}
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {isDE ? `BAND ${unit.code}${isSupport ? ' · OPTIONAL' : ''}` : `BAND ${unit.code}${isSupport ? ' · OPTIONAL' : ''}`}
            </span>
            <h3
              className={`mt-1 text-xl font-bold ${
                phase === 'locked'
                  ? 'text-slate-700 dark:text-slate-300'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {isDE ? unit.title.de : unit.title.en}
            </h3>
          </div>
          {/* Status pill */}
          <span className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold ${
            isSupport
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
              : statusPillTone
          }`}>
            {isSupport
              ? isDE ? 'Optional' : 'Optional'
              : phase === 'done'
                ? isDE ? 'Erledigt' : 'Done'
                : phase === 'current'
                  ? isDE ? 'Aktuell' : 'Current'
                  : isDE ? 'Gesperrt' : 'Locked'}
          </span>
        </div>

        <p className="mb-5 mt-2 text-sm text-slate-500 dark:text-slate-400">
          {isDE ? `${unit.theme.de} · ${unit.goal.de}` : `${unit.theme.en} · ${unit.goal.en}`}
        </p>

        {/* Module pills — bonus chips excluded here; they render once below */}
        {phase !== 'locked' ? (
          <div className="flex flex-wrap gap-2.5">
            {resolved
              .filter((n) => n.kind !== 'bonus')
              .map((node) => {
                const state = pillStateFor(node);
                const navigable = state !== 'locked';
                const icon =
                  state === 'completed' ? (
                    <CheckCircle className="h-4 w-4" aria-hidden="true" />
                  ) : state === 'active' ? (
                    <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                  ) : (
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  );
                const label = isDE ? node.label.de : node.label.en;

                const inner = (
                  <>
                    {icon}
                    <span className="truncate">{label}</span>
                  </>
                );
                const cls = `inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors active:scale-95 ${PILL_STYLES[state]}`;

                if (!navigable) {
                  return (
                    <div
                      key={node.id}
                      className={`${cls} cursor-not-allowed opacity-90`}
                      aria-label={isDE ? `${label} (gesperrt)` : `${label} (locked)`}
                    >
                      {inner}
                    </div>
                  );
                }
                return (
                  <Link
                    key={node.id}
                    to={node.to}
                    className={cls}
                    onClick={() => {
                      // Visit-completion for learn/practice (rule A). Idempotent.
                      if (node.kind === 'learn' || node.kind === 'practice') {
                        completeNode(node.id);
                      }
                    }}
                  >
                    {inner}
                  </Link>
                );
              })}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {isDE ? 'Vorschau der Module:' : 'Module preview:'}
            </div>
            <div className="flex flex-wrap gap-2.5">
              {resolved
                .filter((n) => n.kind !== 'bonus')
                .map((node) => {
                  const label = isDE ? node.label.de : node.label.en;
                  return (
                    <div
                      key={node.id}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-slate-100 text-slate-400 px-3 py-1.5 text-sm font-medium dark:bg-slate-800/40 dark:text-slate-500 cursor-not-allowed opacity-60"
                    >
                      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="truncate">{label}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Bonus chips — never gate. Only shown in unlocked units */}
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

        {/* Pedagogy bridges — default collapsed accordion */}
        {phase !== 'locked' && unit.pedagogy && (
          <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-850">
            <button
              type="button"
              onClick={() => setPedagogyOpen((o) => !o)}
              className="flex w-full items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              aria-expanded={pedagogyOpen}
            >
              <span>📚 {isDE ? 'Einheitstipps & Erklärungen' : 'Unit Tips & Explanations'}</span>
              {pedagogyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {pedagogyOpen && (
              <div className="mt-3 space-y-3">
                {unit.pedagogy.honorifics && (
                  <HonorificsTable title={unit.pedagogy.honorifics.title} rows={unit.pedagogy.honorifics.rows} />
                )}
                {unit.pedagogy.genderLegend && (
                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
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
                  <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    💡 {isDE ? unit.pedagogy.umlautCallout.de : unit.pedagogy.umlautCallout.en}
                  </p>
                )}
                {unit.pedagogy.suffixNote && (
                  <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
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
          </div>
        )}

        {/* Checkpoint status footer — only CORE bands carry a gate (SUPPORT = none) */}
        {isSupport ? (
          <p className="mt-4 text-xs font-medium text-amber-700 dark:text-amber-300">
            {isDE
              ? 'Freiwillig — dieser Band blockiert nie den Lernpfad.'
              : 'Optional — this support band never locks the path.'}
          </p>
        ) : (
          phase === 'current' &&
          !passed && (
            <p className="mt-4 text-xs font-medium text-blue-700 dark:text-blue-300">
              {isDE
                ? `Pforte ${unit.code}: brauche ≥80% zum Freischalten des nächsten Bands.${typeof best === 'number' ? ` Bestes Ergebnis: ${Math.round(best * 100)}%.` : ''}`
                : `Gate ${unit.code}: need ≥80% to unlock the next band.${typeof best === 'number' ? ` Best score: ${Math.round(best * 100)}%.` : ''}`}
            </p>
          )
        )}
        {phase === 'locked' && (
          <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span>
              {isAuthenticated
                ? isDE
                  ? 'Bestehe die vorherige Pforte, um dieses Band freizuschalten.'
                  : 'Pass the previous gate to unlock this band.'
                : isDE
                  ? 'Melde dich an, um deinen Fortschritt zu speichern.'
                  : 'Sign in to save your path progress.'}
            </span>
            {!isAuthenticated && (
              <Link
                to="/auth"
                className={`inline-flex min-h-[44px] items-center rounded-lg font-semibold ${theme.button.secondary}`}
              >
                {isDE ? 'Anmelden' : 'Sign in'}
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
    <section id={ANCHORS.a1Spine} className="mx-auto w-full max-w-3xl py-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {isDE ? 'Dein A1-Lernpfad' : 'Your A1 learning path'}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isDE
            ? 'Lerne Band für Band. Jede Pforte schaltet das nächste Band frei.'
            : 'Learn band by band. Each gate unlocks the next band.'}
        </p>
      </div>

      {/* Stepper container: continuous dashed rail behind everything; solid
          blue segments are rendered per-unit above each unlocked card so the
          line color updates automatically from path state. */}
      <ol className="relative space-y-6">
        {/* Continuous background dashed line (locked territory) */}
        <span
          aria-hidden="true"
          className="absolute bottom-2 left-[15px] top-2 z-0 w-0 border-l-2 border-dashed border-slate-300 dark:border-slate-600 sm:left-[19px]"
        />
        {A1_UNITS.map((u) => (
          <UnitCard key={u.id} unitIndex={u.index} />
        ))}
      </ol>
    </section>
  );
}