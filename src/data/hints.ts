/**
 * src/data/hints.ts
 *
 * U4 — Micro-hints on wrong answers.
 *
 * A small shared hint map (moduleType + reason) so Articles quiz, A1
 * checkpoints, and Sentence Builder can show ONE short teaching line (EN + NE)
 * after a wrong answer — without copy-pasting hint text across pages.
 *
 * Nur-DE behavior: the EN/NE helper lines are hidden when langMode === 'german'
 * (German UI labels are fine). The hint text itself is trilingual:
 *   - en: English teaching line
 *   - ne: Nepali teaching line
 *   - de: German teaching line (shown in Nur DE)
 *
 * Fallback: if no specific hint matches, a generic "Check the article / word
 * order" style message is used (see getHint).
 */

export interface HintText {
  en: string;
  ne: string;
  de: string;
}

/** Generic fallback hints per module family. */
const GENERIC: Record<string, HintText> = {
  articles: {
    en: 'Check the article — der (m), die (f), das (n).',
    ne: 'लेख जाँच्नुहोस् — der (पुलिङ्ग), die (स्त्रीलिङ्ग), das (नपुंसक)।',
    de: 'Prüfe den Artikel — der (m), die (f), das (n).',
  },
  'a1-checkpoint': {
    en: 'Check the article or word order.',
    ne: 'लेख वा शब्द क्रम जाँच्नुहोस्।',
    de: 'Prüfe den Artikel oder die Wortstellung.',
  },
  grammar: {
    en: 'Check the word order.',
    ne: 'शब्द क्रम जाँच्नुहोस्।',
    de: 'Prüfe die Wortstellung.',
  },
};

/** Specific hints keyed by `moduleType:reason`. */
const SPECIFIC: Record<string, HintText> = {
  // Articles quiz — wrong article choice.
  'articles:wrong-article': {
    en: 'Nouns have a fixed gender — learn the article with the noun.',
    ne: 'संज्ञाको निश्चित लिङ्ग हुन्छ — संज्ञासँगै लेख सिक्नुहोस्।',
    de: 'Substantive haben ein festes Genus — lerne den Artikel mit dem Nomen.',
  },
  // A1 checkpoint — article-precision question.
  'a1-checkpoint:article-precision': {
    en: 'Match the noun’s gender: der (m), die (f), das (n).',
    ne: 'संज्ञाको लिङ्ग मिलाउनुहोस्: der (पुलिङ्ग), die (स्त्रीलिङ्ग), das (नपुंसक)।',
    de: 'Ordne das Genus zu: der (m), die (f), das (n).',
  },
  // A1 checkpoint — grammar-drill (word order).
  'a1-checkpoint:grammar-drill': {
    en: 'German puts the verb in 2nd position in main clauses.',
    ne: 'जर्मनमा मुख्य वाक्यमा क्रिया दोस्रो स्थानमा हुन्छ।',
    de: 'Im Hauptsatz steht das Verb an zweiter Stelle.',
  },
  // Sentence Builder — Akkusativ der -> den.
  'grammar:akkusativ': {
    en: 'In the accusative, masculine der changes to den.',
    ne: 'कर्म कारकमा पुलिङ्ग der बदलेर den हुन्छ।',
    de: 'Im Akkusativ wird der zu den.',
  },
  // Sentence Builder — missing/incorrect word.
  'grammar:missing-word': {
    en: 'A word is missing or incorrect — check each tile.',
    ne: 'एउटा शब्द छुटेको वा गलत छ — प्रत्येक टाइल जाँच्नुहोस्।',
    de: 'Ein Wort fehlt oder ist falsch — prüfe jede Kachel.',
  },
  // Sentence Builder — word order / spelling.
  'grammar:word-order': {
    en: 'Check the word order or spelling.',
    ne: 'शब्द क्रम वा हिज्जे जाँच्नुहोस्।',
    de: 'Prüfe die Wortstellung oder Schreibweise.',
  },
  // Sentence Builder — noun capitalization.
  'grammar:capitalization': {
    en: 'All German nouns start with a CAPITAL letter.',
    ne: 'जर्मन संज्ञा सधैं ठूलो अक्षरले सुरु हुन्छ।',
    de: 'Alle Substantive werden GROSS geschrieben.',
  },
  // Sentence Builder — wrong verb conjugation.
  'grammar:verb-conjugation': {
    en: 'Match the verb to the subject — e.g. "ich habe", "wir haben".',
    ne: 'क्रियालाई कर्तासँग मिलाउनुहोस् — जस्तै "ich habe", "wir haben"।',
    de: 'Passe das Verb an das Subjekt an — z. B. "ich habe", "wir haben".',
  },
  // Sentence Builder — separable verbs (trennbare Verben).
  'grammar:separable': {
    en: 'Separable verbs split: the conjugated stem stays in Position 2 and the prefix goes to the END — "Ich stehe um sechs Uhr auf."',
    ne: 'छुट्टिने क्रिया दुई भागमा विभाजित हुन्छ — क्रियाधार दोस्रो स्थानमा बस्छ, उपसर्ग वाक्यको अन्त्यमा जान्छ — "Ich stehe um sechs Uhr auf."।',
    de: 'Trennbare Verben werden getrennt: der Stamm bleibt an Position 2, das Präfix steht am ENDE — „Ich stehe um sechs Uhr auf."',
  },
  // Articles page — gender → pronoun matching mode.
  'articles:pronoun': {
    en: 'The pronoun follows the gender: der → er · die → sie · das → es.',
    ne: 'सर्वनाम लिङ्गअनुसार बदलिन्छ: der → er · die → sie · das → es।',
    de: 'Das Pronomen folgt dem Genus: der → er · die → sie · das → es.',
  },
  // A1 checkpoint — Perfekt (Module 15). LIVE, not dead config: the checkpoint
  // sets `hintReason` to the grammar drill's CATEGORY (not the generic
  // 'grammar-drill' source), so this key is actually reached.
  'a1-checkpoint:perfekt': {
    en: 'Perfekt = auxiliary in Position 2 + Partizip II at the end. Use sein for movement (gehen, kommen, fahren), haben for everything else.',
    ne: 'पर्फेक्ट = सहायक क्रिया दोस्रो स्थानमा + पार्टिजिप द्वितीय अन्त्यमा। गतिका क्रियामा sein (gehen, kommen, fahren), अरूमा haben प्रयोग गर्नुहोस्।',
    de: 'Perfekt = Hilfsverb an Position 2 + Partizip II am Ende. Bei Bewegung nehmen Sie sein (gehen, kommen, fahren), sonst haben.',
  },

  /* ── v4.0 phase-1/3 categories. Each one is reachable: the checkpoint sets
     `hintReason` to the drill CATEGORY, and `hasSpecificHint` prefers it over
     the generic 'grammar-drill' fallback. Without these, a learner who missed a
     dative or V2 item would have been told the generic "check the article or
     word order" line — which is useless for exactly the structures these
     categories exist to teach. ─────────────────────────────────────────── */
  'a1-checkpoint:dative': {
    en: 'Dative = dem / der / den. After mit, an, in, zu and von: "mit dem Bus", "am Bahnhof", "im Garten", "zur Arbeit".',
    ne: 'डेटिभ = dem / der / den। mit, an, in, zu र von पछि: "mit dem Bus", "am Bahnhof", "im Garten", "zur Arbeit"।',
    de: 'Dativ = dem / der / den. Nach mit, an, in, zu und von: „mit dem Bus", „am Bahnhof", „im Garten", „zur Arbeit".',
  },
  'a1-checkpoint:prepositions': {
    en: 'in / an / auf / über take the ACCUSATIVE for movement (in den Park) and the DATIVE for a fixed place (im Park).',
    ne: 'in / an / auf / über ले गति मा accusative (in den Park) र स्थिर स्थानमा dative (im Park) लिन्छ।',
    de: 'in / an / auf / über nehmen bei Bewegung den Akkusativ (in den Park) und bei festem Ort den Dativ (im Park).',
  },
  'a1-checkpoint:v2': {
    en: 'The conjugated verb is ALWAYS in Position 2. If a time or place word starts the sentence, the subject moves to Position 3: "Heute lerne ich Deutsch."',
    ne: 'रूप परिवर्तन भएको क्रिया सधैँ दोस्रो स्थानमा। समय वा स्थानले वाक्य सुरु गरेमा कर्ता तेस्रो स्थानमा जान्छ: "Heute lerne ich Deutsch."',
    de: 'Das konjugierte Verb steht IMMER an Position 2. Beginnt ein Zeit- oder Ortwort den Satz, rückt das Subjekt auf Position 3: „Heute lerne ich Deutsch."',
  },
  'a1-checkpoint:wordOrder': {
    en: 'Only one arrangement is German: the verb in Position 2. "Heute ich lerne" is wrong — the verb must come before the subject.',
    ne: 'एउटै मात्र क्रम नेमाली हो: क्रिया दोस्रो स्थानमा। "Heute ich lerne" गलत हो — क्रिया कर्ता भन्दा अगाडि हुनुपर्छ।',
    de: 'Nur eine Reihenfolge ist deutsch: das Verb an Position 2. „Heute ich lerne" ist falsch — das Verb muss vor dem Subjekt stehen.',
  },
  'a1-checkpoint:accusative': {
    en: 'In the accusative ONLY masculine changes: der → den, ein → einen, kein → keinen. die, das and plural stay the same.',
    ne: 'एकवचन (accusative) मा पुल्लिङ मात्र बदलिन्छ: der → den, ein → einen, kein → keinen। die, das र बहुवचन उस्तै रहन्छ।',
    de: 'Im Akkusativ ändert sich NUR das Maskulinum: der → den, ein → einen, kein → keinen. die, das und der Plural bleiben gleich.',
  },
  'a1-checkpoint:kein': {
    en: 'kein / keine stands where a noun with no article stands ("kein Tisch"). nicht negates the verb, the adjective or the whole clause.',
    ne: 'kein / keine ले article नभएको संज्ञाको ठाउँमा आउँछ ("kein Tisch")। nicht ले क्रिया, विशेषण वा पूरा वाक्य नकार गर्छ।',
    de: 'kein / keine steht, wo ein Substantiv ohne Artikel steht („kein Tisch"). nicht verneint das Verb, das Adjektiv oder den ganzen Satz.',
  },
  'a1-checkpoint:possessive': {
    en: 'Possessives add -e on feminine AND plural nouns: mein Vater, meine Mutter, meine Kinder. Formal "your" is capitalised: Ihre Frau.',
    ne: 'सम्बन्धवाचक शब्दले स्त्री र बहुवचनमा -e लिन्छ: mein Vater, meine Mutter, meine Kinder। औपचारिक "तपाईं" को लागि capital: Ihre Frau।',
    de: 'Possessiva bekommen -e bei weiblichen UND Pluralsubstantiven: mein Vater, meine Mutter, meine Kinder. Höfliches „Sie" wird großgeschrieben: Ihre Frau.',
  },
  'a1-checkpoint:demonstrative': {
    en: 'dieser (der), diese (die), dieses (das) — and in the accusative masculine dieser → diesen.',
    ne: 'dieser (der), diese (die), dieses (das) — र एकवचन पुल्लिङमा dieser → diesen।',
    de: 'dieser (der), diese (die), dieses (das) — und im Akkusativ Maskulinum dieser → diesen.',
  },
};

/**
 * True when a SPECIFIC hint exists for this module + reason.
 *
 * Lets a caller offer a finer-grained reason and fall back to a coarser one only
 * when the fine one is genuinely missing — instead of silently replacing a good
 * hint with the universal "check the article or word order" fallback. The A1
 * checkpoint uses this: a grammar drill's CATEGORY (e.g. 'perfekt') is preferred
 * over the generic 'grammar-drill' source, but only if a hint for that category
 * was actually written.
 */
export function hasSpecificHint(moduleType: string, reason?: string): boolean {
  if (!reason) return false;
  return SPECIFIC[`${moduleType}:${reason}`] !== undefined;
}

/**
 * Resolve a hint for a module + reason.
 * Falls back to the module's generic hint, then to a universal fallback.
 */
export function getHint(moduleType: string, reason?: string): HintText {
  if (reason) {
    const specific = SPECIFIC[`${moduleType}:${reason}`];
    if (specific) return specific;
  }
  const generic = GENERIC[moduleType];
  if (generic) return generic;
  return {
    en: 'Check the article or word order.',
    ne: 'लेख वा शब्द क्रम जाँच्नुहोस्।',
    de: 'Prüfe den Artikel oder die Wortstellung.',
  };
}