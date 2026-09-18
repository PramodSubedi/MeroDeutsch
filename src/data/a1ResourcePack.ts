/**
 * src/data/a1ResourcePack.ts
 *
 * Curated content from the published "MeroDeutsch A1 Resource Pack"
 * (extract_vocab/Google notebook-lm/a1-resource-pack.json), imported as
 * hand-verified client-side UI data following the established local-data
 * precedent (a1Verbs.ts / uhrzeit.ts / genderPronouns.ts) — NOT a wholesale
 * JSON copy and NOT a parallel DB pipeline:
 *
 *   - Data errors in the source pack were fixed during curation
 *     (inconsistent Devanagari conventions; U2's non-word secret "ZEAN" is
 *     NOT ported — NumberCypher already uses real German words).
 *   - Areas the app already ships (Uhrzeit drill, Code Cracker, pronoun
 *     matching, separable-verb focus) are NOT duplicated.
 *
 * Contents:
 *   1. A1_PHONETICS   — diphthong rules + consonant sound shifts (Unit 1)
 *   2. A1_POLITENESS  — Devanagari Redemittel table (Unit 1)
 *   3. ODD_ONE_OUT_ROUNDS — Phonetic + family-pronoun trap rounds (U1/U5)
 *   4. A1_VERB_DICE   — pronoun/verb dice config (Unit 3)
 *
 * Devanagari conventions follow scripts/enrich-cards.ts (V→F = फ, Ei→ऐ-style
 * approximations kept readable — native-phonetic, not Sanskrit).
 */

export interface PhoneticRule {
  /** The letter combination (e.g. "EI / AI"). */
  combo: string;
  /** Simple sound mnemonic ("Eye", "Eee", "Oy"…). */
  sound: string;
  /** 3-4 hand-verified example words (each carries the combo). */
  examples: string[];
  /** Optional teaching line (hidden in Nur DE along with EN/NE helpers). */
  note?: string;
}

/** Unit 1 — diphthong rules ("second-letter rule") + sound shifts. */
export const A1_PHONETICS: PhoneticRule[] = [
  { combo: 'EI / AI', sound: 'Eye', examples: ['mein', 'nein', 'Eis', 'Wein'], note: 'EI sounds like the letter I ("Eye") — mein, nein.' },
  { combo: 'IE', sound: 'Eee', examples: ['Spiel', 'hier', 'lieb', 'vier'], note: 'IE sounds like a long E ("Eee") — Spiel, hier.' },
  { combo: 'EU / ÄU', sound: 'Oy', examples: ['neu', 'Deutsch', 'Euro', 'Bäume'], note: 'EU/ÄU sounds like "Oy" — neu, Deutsch.' },
  { combo: 'AU', sound: 'Ow', examples: ['Haus', 'Frau', 'Baum', 'laufen'] },
];

/** Unit 1 — consonant sound shifts (W/V/Z/ST/SP). */
export const A1_SOUND_SHIFTS: PhoneticRule[] = [
  { combo: 'W', sound: 'V', examples: ['Wasser', 'wo', 'wer'], note: 'W is pronounced like English V — Wasser.' },
  { combo: 'V', sound: 'F', examples: ['Vater', 'vier', 'viel'], note: 'V is usually pronounced like English F — Vater.' },
  { combo: 'Z', sound: 'TS', examples: ['Zeit', 'zwei', 'zehn'], note: 'Z is ALWAYS "TS" (like in "cats") — Zeit.' },
  { combo: 'ST / SP', sound: 'SHT / SHP', examples: ['Straße', 'Sport', 'sprechen'], note: 'Initial ST/SP = "SHT"/"SHP" — Straße, Sport.' },
];

/** One Devanagari pronunciation Redemittel row (Unit 1 politeness table). */
export interface PolitenessItem {
  de: string;
  devanagari: string;
  en: string;
  ne?: string;
  /** Formal register flag (Sie-rows) — teaching only. */
  formal?: boolean;
}

/** Unit 1 — everyday expressions with native Devanagari pronunciation guides. */
export const A1_POLITENESS: PolitenessItem[] = [
  { de: 'Bitte!', devanagari: 'बिटे', en: "Please! / You're welcome!", ne: 'कृपया / स्वागत' },
  { de: 'Entschuldigung!', devanagari: 'एन्टशुल्डीगुङ्ग', en: 'Excuse me! / Sorry!', ne: 'माफ गर्नुहोस्' },
  { de: 'Entschuldigen Sie, bitte!', devanagari: 'एन्टशुल्डीगेन जि, बिटे', en: 'Excuse me, please!', ne: 'कृपया मलाई माफ गर्नुहोस्', formal: true },
  { de: 'Danke!', devanagari: 'डाङ्क', en: 'Thank you!', ne: 'धन्यवाद' },
  { de: 'Vielen Dank!', devanagari: 'फिलेन डाङ्क', en: 'Thank you very much!', ne: 'धेरै धन्यवाद' },
  { de: 'Danke schön!', devanagari: 'डाङ्क शेन', en: 'Thank you kindly!', ne: 'धन्यवाद' },
  { de: 'Bitte schön!', devanagari: 'बिटे शेन', en: "You're welcome!", ne: 'स्वागत' },
  { de: 'Willkommen!', devanagari: 'फिलकोमेन', en: 'Welcome!', ne: 'स्वागत' },
  { de: 'Gerne!', devanagari: 'गेर्ने', en: 'Gladly! / With pleasure!', ne: 'खुसीसाथ' },
  { de: 'Einen Moment, bitte!', devanagari: 'आइनेन मोमेन्ट, बिटे', en: 'Just a moment, please!', ne: 'एक क्षण, कृपया' },
  { de: 'Wie bitte?', devanagari: 'भी बिटे', en: 'Pardon?', ne: 'के भन्नुभयो?' },
  { de: 'Bitte wiederholen Sie!', devanagari: 'बिटे भीडरहोलेन जि', en: 'Please repeat!', ne: 'कृपया दोहोर्याउनुहोस्', formal: true },
  { de: 'Noch einmal, bitte!', devanagari: 'नोख आइनमाल, बिटे', en: 'Once again, please!', ne: 'फेरि एकपटक, कृपया' },
  { de: 'Ich verstehe (nicht).', devanagari: 'इख फेर्स्टेहे (निख्त)', en: "I (don't) understand.", ne: 'म (बुझ्दिनँ)।' },
];

/** One odd-one-out round: 3 words share a pattern, 1 breaks it. */
export interface OddOneOutRound {
  words: [string, string, string, string];
  /** Index into `words` of the trap word. */
  oddIndex: number;
  /** Teaching reason (EN + NE bridge; hidden in Nur DE). */
  reason: string;
  reasonNe: string;
}

export interface OddOneOutSet {
  id: 'phonetic' | 'pronoun';
  title: { en: string; de: string };
  instructions: { en: string; np: string };
  rounds: OddOneOutRound[];
}

/** Unit 1 Phonetic Trap Detector + Unit 5 Family Pronoun traps (curated). */
export const ODD_ONE_OUT_SETS: OddOneOutSet[] = [
  {
    id: 'phonetic',
    title: { en: 'Phonetic Trap Detector', de: 'Phonetik-Rätsel' },
    instructions: {
      en: 'Spot the word with a DIFFERENT sound pattern!',
      np: 'फरक उच्चारण ढाँचा भएको शब्द पत्ता लगाउनुहोस्!',
    },
    rounds: [
      {
        words: ['mein', 'nein', 'hier', 'Eis'],
        oddIndex: 2,
        reason: "'hier' uses IE (Eee sound) — all others use EI (Eye sound).",
        reasonNe: "'hier' मा IE (लामो E) छ भने अरूमा EI (Eye) छ।",
      },
      {
        words: ['neu', 'Deutsch', 'Euro', 'Haus'],
        oddIndex: 3,
        reason: "'Haus' uses AU (Ow sound) — all others use EU (Oy sound).",
        reasonNe: "'Haus' मा AU (Ow) छ भने अरूमा EU (Oy) छ।",
      },
      {
        words: ['Wasser', 'wo', 'wer', 'Vater'],
        oddIndex: 3,
        reason: "'Vater' starts with V (F sound) — all others start with W (V sound).",
        reasonNe: "'Vater' व = फ उच्चारण हुन्छ भने अरू W = भ।",
      },
      {
        words: ['Spiel', 'vier', 'lieb', 'Wein'],
        oddIndex: 3,
        reason: "'Wein' uses EI (Eye sound) — all others use IE (Eee sound).",
        reasonNe: "'Wein' मा EI (Eye) छ भने अरूमा IE (Eee) छ।",
      },
      {
        words: ['Straße', 'Sport', 'Stadt', 'Zeit'],
        oddIndex: 3,
        reason: "'Zeit' starts with Z (TS sound) — all others start with ST (SHT).",
        reasonNe: "'Zeit' व = ट्स उच्चारण हुन्छ भने अरू ST = श्ट।",
      },
    ],
  },
  {
    id: 'pronoun',
    title: { en: 'Family Pronoun Traps', de: 'Wer passt nicht?' },
    instructions: {
      en: 'Find the noun that does not belong to the same gender pattern!',
      np: 'एउटै लिङ्ग ढाँचामा नपर्ने संज्ञा छान्नुहोस्!',
    },
    rounds: [
      {
        words: ['er', 'der Bruder', 'die Mutter', 'der Vater'],
        oddIndex: 2,
        reason: "'die Mutter' is feminine (sie) — all others are masculine (er).",
        reasonNe: "'die Mutter' स्त्रीलिङ्ग (sie) हो भने अरू पुलिङ्ग (er) हुन्।",
      },
      {
        words: ['sie (she)', 'die Schwester', 'die Oma', 'der Opa'],
        oddIndex: 3,
        reason: "'der Opa' is masculine (er) — all others are feminine (sie).",
        reasonNe: "'der Opa' पुलिङ्ग (er) हो भने अरू स्त्रीलिङ्ग (sie) हुन्।",
      },
      {
        words: ['es', 'das Kind', 'das Mädchen', 'die Lehrerin'],
        oddIndex: 3,
        reason: "'die Lehrerin' is feminine (sie) — all others are neuter (es).",
        reasonNe: "'die Lehrerin' स्त्रीलिङ्ग (sie) हो भने अरू नपुंसक (es) हुन्।",
      },
    ],
  },
];

/** Unit 3 Verb-Dice config — dice faces map 1:1 to the A1_VERBS keys. */
export interface VerbDiceConfig {
  /** Dice face 1-6 → subject pronoun (matches A1_VERBS keys EXACTLY — no
   *  formal Sie, see the documented sie/Sie ambiguity in a1Verbs.ts). */
  pronounFaces: readonly Pronoun[];
  /** The 8 drill verbs (all present in A1_VERBS, hand-verified). */
  verbs: readonly string[];
  /** Conjugation countdown per turn (seconds). */
  timerSeconds: number;
}

export type Pronoun = 'ich' | 'du' | 'er' | 'sie' | 'wir' | 'ihr';

/** Subject labels shown for each face (er/sie/es share the 3sg form). */
export const PRONOUN_LABELS: Record<Pronoun, { de: string; en: string }> = {
  ich: { de: 'ich', en: 'I' },
  du: { de: 'du', en: 'you (informal)' },
  er: { de: 'er / sie / es', en: 'he / she / it' },
  sie: { de: 'sie (she)', en: 'she' },
  wir: { de: 'wir', en: 'we' },
  ihr: { de: 'ihr', en: 'you (plural)' },
};

export const A1_VERB_DICE: VerbDiceConfig = {
  pronounFaces: ['ich', 'du', 'er', 'sie', 'wir', 'ihr'],
  verbs: ['lernen', 'wohnen', 'kommen', 'sehen', 'sprechen', 'fahren', 'kaufen', 'trinken'],
  timerSeconds: 10,
};