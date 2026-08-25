/**
 * src/utils/conversationalToRoleplay.ts
 *
 * Builds ready-to-play `RoleplayScenario[]` from two bundled JSON sources:
 *  - `conversational_german_vocab.json`   — the untouched single-sentence bank
 *  - `conversational_scenario_defs.json`  — 9 scenarios × 3–4 dialogue variants
 *
 * Every learner turn references its sentence either by `ref` (the unique
 * `german_text` in the vocab bank) or by an inline `t` with translations.
 * The builder resolves refs against the bank, so each scenario INHERITS the
 * card's context, CEFR level and grammar focus without duplicating data.
 *
 * Variety: one variant per scenario is picked at random per build; the variant
 * played most recently for that scenario is avoided when alternatives exist,
 * so the learner does not see the same conversation every time.
 *
 * Output shape = the EXISTING `RoleplayScenario` type → consumed by
 * `MessagingRoleplay` unchanged (chat UI, XP + SRS reporting all reused).
 */
import type { RoleplayScenario, RoleplayOption } from '../types/curriculum';
import vocabBank from '../data/conversational_german_vocab.json';
import scenarioDefs from '../data/conversational_scenario_defs.json';

interface VocabCard {
  german_text: string;
  cefr_level: string;
  grammar_focus: string;
  context_situation: string;
  translations: { en: string; ne: string; ne_roman: string };
}

/** One quick-reply option in a definition step. */
interface OptionDef {
  /** Unique `german_text` inside the vocab bank (correct answers use this). */
  ref?: string;
  /** Inline learner turn for situation-specific lines (e.g. ordering pizza). */
  t?: string;
  en?: string;
  ne?: string;
  neR?: string;
  ok?: boolean;
  fb?: string;
  /** Optional NPC reply to this exact choice (branching-lite). */
  reaction?: string;
  reactionEn?: string;
  /** Optional target step index to route to after choosing this option. */
  next?: number;
}

interface StepDef {
  /** Leading line — the NPC says it, or the learner initiates when `from: 'me'`. */
  n: string;
  nEn?: string;
  /** Learner initiates the exchange when true. */
  from?: 'npc' | 'me';
  /** English instruction shown to the learner. */
  p: string;
  opts: OptionDef[];
}

interface VariantDef {
  id: string;
  name: string;
  steps: StepDef[];
}

interface ScenarioDef {
  sid: string;
  title: string;
  titleEn: string;
  emoji: string;
  ctx: string;
  band: string;
  /** Optional NPC farewell after the last step. */
  closing?: string;
  variants: VariantDef[];
}
const CARDS = new Map<string, VocabCard>(
  (vocabBank as VocabCard[]).map((c) => [c.german_text, c]),
);

const LAST_PICK_KEY = 'meroDeutschConvPick';

function readLastPicks(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(LAST_PICK_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

function writeLastPick(sid: string, idx: number): void {
  try {
    const picks = readLastPicks();
    picks[sid] = idx;
    localStorage.setItem(LAST_PICK_KEY, JSON.stringify(picks));
  } catch {
    /* storage unavailable — shuffling still works, just without memory */
  }
}

/** Random variant index that avoids the previously played one when possible. */
function pickVariantIndex(sid: string, count: number): number {
  if (count <= 1) return 0;
  const last = readLastPicks()[sid];
  let idx = Math.floor(Math.random() * count);
  if (last !== undefined && idx === last) idx = (idx + 1) % count;
  writeLastPick(sid, idx);
  return idx;
}

function resolveOption(o: OptionDef): RoleplayOption | null {
  if (typeof o.ref === 'string') {
    const card = CARDS.get(o.ref);
    if (!card) return null;
    return {
      text: card.german_text,
      ok: o.ok ?? false,
      fb: o.fb ?? 'Perfekt!',
      en: card.translations.en,
      ne: card.translations.ne,
      neR: card.translations.ne_roman,
      ...(o.reaction ? { reaction: o.reaction, reactionEn: o.reactionEn } : {}),
      ...(typeof o.next === 'number' ? { next: o.next } : {}),
    };
  }
  if (typeof o.t === 'string') {
    return {
      text: o.t,
      ok: o.ok ?? false,
      fb: o.fb ?? 'Versuch es noch einmal!',
      en: o.en,
      ne: o.ne,
      neR: o.neR,
      ...(o.reaction ? { reaction: o.reaction, reactionEn: o.reactionEn } : {}),
      ...(typeof o.next === 'number' ? { next: o.next } : {}),
    };
  }
  return null;
}

/** Grammar + level are inherited from the card behind the CORRECT option. */
function stepPedagogy(
  def: OptionDef[],
): { grammarFocus?: string; cefrLevel?: string } {
  const ok = def.find((o) => o.ok);
  if (!ok || typeof ok.ref !== 'string') return {};
  const card = CARDS.get(ok.ref);
  if (!card) return {};
  return { grammarFocus: card.grammar_focus, cefrLevel: card.cefr_level };
}

/**
 * Compose one random variant per scenario into playable roleplays.
 * Deterministic per call; call again (e.g. from a "Next conversation" button)
 * to shuffle a fresh set.
 */
export function buildConversationalScenarios(): RoleplayScenario[] {
  const scenarios: RoleplayScenario[] = [];
  for (const def of scenarioDefs as unknown as ScenarioDef[]) {
    const vIdx = pickVariantIndex(def.sid, def.variants.length);
    const variant = def.variants[vIdx];
    const steps = variant.steps
      .map((s) => {
        const options = s.opts
          .map(resolveOption)
          .filter((o): o is RoleplayOption => o !== null);
        const { grammarFocus, cefrLevel } = stepPedagogy(s.opts);
        return {
          npc: s.n,
          npcEn: s.nEn,
          ...(s.from === 'me' ? { from: 'me' as const } : {}),
          prompt: s.p,
          options,
          ...(grammarFocus ? { grammarFocus } : {}),
          ...(cefrLevel ? { cefrLevel } : {}),
        };
      })
      .filter((st) => st.options.length > 0 && st.options.some((o) => o.ok));
    if (steps.length === 0) continue;
    scenarios.push({
      id: def.sid,
      title: def.title,
      emoji: def.emoji,
      level: def.band,
      steps,
      ...(def.closing ? { closing: def.closing } : {}),
    });
  }
  return scenarios;
}
