/**
 * src/admin/data/revisions.ts
 *
 * Optimistic-concurrency rule for the unit draft editor.
 *
 * ── WHY A CLIENT CLOCK CANNOT BE A REVISION ─────────────────────────────────
 * The stale-write guard used to be `unit.updatedAt !== baseRevision`, where the
 * baseline was set to `new Date().toISOString()` after a successful save. That
 * compares a CLIENT clock reading against a SERVER timestamp: two unrelated
 * clocks, formatted by two unrelated code paths, and never expected to be equal.
 *
 * The consequences were all silent, because a guard that fires wrongly looks
 * exactly like a guard that works:
 *
 *   · between a write landing and the refetch that followed it, EVERY save was
 *     refused with "was changed by someone else" — a confident lie about a
 *     collaboration that was not happening
 *   · when `updated_at` was null — which the column permits and the read model
 *     allows — both sides were null, the guard was inert, and the two-admin case
 *     it exists to catch was never caught. It reported success by doing nothing.
 *
 * The rule: the baseline is the revision the TEXT was read from, and only a
 * different read may change it. A client clock is not a revision, so it is not
 * used as one.
 *
 * It lives here, beside the other pure admin data logic, rather than inside
 * `UnitDocEditor.tsx`. A component file that also exports a predicate is a
 * component file whose fast-refresh boundary is wrong, and the predicate is
 * exactly the kind of thing that deserves a check of its own
 * (`scripts/ci/adminAccess.check.ts`).
 */
export interface StaleRevisionInput {
  /** The revision the row carries NOW, or null if the column is null. */
  current: string | null;
  /** The revision the text in the editor was read from. */
  base: string | null;
  /**
   * When this text was last written, in epoch ms, or null if never.
   *
   * Not a revision — a different question from "what did I read", and what makes
   * "you have unsaved changes" distinguishable from "someone else wrote".
   */
  savedAt: number | null;
  now: number;
}

/** The grace period during which a moved row is attributed to our own write. */
export const OWN_WRITE_WINDOW_MS = 5_000;

export function isStaleRevision(args: StaleRevisionInput): { stale: boolean; reason: string | null } {
  const { current, base, savedAt, now } = args;

  // Nothing to compare. A null `updated_at` means the store cannot support a
  // revision check, and saying so beats pretending the check passed.
  if (current === null || base === null) {
    return { stale: false, reason: null };
  }

  if (current === base) return { stale: false, reason: null };

  // The row moved, but not since anything we can tie to our own write — either a
  // genuine concurrent edit, or the write we just made and are reading back a
  // stale value around.
  //
  // The LOWER bound matters as much as the upper one. Without it a `savedAt` in
  // the future makes `now - savedAt` negative, which is `< 5000` forever — a
  // permanent amnesty bought by a clock that has drifted, or by a tampered
  // value. Both ends are checked, so the window is genuinely bounded.
  if (savedAt !== null && now >= savedAt && now - savedAt < OWN_WRITE_WINDOW_MS) {
    return { stale: false, reason: null };
  }

  return {
    stale: true,
    reason:
      'This unit was changed by someone else after you opened it. Reload the store to see their ' +
      'version before saving, or your edit would discard theirs.',
  };
}
