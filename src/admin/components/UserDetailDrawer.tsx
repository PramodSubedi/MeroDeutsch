/**
 * src/admin/components/UserDetailDrawer.tsx
 *
 * The User 360 panel. Opens from a row in the Users table and answers the
 * question the table cannot: "is THIS learner actually stuck, and on what?"
 *
 * ── WHY A DRAWER, NOT A ROUTE ──────────────────────────────────────────────
 * The admin list is a scan surface; this is an inspect surface. Making it a
 * route would lose the list's scroll position, filters and sort on every
 * inspection, which is exactly when an admin most wants to compare two learners
 * side by side. A drawer keeps the table behind it.
 *
 * ── WHY IT IS STRICTLY READ-ONLY ───────────────────────────────────────────
 * Every action an admin might take here (ban, grant premium, change role) is
 * blocked by `protect_profile_privilege()` / `protect_profile_plan()`. They are
 * surfaced as an explicit note rather than disabled buttons: a greyed-out
 * control implies "turn this on when ready", which is wrong — there is no
 * client-side switch to flip. The privileged actions arrive with the
 * service-role Edge Function.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { theme } from '../../config/theme';
import { KpiCard } from './KpiCard';
import { PrivilegedControls } from './PrivilegedControls';
import {
  fetchUserDetail,
  type DueState,
  type UserDetail,
} from '../data/userDetail';

/** A missing value renders as a muted dash — never a fake 0. */
function Value({ value, title }: { value: number | string | null; title?: string }) {
  if (value === null || value === '') {
    return (
      <span className="text-ink-300 dark:text-ink-600" title="No data">
        —
      </span>
    );
  }
  return <span title={title}>{value}</span>;
}

/** 4-step scale, not a rainbow. Hue is not carrying meaning here; opacity is. */
const INTENSITY_CLASS: Record<string, string> = {
  none: 'bg-ink-100 dark:bg-ink-800',
  light: 'bg-accent-200 dark:bg-accent-900',
  medium: 'bg-accent-400 dark:bg-accent-700',
  heavy: 'bg-accent-600 dark:bg-accent-500',
};

const DUE_CLASS: Record<DueState, string> = {
  overdue: 'bg-danger-100 text-danger-800 dark:bg-danger-900/60 dark:text-danger-200',
  due: 'bg-warning-100 text-warning-800 dark:bg-warning-900/60 dark:text-warning-200',
  upcoming: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
  scheduled: 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400',
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
      <h3 className={`${theme.type.section} text-ink-500 dark:text-ink-400`}>{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink-100 py-1.5 last:border-0 dark:border-ink-800/60">
      <span className="text-meta text-ink-500 dark:text-ink-400">{label}</span>
      <span className="text-meta font-semibold text-ink-900 dark:text-ink-100">{children}</span>
    </div>
  );
}

function ActivityStrip({ detail }: { detail: UserDetail }) {
  return (
    <div>
      <div className="flex flex-wrap gap-[3px]" role="img" aria-label={`Activity over the last ${detail.activity.length} days`}>
        {detail.activity.map((cell) => (
          <span
            key={cell.date}
            className={`h-[11px] w-[11px] rounded-[2px] ${INTENSITY_CLASS[cell.intensity]}`}
            title={`${cell.date} — ${cell.count} event${cell.count === 1 ? '' : 's'}`}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-micro text-ink-500 dark:text-ink-400">
        <span>Less</span>
        {(['none', 'light', 'medium', 'heavy'] as const).map((k) => (
          <span key={k} className={`h-[9px] w-[9px] rounded-[2px] ${INTENSITY_CLASS[k]}`} />
        ))}
        <span>More</span>
      </div>
      <p className="mt-2 text-micro text-ink-500 dark:text-ink-400">
        Each square is one day. <Value value={detail.activeDayCount} /> active day(s) all-time ·{' '}
        <Value value={detail.totalEvents} /> total event(s).
      </p>
    </div>
  );
}

function QueuePanel({ detail }: { detail: UserDetail }) {
  const { queue } = detail;
  if (queue.total === 0) {
    return (
      <p className="text-meta text-ink-500 dark:text-ink-400">
        Nothing in the review queue. Either this learner has answered everything correctly, or they
        have not practised yet — the other panels say which.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {queue.byModule.slice(0, 6).map((m) => (
          <span
            key={m.moduleType}
            className="rounded-full bg-ink-100 px-2 py-0.5 text-micro font-semibold text-ink-600 dark:bg-ink-800 dark:text-ink-300"
          >
            {m.moduleType} · {m.count}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-micro">
          <thead>
            <tr className="text-micro font-extrabold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
              <th className="py-1 pr-2">Item</th>
              <th className="py-1 pr-2">Due</th>
              <th className="py-1 pr-2 text-right">Errors</th>
              <th className="py-1 pr-2 text-right">Box</th>
              <th className="py-1">Answer</th>
            </tr>
          </thead>
          <tbody>
            {queue.attention.map((item) => (
              <tr key={item.item_key} className="border-t border-ink-100 dark:border-ink-800/60">
                <td className="max-w-[10rem] truncate py-1.5 pr-2 font-mono text-ink-700 dark:text-ink-200" title={item.item_key ?? ''}>
                  {item.item_key ?? '—'}
                </td>
                <td className="py-1.5 pr-2">
                  <span className={`rounded px-1.5 py-0.5 font-extrabold uppercase ${DUE_CLASS[item.due]}`}>
                    {item.due}
                  </span>
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-ink-700 dark:text-ink-200">
                  {item.error_count ?? 0}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-ink-700 dark:text-ink-200">
                  {item.box_level ?? 0}
                </td>
                <td className="max-w-[9rem] truncate py-1.5 text-ink-500 dark:text-ink-400" title={`${item.user_answer ?? '—'} → ${item.correct_answer ?? '—'}`}>
                  {item.user_answer ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {queue.total > queue.attention.length && (
        <p className="text-micro text-ink-500 dark:text-ink-400">
          Showing the {queue.attention.length} most urgent of {queue.total} queued item(s).
        </p>
      )}
    </div>
  );
}

function ReadOnlyNote() {
  return (
    <div className="flex gap-2 rounded-md border border-ink-200 bg-ink-50 p-3 text-micro text-ink-600 dark:border-ink-800 dark:bg-ink-800/40 dark:text-ink-300">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>
        This panel is read-only. Suspending an account, granting premium or changing a role is
        refused by the database (<code className="font-mono">42501</code>) — that refusal is the
        privilege-escalation guard working. Those actions arrive with the service-role function.
      </p>
    </div>
  );
}

function Body({ detail }: { detail: UserDetail }) {
  const { profile, progress, xp, streak, path } = detail;
  const quizTotal = progress?.quiz_total ?? null;
  const quizCorrect = progress?.quiz_correct ?? null;
  const accuracy =
    quizTotal && quizTotal > 0 && quizCorrect !== null
      ? Math.round((quizCorrect / quizTotal) * 100)
      : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Total XP" value={String(xp?.total_xp ?? '—')} hint="lifetime" />
        <KpiCard label="Level" value={String(xp?.level ?? '—')} hint="from XP" />
        <KpiCard
          label="Streak"
          value={String(streak?.current_streak ?? '—')}
          hint={streak?.longest_streak != null ? `best ${streak.longest_streak}` : undefined}
          tone={(streak?.current_streak ?? 0) > 0 ? 'good' : 'neutral'}
        />
        <KpiCard
          label="Quiz accuracy"
          value={accuracy === null ? '—' : `${accuracy}%`}
          hint={quizTotal ? `${quizCorrect ?? 0} / ${quizTotal}` : 'no quiz data'}
        />
      </div>

      <Section title="Identity">
        <Field label="Username">{profile.username ?? '—'}</Field>
        <Field label="User id">
          <code className="font-mono text-micro">{profile.id}</code>
        </Field>
        <Field label="Plan">{profile.plan ?? 'free'}</Field>
        <Field label="Role">{profile.role ?? 'user'}</Field>
        <Field label="Language">{profile.language_preference ?? '—'}</Field>
        <Field label="Joined">{profile.created_at?.slice(0, 10) ?? '—'}</Field>
        <Field label="Suspended">
          {profile.banned_at ? (
            <span className="text-danger-600 dark:text-danger-400">{profile.banned_at.slice(0, 10)}</span>
          ) : (
            'no'
          )}
        </Field>
      </Section>

      <Section title="A1 spine progress">
        {path ? (
          <>
            <Field label="Unit unlocked">
              {/* Stored 0-based; shown 1-based to match the Users table. */}
              {(path.unlocked_unit_index ?? 0) + 1} of 15
            </Field>
            <Field label="Nodes completed">
              <Value value={detail.completedNodeCount} />
            </Field>
            <Field label="Path mode">{path.path_mode ?? '—'}</Field>
            <Field label="State updated">{path.updated_at?.slice(0, 10) ?? '—'}</Field>
          </>
        ) : (
          <p className="text-meta text-ink-500 dark:text-ink-400">
            No <code className="font-mono">a1_path_state</code> row — this learner has not started
            the campaign, or has not synced.
          </p>
        )}
      </Section>

      <Section title="Activity">
        <ActivityStrip detail={detail} />
      </Section>

      <Section title="Review queue">
        <QueuePanel detail={detail} />
      </Section>

      {detail.achievements.length > 0 && (
        <Section title={`Achievements (${detail.achievements.length})`}>
          <div className="flex flex-wrap gap-1.5">
            {detail.achievements.map((a, i) => (
              <span
                key={`${a.badge_id}-${i}`}
                className="rounded-full bg-accent-100 px-2 py-0.5 text-micro font-semibold text-accent-800 dark:bg-accent-900/60 dark:text-accent-200"
                title={a.unlocked_at ?? undefined}
              >
                {a.badge_id ?? 'unknown'}
              </span>
            ))}
          </div>
        </Section>
      )}

      <ReadOnlyNote />

      {detail.errors.length > 0 && (
        <Section title="Unreadable sources">
          <ul className="list-inside list-disc text-micro text-danger-700 dark:text-danger-300">
            {detail.errors.map((e) => (
              <li key={e} className="font-mono">
                {e}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-micro text-ink-500 dark:text-ink-400">
            The panels above still show everything that DID resolve — a denied table blanks its own
            section rather than the whole drawer.
          </p>
        </Section>
      )}
    </div>
  );
}

export interface UserDetailDrawerProps {
  /** The learner to inspect, or null to close. */
  userId: string | null;
  /** Used for the header while the deep fetch is still in flight. */
  fallbackName?: string | null;
  onClose: () => void;
}

export function UserDetailDrawer({ userId, fallbackName, onClose }: UserDetailDrawerProps) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(false);
  // Bumped after a privileged action so the effect below re-runs. Reloading is
  // the point: the displayed role and ban state must come from the server, not
  // from the value the client just asked for.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!userId) {
      setDetail(null);
      setMissing(false);
      return;
    }
    // Ignore a response that arrives after the admin has opened someone else:
    // without this, a slow first request can land second and overwrite the
    // learner actually being looked at.
    let cancelled = false;
    setLoading(true);
    setMissing(false);
    fetchUserDetail(userId).then((d) => {
      if (cancelled) return;
      setDetail(d);
      setMissing(d === null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, reloadToken]);

  // Escape closes, and the page behind must not scroll while the drawer is up.
  useEffect(() => {
    if (!userId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [userId, onClose]);

  if (!userId) return null;

  const name = detail?.profile.username ?? fallbackName ?? 'User';

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Details for ${name}`}>
      {/* Scrim: click to dismiss. `aria-hidden` because Escape is the keyboard path. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close details"
        className="absolute inset-0 bg-ink-950/40 dark:bg-ink-950/60"
      />

      <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-ink-200 bg-ink-50 dark:border-ink-800 dark:bg-ink-950">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-ink-200 bg-white px-4 py-3 dark:border-ink-800 dark:bg-ink-900">
          <div className="min-w-0">
            <h2 className="truncate text-title font-bold text-ink-950 dark:text-white">{name}</h2>
            <p className="truncate font-mono text-micro text-ink-400">
              {detail?.profile.id ?? userId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`${theme.button.icon} h-11 w-11 shrink-0`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 p-4">
          {loading ? (
            <p className="py-10 text-center text-body text-ink-500 dark:text-ink-400">Loading…</p>
          ) : missing ? (
            <p className="py-10 text-center text-body text-ink-500 dark:text-ink-400">
              This learner could not be read. The account may be deleted, or the admin RLS policies
              may not permit it.
            </p>
          ) : detail ? (
            <div className="space-y-4">
              {/* The ONLY write surface in the read-only drawer. After a
                  successful action it calls `reload`, so the displayed role and
                  ban state come from the server rather than from the value we
                  asked for. */}
              <PrivilegedControls
                userId={detail.profile.id}
                role={detail.profile.role}
                banned={Boolean(detail.profile.banned_at)}
                isAdmin={detail.profile.role === 'admin'}
                onDone={() => setReloadToken((n) => n + 1)}
              />
              <Body detail={detail} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
