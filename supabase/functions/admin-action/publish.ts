/**
 * supabase/functions/admin-action/publish.ts
 *
 * PUBLISH VALIDATION — pure, no Supabase import, exhaustively tested.
 *
 * ── WHY THIS IS SEPARATE FROM THE HANDLER ──────────────────────────────────
 * Publishing curriculum is the most dangerous write in the system: it changes
 * what every learner sees, and the failure mode is invisible — content that
 * passes a shape check and then breaks `getNodeByRoute` mid-lesson, on someone
 * else's device, with no rollback except a redeploy.
 *
 * So the rules live here where they can be tested against a hundred hostile
 * inputs, rather than inside a request handler.
 */

// ── The curated allow-list of config keys ───────────────────────────────────
//
// `config.set` writes `app_config`, which the LEARNER APP reads on every boot.
// An arbitrary key is a channel for enabling something nobody reviewed, so the
// writable set is closed and each entry states what it may contain.
export interface ConfigKeySpec {
  types: ('boolean' | 'string')[];
  /** For string keys: the complete set of legal values. */
  values?: readonly string[];
  description: string;
}

export const CONFIG_KEYS: Readonly<Record<string, ConfigKeySpec>> = {
  curriculum_source: {
    types: ['string'],
    values: ['bundle', 'db'],
    description: 'Which curriculum the app serves. db is only safe with a verified backfill.',
  },
  maintenance_mode: {
    types: ['boolean'],
    description: 'Blocks learners out of the app while you work on it.',
  },
  registration_open: {
    types: ['boolean'],
    description: 'Whether new signups are accepted.',
  },
};

export type ConfigCheck = { ok: true } | { ok: false; message: string };

/**
 * Validate a config write.
 *
 * Rejects an UNKNOWN KEY rather than writing it. A key nobody wrote a spec for
 * is either a typo or something granted more power than anyone intended, and
 * both should stop at the door.
 */
export function validateConfigWrite(key: unknown, value: unknown): ConfigCheck {
  if (typeof key !== 'string' || key.trim() === '') {
    return { ok: false, message: 'A config key is required.' };
  }
  const spec = CONFIG_KEYS[key];
  if (!spec) {
    return {
      ok: false,
      message: `"${key}" is not a writable config key. Writable keys: ${Object.keys(CONFIG_KEYS).join(', ')}.`,
    };
  }

  // A JSONB column unwraps `true` to boolean, but a hand-written row may hold
  // the string "true". Both are accepted; anything else is not.
  if (spec.types.includes('boolean')) {
    if (value !== true && value !== false && value !== 'true' && value !== 'false') {
      return { ok: false, message: `"${key}" must be true or false.` };
    }
    return { ok: true };
  }

  if (spec.types.includes('string')) {
    if (typeof value !== 'string' || value.trim() === '') {
      return { ok: false, message: `"${key}" must be a non-empty string.` };
    }
    const v = value.trim().toLowerCase();
    if (spec.values && !spec.values.includes(v)) {
      return { ok: false, message: `"${v}" is not valid for ${key}. Allowed: ${spec.values?.join(', ')}.` };
    }
    return { ok: true };
  }

  return { ok: false, message: `"${key}" has no writable type.` };
}

export interface UnitDoc {
  id?: unknown;
  order?: unknown;
  [k: string]: unknown;
}

export interface PublishCheck {
  ok: boolean;
  /** Fatal. The publish is refused if this is non-empty. */
  errors: string[];
  /** Non-fatal notes, surfaced but not blocking. */
  warnings: string[];
}

/** Hard structural rules applied BEFORE the full curriculum validator runs. */
export function checkUnitShape(doc: unknown): PublishCheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    return { ok: false, errors: ['unit must be a JSON object'], warnings };
  }
  const u = doc as UnitDoc;

  if (typeof u.id !== 'string' || !/^m\d{2}$/.test(u.id)) {
    errors.push(`unit.id must look like "m07" (got ${JSON.stringify(u.id)})`);
  }
  if (typeof u.order !== 'number' || !Number.isInteger(u.order) || u.order < 1) {
    errors.push(`unit.order must be an integer >= 1 (got ${JSON.stringify(u.order)})`);
  }
  if (!Array.isArray(u.nodes) || u.nodes.length === 0) {
    errors.push('unit.nodes must be a non-empty array');
  }

  // A unit with no checkpoint would let a learner finish it without ever being
  // gated, which defeats the spine.
  const nodes: unknown[] = Array.isArray(u.nodes) ? u.nodes : [];
  const hasCheckpoint = nodes.some((n) => (n as { kind?: unknown })?.kind === 'checkpoint');
  if (nodes.length > 0 && !hasCheckpoint) {
    errors.push('unit has no checkpoint node; a learner could complete it ungated');
  }

  // Node ids must be unique within the unit, or route lookup returns whichever
  // matched first and the spine silently loses a step.
  const ids = nodes.map((n) => (n as { id?: unknown })?.id).filter((i): i is string => typeof i === 'string');
  const dupes = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (dupes.length > 0) errors.push(`duplicate node id(s) within the unit: ${dupes.join(', ')}`);

  if (u.title === undefined) warnings.push('unit.title is missing');
  if (nodes.length === 1) warnings.push('a single-node unit has no learn/practice split');

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Decide whether a set of unit documents may be published TOGETHER.
 *
 * Cross-unit rules are the ones a per-unit check cannot see:
 *   · ids and orders must be unique
 *   · orders must be CONTIGUOUS FROM 1 — no gaps
 *
 * The last one is why this is a set-level check. Holding drafts for units 1-7
 * while 8-15 are absent is fine; PUBLISHING that set would silently shorten the
 * course for everyone, which is precisely the kind of damage a per-row check
 * cannot catch.
 */
export interface PublishSetOptions {
  /**
   * How many units the table actually holds, when the caller knows.
   *
   * Without it, a set of units 1-7 with contiguous orders IS internally valid,
   * and this function cannot tell that 8-15 exist. That is a real hazard —
   * publishing a truncated spine drops the rest of the course for everyone
   * mid-way through — but it is a HAZARD, not a malformed set, so it is
   * surfaced as a warning rather than refused.
   *
   * The handler passes the real count, so the operator sees "you are publishing
   * 7 of 15" and decides. Silently refusing a deliberate partial publish would
   * just teach people to bypass the check.
   */
  expectedCount?: number;
}

export function checkPublishSet(docs: unknown[], options: PublishSetOptions = {}): PublishCheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(docs) || docs.length === 0) {
    return { ok: false, errors: ['nothing to publish'], warnings };
  }

  for (const d of docs) {
    const shape = checkUnitShape(d);
    errors.push(...shape.errors);
    warnings.push(...shape.warnings);
  }

  const orders = docs
    .map((d) => (d as UnitDoc).order)
    .filter((o): o is number => typeof o === 'number' && Number.isInteger(o));
  const ids = docs
    .map((d) => (d as UnitDoc).id)
    .filter((i): i is string => typeof i === 'string');

  const dupOrder = [...new Set(orders.filter((o, i) => orders.indexOf(o) !== i))];
  if (dupOrder.length > 0) errors.push(`duplicate order(s): ${dupOrder.join(', ')}`);
  const dupId = [...new Set(ids.filter((i, ix) => ids.indexOf(i) !== ix))];
  if (dupId.length > 0) errors.push(`duplicate unit id(s): ${dupId.join(', ')}`);

  // A GAP is a hard error and is detectable from the set alone: orders 1,2,4
  // are internally broken regardless of how many units exist.
  const sorted = [...orders].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i] !== i + 1) {
      errors.push(
        `orders must be contiguous from 1; position ${i + 1} holds order ${sorted[i]} - a unit is missing or misnumbered`,
      );
      break;
    }
  }

  // A SHORT set is only suspicious in context, so it warns.
  const expected = options.expectedCount;
  if (typeof expected === 'number' && expected > docs.length) {
    warnings.push(
      `publishing ${docs.length} of ${expected} unit(s): the published spine will be shorter than the table. Learners past unit ${docs.length} would lose access.`,
    );
  }

  return { ok: errors.length === 0, errors, warnings };
}

