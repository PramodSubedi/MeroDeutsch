/**
 * src/utils/conversationalToRoleplay.ts
 *
 * Builds ready-to-play `RoleplayScenario[]` from the conversational content
 * sources, which now live in the `content_items` database pools:
 *  - `conversation-vocab`   — the single-sentence bank
 *  - `conversation-def`     — 9 scenarios × 3–4 dialogue variants
 *
 * `buildConversationalScenarios(defs, vocab)` is DATA-DRIVEN so pages can prefer
 * the database (curriculumService → content pools → Dexie cache) and fall back
 * to the bundled JSON files (`buildBundledConversationalScenarios`) when the
 * pools are empty/pre-seed.
 *
 * Every learner turn references its sentence either by `ref` (the unique
 * `german_text` in the vocab bank) or by an inline `t` with translations. The
 * builder resolves refs against the bank so each scenario INHERITS the card's
 * context, CEFR level and grammar focus without duplicating data.
 *
 * Variety: one variant per scenario is picked at random; the variant played most
 * recently for that scenario is avoided when alternatives exist.
 *
 * Output = the existing `RoleplayScenario` type → consumed by `MessagingRoleplay`
 * unchanged (chat UI, XP + SRS reporting all reused).
 */
import type {
  RoleplayScenario,
  RoleplayOption,
  ConversationVocab,
  ConversationScenarioSeed,
  ConversationOptionSeed,
} from '../types/curriculum';
import vocabBankJson from '../data/conversational_german_vocab.json';
import scenarioDefsJson from '../data/conversational_scenario_defs.json';

/** One exchange step of a definition (alias for brevity). */
type StepDef = ConversationScenarioSeed['variants'][number]['steps'][number];

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

/** Random variant index that avoids the previously-picked one when possible. */
function pickVariantIndex(sid: string, count: number): number {
  if (count <= 1) return 0;
  const last = readLastPicks()[sid];
  let idx = Math.floor(Math.random() * count);
  if (last !== undefined && idx === last) idx = (idx + 1) % count;
  writeLastPick(sid, idx);
  return idx;
}

function resolveOption(
  o: ConversationOptionSeed,
  cards: Map<string, ConversationVocab>,
): RoleplayOption | null {
  if (typeof o.ref === 'string') {
    const card = cards.get(o.ref);
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
  def: ConversationOptionSeed[],
  cards: Map<string, ConversationVocab>,
): { grammarFocus?: string; cefrLevel?: string } {
  const ok = def.find((o) => o.ok);
  if (!ok || typeof ok.ref !== 'string') return {};
  const card = cards.get(ok.ref);
  if (!card) return {};
  return { grammarFocus: card.grammar_focus, cefrLevel: card.cefr_level };
}

/**
 * Compose one scenario per definition into playable micros from data-sourced
 * definitions + vocab cards. Call again (e.g. "Next conversation") to shuffle.
 */
export function buildConversationalScenarios(
  defs: ConversationScenarioSeed[],
  vocab: ConversationVocab[],
): RoleplayScenario[] {
  const cards = new Map<string, ConversationVocab>(vocab.map((c) => [c.german_text, c]));
  const scenarios: RoleplayScenario[] = [];

  for (const def of defs) {
    if (!def.variants || def.variants.length === 0) continue;
    const vIdx = pickVariantIndex(def.sid, def.variants.length);
    const variant = def.variants[vIdx];
    const steps = (variant.steps ?? [])
      .map((s: StepDef) => {
        const options = (s.opts ?? [])
          .map((o) => resolveOption(o, cards))
          .filter((o): o is RoleplayOption => o !== null);
        const { grammarFocus, cefrLevel } = stepPedagogy(s.opts ?? [], cards);
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
      ...(variant.roleFlip ? { roleFlip: true } : {}),
    });
  }
  return scenarios;
}

/**
 * Bundled JSON fallback — used when the DB content pools are empty (pre-seed)
 * or unreachable. Reads the two committed JSON files directly.
 */
export function buildBundledConversationalScenarios(): RoleplayScenario[] {
  return buildConversationalScenarios(
    scenarioDefsJson as unknown as ConversationScenarioSeed[],
    vocabBankJson as unknown as ConversationVocab[],
  );
}