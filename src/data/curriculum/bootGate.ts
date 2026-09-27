/**
 * src/data/curriculum/bootGate.ts
 *
 * The BOOT GATE: the pure decision that runs before `App` is imported.
 *
 * ── WHY THIS MUST HAPPEN BEFORE THE FIRST IMPORT ────────────────────────────
 * `index.ts` derives the spine in module scope and ~50 modules read the result
 * synchronously. Importing `App` statically pins that graph to the bundle at
 * parse time, and no later assignment can rebind what those modules already
 * captured. A post-mount "resolve then upgrade" is therefore cosmetic: the flag
 * could say `db` forever and the app would keep serving the bundle.
 *
 * So the gate is a bounded await BEFORE the first `import('./App')`.
 *
 * ── WHY EVERY FAILURE RESOLVES TO THE BUNDLE ────────────────────────────────
 * The bundle is shipped in the JS payload and cannot fail to arrive. Every
 * other input can: no network, a slow network, a malformed flag, content that
 * fails validation, a thrown fetch. Each of those must produce a working app
 * rather than a blank one, so the default is not an error case — it is the
 * normal case, and `db` is the thing that has to earn the right to be used.
 *
 * ── WHY A TIMEOUT ───────────────────────────────────────────────────────────
 * A hung request is indistinguishable, from the learner's side, from a slow
 * app. A learner on a weak connection would stare at a spinner indefinitely
 * because a feature flag did not answer. The timeout is what makes the fallback
 * a guarantee rather than an intention; without it, "falls back to bundle" is
 * only true for failures that eventually finish.
 */
import { CURRICULUM_SOURCE_KEY } from './source';
import { isUsableDbContent } from './source';
import { decideApply, decisionKey, readReloadMarker, writeReloadMarker } from './sourceApply';
import { setDbSeed } from './dbSeed';

/** How long the whole gate may take before the bundle is used regardless. */
export const BOOT_GATE_TIMEOUT_MS = 2500;

export type GateOutcome =
  /** Serve the bundle, and say why — surfaced in System. */
  | { kind: 'bundle'; reason: string }
  /** Serve DB content that validated; the seed has been planted. */
  | { kind: 'db'; units: number };

export interface GateInput {
  readFlag: () => Promise<unknown>;
  fetchDoc: () => Promise<unknown>;
  /** The value `index.ts` would have derived, used only to report unit counts. */
  countUnits?: (raw: unknown) => number;
  timeoutMs?: number;
}

/**
 * Reject a promise that outlives the budget.
 *
 * `Promise.race` is enough because every branch here ends up on the bundle — a
 * late resolution cannot un-race and swap content underneath an already-mounted
 * app, which is precisely why the timeout resolves rather than waits.
 */
export function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms: ${label}`)), ms);
    work.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

/**
 * Resolve the curriculum source and plant the result.
 *
 * Never rejects. The caller's only job afterwards is `import('./App')`.
 */
export async function runBootGate(input: GateInput): Promise<GateOutcome> {
  const budget = input.timeoutMs ?? BOOT_GATE_TIMEOUT_MS;

  let rawFlag: unknown;
  try {
    rawFlag = await withTimeout(input.readFlag(), budget, 'reading the curriculum source flag');
  } catch (err) {
    // Includes the timeout. Offline and slow both land here, and both must boot.
    return { kind: 'bundle', reason: `flag-unreadable: ${errText(err)}` };
  }

  // A flag that is anything other than exactly 'db' is the bundle — including a
  // value that is missing, null, or a typo. Interpreted here rather than by
  // importing `resolveSource` so this module has no dependency on the resolver's
  // module graph; the same tolerance, stated once.
  if (typeof rawFlag !== 'string' || rawFlag.trim().toLowerCase() !== 'db') {
    return { kind: 'bundle', reason: 'flag-is-bundle' };
  }

  let raw: unknown;
  try {
    raw = await withTimeout(input.fetchDoc(), budget, 'fetching the curriculum document');
  } catch (err) {
    return { kind: 'bundle', reason: `db-fetch-failed: ${errText(err)}` };
  }

  if (raw === null || raw === undefined) {
    return { kind: 'bundle', reason: 'no-db-content' };
  }

  // The SAME validator the build runs. Content that could not have shipped must
  // not be served, even though an admin published it.
  if (!isUsableDbContent(raw)) {
    return { kind: 'bundle', reason: 'db-validate-failed' };
  }

  setDbSeed(raw);
  return { kind: 'db', units: input.countUnits?.(raw) ?? 0 };
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * The reload half of the loop, kept next to the gate because they are one
 * decision split across two phases.
 *
 * A cold boot plants the seed and never needs a reload — the graph is not built
 * yet. This is for the case where resolution finishes AFTER the app mounted (a
 * component calling `startCurriculumResolution`), and it reuses the marker so a
 * second boot cannot reload twice for the same decision.
 */
export function applySourceChange(
  decision: Parameters<typeof decideApply>[0],
  currentlyServing: 'bundle' | 'db',
): { reload: boolean; reason: string } {
  const action = decideApply(decision, currentlyServing, readReloadMarker());
  if (action.kind === 'reload') {
    writeReloadMarker(decisionKey(decision));
    return { reload: true, reason: action.reason };
  }
  return { reload: false, reason: decision.reason };
}

export { CURRICULUM_SOURCE_KEY };