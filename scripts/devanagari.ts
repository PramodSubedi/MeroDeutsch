/**
 * scripts/devanagari.ts
 *
 * Shared Devanagari → Roman transliterator (ISO-15919-style).
 *
 * Extracted from backfillVocabClusters.ts so other pipeline scripts
 * (e.g. generateA1VocabClusters.ts) can reuse it without triggering that
 * script's main() side effects. Deterministic and fully local — romanized
 * Nepali is NEVER requested from an external API.
 */

const INDEPENDENT_VOWELS: Record<string, string> = {
  'अ': 'a', 'आ': 'ā', 'इ': 'i', 'ई': 'ī', 'उ': 'u', 'ऊ': 'ū',
  'ऋ': 'ṛ', 'ए': 'ē', 'ऐ': 'ai', 'ओ': 'ō', 'औ': 'au',
};

const CONSONANTS: Record<string, string> = {
  'क': 'ka', 'ख': 'kha', 'ग': 'ga', 'घ': 'gha', 'ङ': 'ṅa',
  'च': 'ca', 'छ': 'cha', 'ज': 'ja', 'झ': 'jha', 'ञ': 'ña',
  'ट': 'ṭa', 'ठ': 'ṭha', 'ड': 'ḍa', 'ढ': 'ḍha', 'ण': 'ṇa',
  'त': 'ta', 'थ': 'tha', 'द': 'da', 'ध': 'dha', 'न': 'na',
  'प': 'pa', 'फ': 'pha', 'ब': 'ba', 'भ': 'bha', 'म': 'ma',
  'य': 'ya', 'र': 'ra', 'ल': 'la', 'व': 'va',
  'श': 'śa', 'ष': 'ṣa', 'स': 'sa', 'ह': 'ha',
  // Nukta forms (ज़ etc. appear in loanwords like ज़ामसताक)
  'क़': 'qa', 'ख़': 'kha', 'ग़': 'ġa', 'ज़': 'za',
  'ड़': 'ḍa', 'ढ़': 'ḍha', 'फ़': 'fa', 'य़': 'ya',
};

const VOWEL_SIGNS: Record<string, string> = {
  'ा': 'ā', 'ि': 'i', 'ी': 'ī', 'ु': 'u', 'ू': 'ū', 'ृ': 'ṛ',
  'े': 'ē', 'ै': 'ai', 'ो': 'ō', 'ौ': 'au',
};

const VIRAMA = '्';
const ANUSVARA = 'ं'; // nasalization → ṃ
const CHANDRABINDU = 'ँ'; // nasalization (e.g. साँझ, पाँच) → ṃ
const VISARGA = 'ः';

/**
 * Transliterate a Devanagari string to Roman. Non-Devanagari characters
 * (Latin letters, digits, spaces, punctuation) pass through unchanged.
 */
export function devanagariToRoman(input: string): string {
  let out = '';
  let implicitA = false; // last emitted consonant carries an implicit 'a'

  const dropImplicitA = (): void => {
    if (implicitA && out.endsWith('a')) out = out.slice(0, -1);
    implicitA = false;
  };

  for (const ch of input) {
    if (INDEPENDENT_VOWELS[ch] !== undefined) {
      out += INDEPENDENT_VOWELS[ch];
      implicitA = false;
    } else if (CONSONANTS[ch] !== undefined) {
      out += CONSONANTS[ch]; // ends with inherent 'a'
      implicitA = true;
    } else if (VOWEL_SIGNS[ch] !== undefined) {
      if (implicitA && out.endsWith('a')) out = out.slice(0, -1);
      out += VOWEL_SIGNS[ch];
      implicitA = false;
    } else if (ch === VIRAMA) {
      dropImplicitA();
    } else if (ch === ANUSVARA || ch === CHANDRABINDU) {
      out += 'ṃ';
      implicitA = false;
    } else if (ch === VISARGA) {
      out += 'ḥ';
      implicitA = false;
    } else if (ch === '\u200c' || ch === '\u200d') {
      // ZWNJ / ZWJ — ignore
    } else {
      out += ch;
      implicitA = false;
    }
  }
  return out.trim();
}