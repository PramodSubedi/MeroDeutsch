/**
 * src/admin/data/servedSource.ts
 *
 * "What is the app ACTUALLY serving?" — as opposed to "what does the flag say".
 *
 * ── WHY THIS IS NOT THE FLAG ─────────────────────────────────────────────────
 * `curriculum_source = 'db'` is an INTENT. What a learner receives is the
 * result of the boot gate running the intent against real content, and the two
 * diverge in five different ways, each of which silently serves the bundle:
 *
 *   `flag-unreadable`      the flag row is missing, null, or a typo
 *   `no-db-content`        the flag says db, nothing is published
 *   `db-fetch-failed`      the read timed out or threw
 *   `db-validate-failed`   the document does not pass `validateCurriculum`
 *
 * The control centre showed the flag and nothing else. So an admin who published
 * content, flipped the flag, and broke the document would see `db` in the panel
 * while every learner silently got the bundle — with no error anywhere, because
 * failing over to the bundle is the designed and correct behaviour.
 *
 * ── WHY IT CAN BE ANSWERED, NOT GUESSED ──────────────────────────────────────
 * The gate is already factored as pure functions over injected I/O
 * (`runBootGate`, `isUsableDbContent`), and both the flag and the document live
 * in `app_config`, which is PUBLIC READ. So the admin can run the learner's own
 * decision — the same `runBootGate`, not a reimplementation of it — against the
 * same two rows the learner will read.
 *
 * That matters: a second implementation of the rule could disagree with the first
 * and be confidently wrong. This one cannot, because it IS the first.
 *
 * It is a PREDICTION, not a measurement: a learner offline at boot resolves to
 * the bundle regardless, and the timeout branch cannot be exercised from here.
 * The panel says so rather than claiming to observe anything.
 */
import { runBootGate, type GateOutcome } from '../../data/curriculum/bootGate';
import { CURRICULUM_SOURCE_KEY } from '../../data/curriculum/source';
import { supabase } from '../../lib/supabase';

export interface ServedSourceVerdict {
  /** The raw flag row, or null when the row does not exist. */
  flag: unknown;
  /** What the boot gate would decide, from the same code the learner runs. */
  outcome: GateOutcome;
  /** What the learner actually receives. Never "db" by accident. */
  served: 'db' | 'bundle';
  /**
   * True when the flag asks for `db` and the gate would refuse it.
   *
   * This is the state that used to be invisible, and it is the one an admin
   * needs to see: a panel reading `db` while every learner gets the bundle.
   */
  contradicted: boolean;
  /** Non-empty when a read failed, so an empty verdict is not mistaken for a verdict. */
  errors: string[];
}

async function readConfig(key: string): Promise<{ value: unknown } | { error: string }> {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) return { error: `${key}: ${error.message}` };
  if (!data) return { value: null };
  return { value: data.value };
}

/**
 * Run the learner's boot gate from the control centre.
 *
 * `timeoutMs` is set generously: the learner's own budget is 2500ms, and this
 * runs on an admin's connection with no learner waiting, so a slow read here is
 * not the same failure a slow read would be there. The two timeout branches are
 * reported as such rather than being allowed to masquerade as a content verdict.
 */
export async function checkServedSource(timeoutMs = 10_000): Promise<ServedSourceVerdict> {
  const errors: string[] = [];

  const flagRead = await readConfig(CURRICULUM_SOURCE_KEY);
  if ('error' in flagRead) errors.push(flagRead.error);
  const flag = 'error' in flagRead ? null : flagRead.value;

  const docRead = await readConfig('curriculum_document');
  if ('error' in docRead) errors.push(docRead.error);
  const doc = 'error' in docRead ? null : docRead.value;

  const outcome = await runBootGate({
    readFlag: async () => flag,
    fetchDoc: async () => doc,
    countUnits: (raw) =>
      Array.isArray((raw as { units?: unknown[] }).units) ? (raw as { units: unknown[] }).units.length : 0,
    timeoutMs,
  });

  const served = outcome.kind === 'db' ? 'db' : 'bundle';
  const asksForDb = typeof flag === 'string' && flag.trim().toLowerCase() === 'db';

  return {
    flag,
    outcome,
    served,
    // "Contradicted" is deliberately narrow: the flag asks for db, and the gate
    // would not give it. A flag reading `bundle` that serves the bundle is not
    // contradicted — it is the shipped default doing what it should.
    contradicted: asksForDb && served === 'bundle',
    errors,
  };
}

/**
 * The reason, as one displayable line.
 *
 * The `db` outcome carries no `reason` — it is the only outcome that is not
 * explaining a fallback — so it is named here rather than left blank, because a
 * blank cell in a diagnostic table reads as "not measured".
 */
export function verdictDetail(v: ServedSourceVerdict): string {
  return v.outcome.kind === 'db' ? 'db-ok' : v.outcome.reason;
}
