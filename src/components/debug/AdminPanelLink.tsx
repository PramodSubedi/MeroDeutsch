/**
 * src/components/debug/AdminPanelLink.tsx
 *
 * The "Admin panel" row in learner Settings, shown only to accounts that hold
 * `profiles.role = 'admin'`.
 *
 * ── WHY IT IS RENDERED, NOT CSS-HIDDEN ────────────────────────────────────
 * The check reads `profiles.role` over RLS (via `useDebugAccess`) and simply
 * returns `null` when the visitor is not an admin. Nothing is in the DOM for a
 * learner to uncover with devtools, and there is no "is the link visible" flag
 * that could be flipped from the console to reveal a privileged surface.
 *
 * ── WHY IT LIVES IN SETTINGS ──────────────────────────────────────────────
 * An admin working on content uses the learner app; the control centre is a
 * separate origin with a separate sign-in. A link here is the least friction
 * path between "I noticed something in the course" and "I am in the panel".
 * It is an ordinary navigation, not a privileged API call — clicking it just
 * opens the control centre, which performs its OWN role check before rendering
 * anything. This link is a convenience, and nothing depends on it being secret.
 *
 * ── WHY IT HIDES ITSELF WHILE SIMULATING GUEST ────────────────────────────
 * `useAuth` reports `user: null` in guest mode, so the role cannot be resolved
 * and the row correctly disappears. That is desirable: a "view as guest" session
 * should not be carrying a link to the admin panel.
 */
import { ShieldCheck } from 'lucide-react';
import { theme } from '../../config/theme';
import { useDebugAccess } from '../../hooks/useDebugAccess';
import { resolveAdminUrl } from '../../lib/debugModeLink';
import { useLang } from '../../hooks/useLang';

export function AdminPanelLink() {
  // `lazy: false` — the panel link must be correct on first paint. Deferring
  // would flash the row in and then remove it for non-admins.
  const { isAdmin, isLoading } = useDebugAccess({ lazy: false });
  const { isGermanOnly: isDE } = useLang();
  const adminUrl = resolveAdminUrl();

  // Nothing to link to (unknown host, or already inside the control centre) is
  // treated the same as "not an admin": render nothing rather than a dead link.
  if (isLoading || !isAdmin || adminUrl === '') return null;

  return (
    <div className={theme.panel.surface}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-600 dark:text-accent-400" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink-950 dark:text-white">
              {isDE ? 'Administration' : 'Administration'}
            </h2>
            <p className="mt-1 text-body text-ink-500 dark:text-ink-400">
              {isDE
                ? 'Benutzer, Lehrplan und Analysen verwalten.'
                : 'Manage users, curriculum and analytics from the control centre.'}
            </p>
          </div>
        </div>
        <a
          href={adminUrl}
          className={theme.button.primary}
          // Same-origin in dev, cross-origin in production. A new tab keeps the
          // learner's session and scroll position intact when the panel is
          // closed again.
          target="_blank"
          rel="noreferrer"
        >
          {isDE ? 'Admin-Panel öffnen' : 'Open admin panel'}
        </a>
      </div>
    </div>
  );
}
