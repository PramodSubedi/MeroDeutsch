/**
 * src/admin/pages/IntegrityPage.tsx
 *
 * Content-integrity findings over the live vocabulary table.
 *
 * Built because of what it found: 47 of 1062 rows carry a GERMAN word in the
 * `translation_en` slot — a contiguous run tagged `noun` with empty Nepali, the
 * signature of an import row misalignment. Those words are currently teaching
 * learners the wrong meaning, and nothing in the app could report it.
 *
 * Strictly read-only. Repairing a row is a privileged write (Phase 2); this
 * page exists to make the defect VISIBLE and correctly COUNTED.
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, RefreshCw, TriangleAlert } from 'lucide-react';
import { theme } from '../../config/theme';
import { KpiCard } from '../components/KpiCard';
import { fetchIntegrity, type Finding, type Severity } from '../data/integrity';

const SEVERITY_META: Record<
  Severity,
  { label: string; icon: typeof AlertTriangle; className: string; badge: string }
> = {
  error: {
    label: 'Error',
    icon: AlertTriangle,
    className: 'border-danger-200 bg-danger-50 dark:border-danger-900 dark:bg-danger-950/40',
    badge: 'bg-danger-100 text-danger-800 dark:bg-danger-900/60 dark:text-danger-200',
  },
  warning: {
    label: 'Warning',
    icon: TriangleAlert,
    className: 'border-warning-200 bg-warning-50 dark:border-warning-900 dark:bg-warning-950/40',
    badge: 'bg-warning-100 text-warning-800 dark:bg-warning-900/60 dark:text-warning-200',
  },
  info: {
    label: 'Review',
    icon: Info,
    className: 'border-ink-200 bg-ink-50 dark:border-ink-800 dark:bg-ink-800/40',
    badge: 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200',
  },
};

function FindingCard({ finding }: { finding: Finding }) {
  const meta = SEVERITY_META[finding.severity];
  const Icon = meta.icon;
  return (
    <section className={`rounded-lg border p-4 ${meta.className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 gap-2">
          <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="text-section font-bold text-ink-900 dark:text-ink-50">{finding.title}</h3>
            <p className="mt-1 text-meta text-ink-600 dark:text-ink-300">{finding.detail}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-micro font-extrabold uppercase tracking-wide ${meta.badge}`}>
            {meta.label}
          </span>
          <span className="text-display font-extrabold tabular-nums text-ink-900 dark:text-ink-50">
            {finding.count}
          </span>
        </div>
      </div>

      {finding.samples.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {finding.samples.map((s) => (
            <li
              key={s.id}
              className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-micro text-ink-700 dark:bg-ink-900/50 dark:text-ink-200"
            >
              {s.label}
            </li>
          ))}
          {finding.count > finding.samples.length && (
            <li className="px-1.5 py-0.5 text-micro text-ink-500 dark:text-ink-400">
              +{finding.count - finding.samples.length} more
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

export function IntegrityPage() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [totalVocab, setTotalVocab] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchIntegrity();
    setFindings(r.findings);
    setTotalVocab(r.totalVocab);
    setErrors(r.errors);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // The headline number is the CANDIDATE count, not a confirmed-defect count.
  // Live investigation found that at least 2 of the 47 are correct rows
  // ("Fahrkarte -> ticket", "schlecht -> bad" - they only trip the detector
  // because the English word collides with an unrelated German headword).
  // Calling the whole set "affected" overstates it, so the label says
  // "candidates" and the page header points at the note below.
  const errorCount = findings.filter((f) => f.severity === 'error').length;
  const affected = findings.filter((f) => f.severity === 'error').reduce((s, f) => s + f.count, 0);
  const share = totalVocab > 0 ? ((affected / totalVocab) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={theme.type.kicker}>Content</p>
          <h1 className={theme.page.heading}>Integrity</h1>
          <p className={theme.page.description}>
            Automated checks over the live vocabulary table. Read-only — repairing a row is a
            privileged write.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className={theme.button.secondary} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          {loading ? 'Checking…' : 'Re-check'}
        </button>
      </header>

      {errors.length > 0 && (
        <div className="rounded-md border border-danger-200 bg-danger-50 p-4 text-body text-danger-900 dark:border-danger-900 dark:bg-danger-950/40 dark:text-danger-200" role="status">
          <p className="font-semibold">The check could not read the vocabulary table</p>
          <ul className="mt-1 list-inside list-disc text-meta">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <section aria-label="Totals" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Words checked" value={String(totalVocab || '—')} hint="rows in vocabulary" loading={loading} />
        <KpiCard
          label="Blocking defects"
          value={String(errorCount)}
          hint="kinds of error"
          loading={loading}
          tone={errorCount > 0 ? 'warn' : 'good'}
        />
        <KpiCard
          label="Rows to review"
          value={String(affected)}
          hint={`${share}% of the table`}
          loading={loading}
          tone={affected > 0 ? 'warn' : 'good'}
        />
        <KpiCard
          label="Findings"
          value={String(findings.length)}
          hint="all severities"
          loading={loading}
          tone={errorCount > 0 ? 'warn' : 'good'}
        />
      </section>

      {affected > 0 && (
        <aside className="rounded-lg border border-ink-200 bg-ink-50 p-4 text-meta text-ink-700 dark:border-ink-800 dark:bg-ink-800/40 dark:text-ink-200">
          <h2 className="text-section font-bold text-ink-900 dark:text-ink-50">
            These are candidates for review, not confirmed defects
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              The check flags a row whose <code className="font-mono">translation_en</code> matches
              another German headword. That is a <em>heuristic</em>, and it has known false positives:
              <code className="font-mono">Fahrkarte &rarr; ticket</code> and{' '}
              <code className="font-mono">schlecht &rarr; bad</code> are <strong>correct</strong> — they
              trip it only because &ldquo;ticket&rdquo; and &ldquo;bad&rdquo; are also German words elsewhere
              in the table.
            </li>
            <li>
              A constant row-offset misalignment was tested for and <strong>rejected</strong>: a fixed
              shift cannot produce the repeated bogus values that were actually observed.
            </li>
            <li>
              So there is no automatic repair. Every corrected value must be entered by a human, per
              row, and the <code className="font-mono">vocab.repair</code> action rejects the entire
              batch if any single entry is invalid.
            </li>
          </ul>
        </aside>
      )}

      {loading && findings.length === 0 ? (
        <p className="py-10 text-center text-body text-ink-500 dark:text-ink-400">Running checks…</p>
      ) : findings.length === 0 ? (
        <div className="rounded-lg border border-success-200 bg-success-50 p-8 text-center dark:border-success-900 dark:bg-success-950/30">
          <CheckCircle2 className="mx-auto h-8 w-8 text-success-600" aria-hidden="true" />
          <h2 className="mt-2 text-section font-bold text-success-800 dark:text-success-300">No findings</h2>
          <p className="mt-1 text-meta text-success-800 dark:text-success-300/80">
            Every check passed across {totalVocab} vocabulary rows.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {findings.map((f) => (
            <FindingCard key={f.id} finding={f} />
          ))}
        </div>
      )}
    </div>
  );
}
