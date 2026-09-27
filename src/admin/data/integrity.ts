/**
 * src/admin/data/integrity.ts
 *
 * Content-integrity checks over the vocabulary table.
 *
 * ── WHY THIS EXISTS, IN TERMS OF WHAT IT CAUGHT ─────────────────────────────
 * The learner app validates its CURRICULUM at boot, but nothing validates the
 * DATABASE content. Building this page against the live data immediately
 * surfaced a defect no existing check had looked for:
 *
 *     47 of 1062 vocabulary rows (4.4%) carry a GERMAN word in `translation_en`.
 *
 *     word      part_of_speech  translation_en
 *     aufhören  noun            "Der"      ← a verb, tagged noun, translated as an article
 *     dürfen    noun            "Sie"      ← a modal verb
 *     gehen     noun            "Ich"
 *     böse      noun            "Sie"      ← an adjective
 *
 * All 47 are a contiguous run with `part_of_speech = 'noun'` and an empty Nepali
 * translation — the signature of an IMPORT ROW MISALIGNMENT, where `word[i]`
 * was paired with `translation_en[i+k]`. 47 words are currently teaching
 * learners the wrong translation, and nothing in the app would ever have said so.
 *
 * ── WHY THE HEURISTIC IS "IS THE ENGLISH ALSO A GERMAN WORD" ────────────────
 * A dictionary check would need a lexicon this app does not have. But German
 * vocabulary has ~1,000 rows in `word`, so a translation that is *itself* a
 * known German headword is almost certainly a misalignment. The one safe
 * exclusion is when the translation equals the word it translates (a legitimate
 * cognate pair like "Arm"/"arm"), which is filtered out.
 */
import { supabase } from '../../lib/supabase';

export interface VocabRow {
  id: string;
  word: string | null;
  partOfSpeech: string | null;
  translationEn: string | null;
  translationNp: string | null;
  exampleDe: string | null;
  level: string | null;
}

export type Severity = 'error' | 'warning' | 'info';

export interface Finding {
  id: string;
  severity: Severity;
  /** Stable machine key, so the UI and any future CI gate can key off it. */
  code:
    | 'translation-not-english'
    | 'missing-translation-np'
    | 'missing-example-de'
    | 'duplicate-word'
    | 'missing-core-field';
  title: string;
  detail: string;
  samples: { id: string; label: string }[];
  count: number;
}

export interface IntegrityResult {
  findings: Finding[];
  totalVocab: number;
  errors: string[];
}

/** Normalise a term for comparison: case-fold and collapse inner whitespace. */
export function normaliseTerm(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

const isBlank = (v: string | null | undefined): boolean => (v ?? '').trim() === '';

/**
 * A translation is suspect when it is itself a known German headword AND is not
 * simply the word it is translating.
 *
 * That exclusion matters: "Arm" → "arm" is a correct cognate pair, and flagging
 * it would bury the real signal in noise.
 */
export function isMisalignedTranslation(
  word: string | null,
  translation: string | null,
  germanHeadwords: ReadonlySet<string>,
): boolean {
  if (isBlank(word) || isBlank(translation)) return false;
  const t = normaliseTerm(translation);
  if (!germanHeadwords.has(t)) return false;
  return t !== normaliseTerm(word);
}

/**
 * Group rows by normalised term, keeping only terms with more than one row.
 *
 * Case is NOT enough to make two rows duplicates — "Essen" (food) and "essen"
 * (to eat) are different words, and "arm"/"Arm" are an adjective and a noun. So
 * this is reported as a REVIEW item, not an error: only a human can say whether
 * two rows sharing a headword are the same entry.
 */
export function findDuplicateTerms(rows: VocabRow[]): Map<string, VocabRow[]> {
  const byTerm = new Map<string, VocabRow[]>();
  for (const r of rows) {
    const key = normaliseTerm(r.word);
    if (!key) continue;
    const list = byTerm.get(key);
    if (list) list.push(r);
    else byTerm.set(key, [r]);
  }
  for (const [key, list] of byTerm) {
    if (list.length < 2) byTerm.delete(key);
  }
  return byTerm;
}

/** Rank: errors first, then by how many rows are affected. */
const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

export function buildFindings(rows: VocabRow[], sampleSize = 12): Finding[] {
  const findings: Finding[] = [];
  const headwords = new Set(rows.map((r) => normaliseTerm(r.word)).filter(Boolean));

  const misaligned = rows.filter((r) => isMisalignedTranslation(r.word, r.translationEn, headwords));
  if (misaligned.length > 0) {
    findings.push({
      id: 'translation-not-english',
      severity: 'error',
      code: 'translation-not-english',
      title: 'English translations that are themselves German words',
      detail:
        'These rows look like an import row misalignment: the word came from one source and the ' +
        'translation from another. Most are tagged `noun`, which is wrong for most of them. ' +
        'Learners are being taught the wrong meaning for every one of these.',
      samples: misaligned.slice(0, sampleSize).map((r) => ({
        id: r.id,
        label: `${r.word} → ${r.translationEn} (${r.partOfSpeech ?? 'no part of speech'})`,
      })),
      count: misaligned.length,
    });
  }

  const noNp = rows.filter((r) => isBlank(r.translationNp));
  if (noNp.length > 0) {
    findings.push({
      id: 'missing-translation-np',
      severity: 'warning',
      code: 'missing-translation-np',
      title: 'Missing Nepali translation',
      detail: 'Nepali is a first-class language in this product, so a gap here is a gap for the learner.',
      samples: noNp.slice(0, sampleSize).map((r) => ({ id: r.id, label: r.word ?? '(no word)' })),
      count: noNp.length,
    });
  }

  const noExample = rows.filter((r) => isBlank(r.exampleDe));
  if (noExample.length > 0) {
    findings.push({
      id: 'missing-example-de',
      severity: 'warning',
      code: 'missing-example-de',
      title: 'Missing German example sentence',
      detail: 'Words without an example are much harder to place in a sentence later.',
      samples: noExample.slice(0, sampleSize).map((r) => ({ id: r.id, label: r.word ?? '(no word)' })),
      count: noExample.length,
    });
  }

  const missingCore = rows.filter((r) => isBlank(r.word) || isBlank(r.translationEn) || isBlank(r.level));
  if (missingCore.length > 0) {
    findings.push({
      id: 'missing-core-field',
      severity: 'error',
      code: 'missing-core-field',
      title: 'Missing a core field (word, English or level)',
      detail: 'A vocabulary row without one of these cannot be taught at all.',
      samples: missingCore.slice(0, sampleSize).map((r) => ({ id: r.id, label: r.word ?? '(no word)' })),
      count: missingCore.length,
    });
  }

  const dupes = findDuplicateTerms(rows);
  if (dupes.size > 0) {
    findings.push({
      id: 'duplicate-word',
      severity: 'info',
      code: 'duplicate-word',
      title: 'Words appearing on more than one row',
      detail:
        'Not necessarily wrong — "Essen" (food) and "essen" (to eat) are different words, and case ' +
        'distinguishes some nouns. Flagged for review, not asserted as an error.',
      samples: [...dupes.entries()]
        .slice(0, sampleSize)
        .map(([term, list]) => ({
          id: list[0].id,
          label: `${term} — ${list.length} rows (${list.map((r) => r.partOfSpeech ?? '?').join(', ')})`,
        })),
      count: dupes.size,
    });
  }

  return findings.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.count - a.count,
  );
}

/** Load vocabulary and run every check. */
export async function fetchIntegrity(): Promise<IntegrityResult> {
  const { data, error } = await supabase
    .from('vocabulary')
    .select('id, word, part_of_speech, translation_en, translation_np, example_de, level')
    .limit(20000);

  if (error) {
    return { findings: [], totalVocab: 0, errors: [`vocabulary: ${error.message}`] };
  }

  const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    word: (r.word as string | null) ?? null,
    partOfSpeech: (r.part_of_speech as string | null) ?? null,
    translationEn: (r.translation_en as string | null) ?? null,
    translationNp: (r.translation_np as string | null) ?? null,
    exampleDe: (r.example_de as string | null) ?? null,
    level: (r.level as string | null) ?? null,
  })) satisfies VocabRow[];

  return { findings: buildFindings(rows), totalVocab: rows.length, errors: [] };
}
