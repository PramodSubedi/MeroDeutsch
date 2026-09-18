/**
 * src/data/a1Verbs.ts
 *
 * A1 present-tense conjugation reference for the Sentence Builder's
 * GENTLE feedback path. This is DATA used by the UI error analyzer — it is
 * NOT a sentence/roleplay content seed (those belong to Kilo's DB pipeline).
 *
 * - ~53 common A1 verbs, hand-verified present-tense forms (simple present).
 * - `FORM_TO_VERB` reverse map: conjugated form → infinitive.
 * - `getSubjectPerson` maps a subject token to grammatical person(s) with
 *   HONEST sie/Sie limits (a bare `sie` can be "she" 3sg OR "they" 3pl;
 *   `Sie` is formal address and takes the 3pl verb form).
 *
 * Design rule ("no full grammar parser"): the Sentence Builder never infers
 * the correct form from the subject alone. It reads the AUTHORITATIVE form
 * from the expected sentence and only uses the subject label for a friendlier
 * message — so even an ambiguous `sie` can never produce wrong advice.
 */

export type VerbPerson = 'ich' | 'du' | 'er' | 'sie' | 'wir' | 'ihr';

/** Present-tense map for one verb (sie = 3rd person singular feminine "she"). */
export type VerbFormMap = Record<VerbPerson, string>;

/** Person groups a subject token can resolve to. */
export type SubjectPersonGroup = '1sg' | '2sg' | '3sg' | '1pl' | '2pl' | '3pl' | 'formal';

/**
 * ~53 common A1 verbs in the present tense.
 * Explicit forms (hand-verified) keep the data readable and unambiguous —
 * no generative "grammar engine" behind it.
 */
export const A1_VERBS: Record<string, VerbFormMap> = {
  // — Copula / auxiliary / modals — (high-frequency irregulars)
  sein: { ich: 'bin', du: 'bist', er: 'ist', sie: 'ist', wir: 'sind', ihr: 'seid' },
  haben: { ich: 'habe', du: 'hast', er: 'hat', sie: 'hat', wir: 'haben', ihr: 'habt' },
  werden: { ich: 'werde', du: 'wirst', er: 'wird', sie: 'wird', wir: 'werden', ihr: 'werdet' },
  können: { ich: 'kann', du: 'kannst', er: 'kann', sie: 'kann', wir: 'können', ihr: 'könnt' },
  müssen: { ich: 'muss', du: 'musst', er: 'muss', sie: 'muss', wir: 'müssen', ihr: 'müsst' },
  dürfen: { ich: 'darf', du: 'darfst', er: 'darf', sie: 'darf', wir: 'dürfen', ihr: 'dürft' },
  sollen: { ich: 'soll', du: 'sollst', er: 'soll', sie: 'soll', wir: 'sollen', ihr: 'sollt' },
  wollen: { ich: 'will', du: 'willst', er: 'will', sie: 'will', wir: 'wollen', ihr: 'wollt' },
  mögen: { ich: 'mag', du: 'magst', er: 'mag', sie: 'mag', wir: 'mögen', ihr: 'mögt' },
  wissen: { ich: 'weiß', du: 'weißt', er: 'weiß', sie: 'weiß', wir: 'wissen', ihr: 'wisst' },

  // — Regular -en verbs —
  machen: { ich: 'mache', du: 'machst', er: 'macht', sie: 'macht', wir: 'machen', ihr: 'macht' },
  gehen: { ich: 'gehe', du: 'gehst', er: 'geht', sie: 'geht', wir: 'gehen', ihr: 'geht' },
  kommen: { ich: 'komme', du: 'kommst', er: 'kommt', sie: 'kommt', wir: 'kommen', ihr: 'kommt' },
  wohnen: { ich: 'wohne', du: 'wohnst', er: 'wohnt', sie: 'wohnt', wir: 'wohnen', ihr: 'wohnt' },
  kaufen: { ich: 'kaufe', du: 'kaufst', er: 'kauft', sie: 'kauft', wir: 'kaufen', ihr: 'kauft' },
  trinken: { ich: 'trinke', du: 'trinkst', er: 'trinkt', sie: 'trinkt', wir: 'trinken', ihr: 'trinkt' },
  lernen: { ich: 'lerne', du: 'lernst', er: 'lernt', sie: 'lernt', wir: 'lernen', ihr: 'lernt' },
  hören: { ich: 'höre', du: 'hörst', er: 'hört', sie: 'hört', wir: 'hören', ihr: 'hört' },
  spielen: { ich: 'spiele', du: 'spielst', er: 'spielt', sie: 'spielt', wir: 'spielen', ihr: 'spielt' },
  suchen: { ich: 'suche', du: 'suchst', er: 'sucht', sie: 'sucht', wir: 'suchen', ihr: 'sucht' },
  schreiben: { ich: 'schreibe', du: 'schreibst', er: 'schreibt', sie: 'schreibt', wir: 'schreiben', ihr: 'schreibt' },
  singen: { ich: 'singe', du: 'singst', er: 'singt', sie: 'singt', wir: 'singen', ihr: 'singt' },
  fliegen: { ich: 'fliege', du: 'fliegst', er: 'fliegt', sie: 'fliegt', wir: 'fliegen', ihr: 'fliegt' },
  schwimmen: { ich: 'schwimme', du: 'schwimmst', er: 'schwimmt', sie: 'schwimmt', wir: 'schwimmen', ihr: 'schwimmt' },
  kochen: { ich: 'koche', du: 'kochst', er: 'kocht', sie: 'kocht', wir: 'kochen', ihr: 'kocht' },
  telefonieren: { ich: 'telefoniere', du: 'telefonierst', er: 'telefoniert', sie: 'telefoniert', wir: 'telefonieren', ihr: 'telefoniert' },
  bringen: { ich: 'bringe', du: 'bringst', er: 'bringt', sie: 'bringt', wir: 'bringen', ihr: 'bringt' },
  stehen: { ich: 'stehe', du: 'stehst', er: 'steht', sie: 'steht', wir: 'stehen', ihr: 'steht' },

  // — Verbs with -t/-d stems (insert -e- before st/t) —
  arbeiten: { ich: 'arbeite', du: 'arbeitest', er: 'arbeitet', sie: 'arbeitet', wir: 'arbeiten', ihr: 'arbeitet' },
  warten: { ich: 'warte', du: 'wartest', er: 'wartet', sie: 'wartet', wir: 'warten', ihr: 'wartet' },
  kosten: { ich: 'koste', du: 'kostest', er: 'kostet', sie: 'kostet', wir: 'kosten', ihr: 'kostet' },
  antworten: { ich: 'antworte', du: 'antwortest', er: 'antwortet', sie: 'antwortet', wir: 'antworten', ihr: 'antwortet' },
  finden: { ich: 'finde', du: 'findest', er: 'findet', sie: 'findet', wir: 'finden', ihr: 'findet' },

  // — Verbs with s/ß/x/z stems (du = -t, no extra e) —
  reisen: { ich: 'reise', du: 'reist', er: 'reist', sie: 'reist', wir: 'reisen', ihr: 'reist' },
  tanzen: { ich: 'tanze', du: 'tanzt', er: 'tanzt', sie: 'tanzt', wir: 'tanzen', ihr: 'tanzt' },
  sitzen: { ich: 'sitze', du: 'sitzt', er: 'sitzt', sie: 'sitzt', wir: 'sitzen', ihr: 'sitzt' },
  putzen: { ich: 'putze', du: 'putzt', er: 'putzt', sie: 'putzt', wir: 'putzen', ihr: 'putzt' },
  heißen: { ich: 'heiße', du: 'heißt', er: 'heißt', sie: 'heißt', wir: 'heißen', ihr: 'heißt' },

  // — Stem-changing vowels (e→i/ie, a→ä, au→äu) —
  lesen: { ich: 'lese', du: 'liest', er: 'liest', sie: 'liest', wir: 'lesen', ihr: 'lest' },
  sehen: { ich: 'sehe', du: 'siehst', er: 'sieht', sie: 'sieht', wir: 'sehen', ihr: 'seht' },
  sprechen: { ich: 'spreche', du: 'sprichst', er: 'spricht', sie: 'spricht', wir: 'sprechen', ihr: 'sprecht' },
  essen: { ich: 'esse', du: 'isst', er: 'isst', sie: 'isst', wir: 'essen', ihr: 'esst' },
  nehmen: { ich: 'nehme', du: 'nimmst', er: 'nimmt', sie: 'nimmt', wir: 'nehmen', ihr: 'nehmt' },
  geben: { ich: 'gebe', du: 'gibst', er: 'gibt', sie: 'gibt', wir: 'geben', ihr: 'gebt' },
  helfen: { ich: 'helfe', du: 'hilfst', er: 'hilft', sie: 'hilft', wir: 'helfen', ihr: 'helft' },
  treffen: { ich: 'treffe', du: 'triffst', er: 'trifft', sie: 'trifft', wir: 'treffen', ihr: 'trefft' },
  werfen: { ich: 'werfe', du: 'wirfst', er: 'wirft', sie: 'wirft', wir: 'werfen', ihr: 'werft' },
  fahren: { ich: 'fahre', du: 'fährst', er: 'fährt', sie: 'fährt', wir: 'fahren', ihr: 'fahrt' },
  schlafen: { ich: 'schlafe', du: 'schläfst', er: 'schläft', sie: 'schläft', wir: 'schlafen', ihr: 'schlaft' },
  laufen: { ich: 'laufe', du: 'läufst', er: 'läuft', sie: 'läuft', wir: 'laufen', ihr: 'lauft' },
  beginnen: { ich: 'beginne', du: 'beginnst', er: 'beginnt', sie: 'beginnt', wir: 'beginnen', ihr: 'beginnt' },
  öffnen: { ich: 'öffne', du: 'öffnest', er: 'öffnet', sie: 'öffnet', wir: 'öffnen', ihr: 'öffnet' },
  rechnen: { ich: 'rechne', du: 'rechnest', er: 'rechnet', sie: 'rechnet', wir: 'rechnen', ihr: 'rechnet' },
};

/** Reverse lookup: conjugated form → verb infinitive (deterministic; A1 set has no cross-verb form collisions). */
export const FORM_TO_VERB: Record<string, string> = {};
for (const [verb, forms] of Object.entries(A1_VERBS)) {
  for (const form of Object.values(forms)) {
    FORM_TO_VERB[form] = verb;
  }
  // 3rd-person plural ("sie" they) and the formal "Sie" share the infinitive /
  // wir-form for EVERY German verb. Registering it once keeps "sie machen" /
  // "Sie haben" detectable without doubling the table.
  FORM_TO_VERB[forms.wir] = verb;
}

/**
 * Resolve a subject token to grammatical person group(s).
 *
 * HONEST sie/Sie limits (documented):
 *  - lowercase `sie` is ambiguous — "she" (3sg) or "they" (3pl). Both are
 *    returned; the caller must NOT guess a single person.
 *  - `Sie` (capitalized) is formal address and takes the 3PL verb form.
 *  - `er`/`es` → 3sg; `ihr` → 2pl; `wir` → 1pl; `du` → 2sg; `ich` → 1sg.
 *  - Non-pronoun subjects (proper names, nouns) → `null`.
 */
export function getSubjectPerson(token: string): SubjectPersonGroup[] | null {
  const t = token.trim();
  if (!t) return null;
  // Formal "Sie" must be matched on exact original case (expected words keep case).
  if (t === 'Sie') return ['formal'];
  switch (t.toLowerCase()) {
    case 'ich': return ['1sg'];
    case 'du': return ['2sg'];
    case 'er':
    case 'es': return ['3sg'];
    case 'sie': return ['3sg', '3pl']; // she OR they — ambiguous
    case 'wir': return ['1pl'];
    case 'ihr': return ['2pl'];
    default: return null;
  }
}

/**
 * A1 separable verbs (trennbare Verben) — hand-verified metadata.
 *
 * Used by the Sentence Builder page's "Trennbare Verben" focus to detect which
 * cached sentence exercises drill a separable verb (deterministic check — NO
 * generative grammar logic):
 *   1. the sentence's LAST word equals the verb's prefix (main-clause rule:
 *      the prefix always lands at the very end), AND
 *   2. some other word starts with the verb's bare stem.
 *
 * `stem` is the infinitive minus prefix minus the "-en" ending (e.g.
 * aufstehen → "steh"), matched with startsWith so the conjugated form
 * (stehe/stehst/steht) is caught regardless of ending.
 */
export interface SeparableVerbMeta {
  /** Detachable prefix (Position "end" of the main clause). */
  prefix: string;
  /** Bare stem used for startsWith detection (case-insensitive). */
  stem: string;
}

export const A1_SEPARABLE: Record<string, SeparableVerbMeta> = {
  aufstehen: { prefix: 'auf', stem: 'steh' },
  aufhören: { prefix: 'auf', stem: 'hör' },
  aufmachen: { prefix: 'auf', stem: 'mach' },
  einkaufen: { prefix: 'ein', stem: 'kauf' },
  einladen: { prefix: 'ein', stem: 'lad' },
  anrufen: { prefix: 'an', stem: 'ruf' },
  ankommen: { prefix: 'an', stem: 'komm' },
  abholen: { prefix: 'ab', stem: 'hol' },
  abgeben: { prefix: 'ab', stem: 'geb' },
  aussteigen: { prefix: 'aus', stem: 'steig' },
  ausfüllen: { prefix: 'aus', stem: 'füll' },
  ausgehen: { prefix: 'aus', stem: 'geh' },
  mitkommen: { prefix: 'mit', stem: 'komm' },
  mitnehmen: { prefix: 'mit', stem: 'nehm' },
  fernsehen: { prefix: 'fern', stem: 'seh' },
  umsteigen: { prefix: 'um', stem: 'steig' },
  vorstellen: { prefix: 'vor', stem: 'stell' },
  zuhören: { prefix: 'zu', stem: 'hör' },
};

/**
 * Detect whether a German sentence (as a word array) drills a separable verb.
 * Returns the matched infinitive or null. Deterministic — see docs above.
 */
export function detectSeparableVerb(words: string[]): string | null {
  if (words.length < 2) return null;
  const last = (words[words.length - 1] ?? '').toLowerCase().replace(/[.!?]/g, '');
  for (const [infinitive, meta] of Object.entries(A1_SEPARABLE)) {
    if (last !== meta.prefix) continue;
    const hasStem = words
      .slice(0, -1)
      .some((w) => w.toLowerCase().replace(/[.!?]/g, '').startsWith(meta.stem));
    if (hasStem) return infinitive;
  }
  return null;
}

/**
 * The 8 fixed INSEPARABLE prefixes (untrennbare Vorsilben) — be- emp- ent-
 * er- ge- miss- ver- zer- (A1 Resource Pack Unit 4).
 *
 * Unlike separable prefixes, these NEVER split: the conjugated form keeps the
 * stress on the stem and the whole verb stays together at Position 2
 * ("Ich besuche den Kurs." / "Ich verstehe das."). Prefix classifiers and the
 * Sentence Builder note use this list to teach the contrast with
 * `A1_SEPARABLE`.
 */
export const A1_INSEPARABLE_PREFIXES = [
  'be', 'emp', 'ent', 'er', 'ge', 'miss', 'ver', 'zer',
] as const;