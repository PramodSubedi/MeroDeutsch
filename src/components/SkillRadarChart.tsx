/**
 * src/components/SkillRadarChart.tsx
 *
 * TACTICAL SKILL ANALYSIS — radar (spider) chart of learner accuracy across
 * four categories: Grammar · Vocabulary · Listening · Spelling.
 *
 * Data: `useSkillAccuracy()` — computed OFFLINE-FIRST from Dexie SRS rows
 * (real answer outcomes), so the chart works with zero network.
 *
 * Layout (Phase 3): on lg+ screens the RADAR and the per-skill BREAKDOWN sit
 * SIDE-BY-SIDE (squad-analysis console feel); below lg they stack vertically
 * (chart first, breakdown beneath) — a real flex-order rearrangement.
 *
 * Chart: Recharts (already a project dependency). Brand blue #2563eb fill,
 * muted polar grid, localized axis labels, empty-state for new learners.
 */

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Target } from 'lucide-react';
import { useLang } from '../hooks/useLang';
import { useSkillAccuracy, type SkillCategory } from '../hooks/useSkillAccuracy';

const BRAND_BLUE = '#2563eb';

/** Localized labels + drill-down hints per category. */
function skillMeta(category: SkillCategory, isDE: boolean): { label: string; hint: string } {
  switch (category) {
    case 'grammar':
      return { label: isDE ? 'Grammatik' : 'Grammar', hint: '/grammar' };
    case 'vocabulary':
      return { label: isDE ? 'Wortschatz' : 'Vocabulary', hint: '/glossary' };
    case 'listening':
      return { label: isDE ? 'Hören' : 'Listening', hint: '/dictation' };
    case 'spelling':
      return { label: isDE ? 'Rechtschreibung' : 'Spelling', hint: '/alphabet' };
  }
}

/** Accuracy -> tactical tone. */
function accuracyTone(accuracy: number): string {
  if (accuracy >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (accuracy >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function SkillRadarChart() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { skills, hasData } = useSkillAccuracy();

  const chartData = skills.map((s) => ({
    skill: skillMeta(s.category, isDE).label,
    accuracy: s.accuracy,
  }));

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-900">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            <Target className="h-4 w-4" aria-hidden="true" />
            {isDE ? 'Fähigkeiten-Analyse' : 'Skill analysis'}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isDE
              ? 'Deine Genauigkeit über vier Kernfähigkeiten.'
              : 'Your accuracy across four core skills.'}
          </p>
        </div>
      </div>

      {!hasData ? (
        /* Empty state for brand-new learners */
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-600 dark:bg-slate-800/40">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {isDE
              ? 'Noch keine Daten — beantworte ein paar Übungen, um dein Fähigkeitsprofil aufzubauen.'
              : 'No data yet — answer a few exercises to build your skill profile.'}
          </p>
        </div>
      ) : (
        /* Responsive console: side-by-side on lg+, stacked on mobile */
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          {/* Radar — full width on mobile, dominant pane on lg */}
          <div className="order-1 h-72 w-full sm:h-80 lg:h-72 lg:w-3/5">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={chartData} outerRadius="72%">
                <PolarGrid stroke="#94a3b8" strokeOpacity={0.35} />
                <PolarAngleAxis
                  dataKey="skill"
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                />
                <PolarRadiusAxis
                  domain={[0, 100]}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickCount={5}
                  stroke="#94a3b8"
                  strokeOpacity={0.3}
                />
                <Tooltip
                  formatter={(value) => [`${value}%`, isDE ? 'Genauigkeit' : 'Accuracy']}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid rgba(148,163,184,0.35)',
                    background: 'rgba(15,23,42,0.92)',
                    color: '#f8fafc',
                    fontSize: 12,
                  }}
                />
                <Radar
                  name={isDE ? 'Genauigkeit' : 'Accuracy'}
                  dataKey="accuracy"
                  stroke={BRAND_BLUE}
                  strokeWidth={2}
                  fill={BRAND_BLUE}
                  fillOpacity={0.35}
                  dot={{ r: 3, fill: BRAND_BLUE, strokeWidth: 0 }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Per-skill breakdown — beneath on mobile, right column on lg */}
          <ul className="order-2 w-full space-y-2 lg:w-2/5">
            {skills.map((s) => {
              const meta = skillMeta(s.category, isDE);
              return (
                <li
                  key={s.category}
                  className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {meta.label}
                    </span>
                    <span className={`text-sm font-bold ${accuracyTone(s.accuracy)}`}>
                      {s.accuracy}%
                    </span>
                  </div>
                  {/* Mini progress bar */}
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${s.accuracy}%`, backgroundColor: BRAND_BLUE }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    {s.correct}/{s.total} {isDE ? 'richtig' : 'correct'} · Übe auf{' '}
                    <span className="font-mono">{meta.hint}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}