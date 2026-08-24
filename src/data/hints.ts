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
};

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