/**
 * src/admin/components/PrivilegedControls.tsx
 *
 * The controls that change a user's role or suspension.
 *
 * ── WHY THIS IS A SEPARATE COMPONENT ───────────────────────────────────────
 * It is the only part of the control centre that writes. Keeping it isolated
 * means the read-only surfaces (Users, User 360, Review Queue) stay read-only by
 * inspection: if the controls are wrong, the blast radius is one component.
 *
 * ── WHY THERE IS NO OPTIMISTIC UPDATE ──────────────────────────────────────
 * After a successful action the parent is asked to RELOAD, rather than the local
 * row being patched to the value we asked for. The server is the only authority
 * on what actually changed — and this has already been the bug once: an earlier
 * version of the repair path reported success for a write that never happened.
 * A reload cannot inherit that class of lie.
 *
 * ── THE REASON FIELD IS SHOWN, NOT GUESSED ─────────────────────────────────
 * Banning a peer admin requires a written reason, and the guard returns
 * `reason-required` with `recoverable: true`. Rather than letting an operator
 * discover that by hitting the button, the field is presented for any admin
 * target up front.
 */
import { useState } from 'react';
import { ShieldAlert, ShieldCheck, ShieldX, UserMinus, UserPlus } from 'lucide-react';
import { theme } from '../../config/theme';
import { runAdminAction, type AdminActionResult } from '../data/adminActions';

export interface PrivilegedControlsProps {
  userId: string;
  role: string;
  banned: boolean;
  /** True when this target is an admin, which is what requires a reason. */
  isAdmin: boolean;
  onDone: () => void;
}

type Pending = 'user.ban' | 'user.unban' | 'user.promote' | 'user.demote' | null;

export function PrivilegedControls({ userId, role, banned, isAdmin, onDone }: PrivilegedControlsProps) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<Pending>(null);
  const [result, setResult] = useState<AdminActionResult | null>(null);
  // A destructive action must be a deliberate second click, not the first one.
  const [confirming, setConfirming] = useState<Pending>(null);

  async function run(action: NonNullable<Pending>) {
    setBusy(action);
    setResult(null);
    setConfirming(null);
    const r = await runAdminAction({ action, targetId: userId, reason });
    setBusy(null);
    setResult(r);
    if (r.ok) {
      setReason('');
      onDone();
    }
  }

  function action(
    kind: NonNullable<Pending>,
    label: string,
    Icon: typeof ShieldAlert,
    danger: boolean,
  ) {
    const isPending = busy === kind;
    const needsConfirm = confirming === kind;
    return (
      <button
        type="button"
        // Two steps for anything destructive; one step for reversible ones.
        onClick={() => (danger && !needsConfirm ? setConfirming(kind) : void run(kind))}
        disabled={busy !== null}
        className={needsConfirm ? theme.button.danger : theme.button.secondary}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {isPending ? 'Working…' : needsConfirm ? `Confirm ${label}` : label}
      </button>
    );
  }

  return (
    <section aria-label="Privileged actions" className="rounded-lg border border-ink-200 p-4 dark:border-ink-800">
      <h3 className="flex items-center gap-2 text-section font-bold text-ink-900 dark:text-ink-50">
        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
        Privileged actions
      </h3>
      <p className="mt-1 text-meta text-ink-600 dark:text-ink-300">
        These go through the service-role function, not the browser. Every attempt — applied or
        refused — is written to the audit log.
      </p>

      {isAdmin && (
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-label text-ink-600 dark:text-ink-300">
            Reason (required to act on another admin)
          </span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this being done?"
            aria-label="Reason for the action"
            className={theme.input}
          />
        </label>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {banned
          ? action('user.unban', 'Unban', ShieldCheck, false)
          : action('user.ban', 'Ban', ShieldX, true)}
        {role === 'admin'
          ? action('user.demote', 'Demote', UserMinus, true)
          : action('user.promote', 'Promote', UserPlus, false)}
      </div>

      {result && (
        <p
          role="status"
          className={`mt-3 rounded border p-2 text-meta ${
            result.ok
              ? 'border-success-200 bg-success-50 text-success-800 dark:border-success-900 dark:bg-success-950/30 dark:text-success-200'
              : 'border-danger-200 bg-danger-50 text-danger-800 dark:border-danger-900 dark:bg-danger-950/30 dark:text-danger-200'
          }`}
        >
          {result.message}
        </p>
      )}
    </section>
  );
}
