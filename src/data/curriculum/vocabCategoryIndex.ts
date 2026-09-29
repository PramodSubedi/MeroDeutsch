/**
 * src/data/curriculum/vocabCategoryIndex.ts
 *
 * THE CLOSED VOCABULARY OF `vocabCategories`, derived from the data rather than
 * declared by hand.
 *
 * ── WHY THIS IS A MODULE AND NOT A LINE IN A CHECK SCRIPT ─────────────────────
 * A unit declares `vocabCategories: ["housing", …]`. Those names are resolved at
 * runtime by `curriculumService.getVocabularyByCategories()`, which matches them
 * against each card's `tags` array and — when NOTHING matches — falls back to an
 * unthemed "first 60 A1 cards" fill. The fallback is what makes a bad name
 * SILENT: no crash, no empty deck, no failed build, just a themed checkpoint that
 * quietly serves the same handful of generic words forever.
 *
 * So the legal names have to be known at the moment content is authored, and the
 * honest source for them is the cards themselves. This module is that derivation,
 * extracted so `curriculum:validate` (the pre-commit and CI gate) and
 * `check:vocabcats` (the exhaustive pool/deck audit) answer the question from ONE
 * implementation. A second copy of the list would drift, and a drifted list is the
 * original defect wearing a different hat.
 *
 * ── WHY THIS READS TWO FILES, AND WHY THE OBVIOUS ONE IS THE WRONG ONE ────────
 * `getVocabularyByCategories` selects on a card's `tags` array, not a `category`
 * column — see localCurriculumService pass 1 (`c.tags.some(t => cats.includes(t))`)
 * and `supabaseCurriculumService` (`p_category = ANY(tags)`). Migration
 * 20260928040000 dropped `category` outright. So `tags` is the field a unit's
 * `vocabCategories` is actually resolved against, and `enriched-vocab.json` —
 * which is TRACKED and carries `tags` — is the faithful source.
 *
 * `src/data/vocab/*.json` is the opposite on both counts: it is gitignored
 * ("Seeding-pipeline staging data, kept local, not app code") and it stores a
 * single scalar `category`. A gate that read only that directory would be
 * asserting against files a fresh CI clone does not have — it could not run in CI
 * at all, which is the one place a content gate has to run.
 *
 * It is still read, when present, because `seedVocab` unions both sources into the
 * one `vocabulary` table (scripts/seedVocab.ts). Including it makes a local run a
 * SUPERSET of CI rather than a divergent one, and it is folded into a one-element
 * tags[] here the same way `toDbRow` folds it there.
 *
 * ── WHY A MISSING ENRICHED FILE IS A THROWN ERROR, NOT AN EMPTY SET ───────────
 * If both sources are absent the vocabulary is empty and every name would look
 * invalid. Reporting "31 categories do not exist" would be a confident lie
 * produced by a broken environment — the same failure shape this module exists to
 * prevent. So it refuses to answer rather than answering wrongly.
 */
import * as fs from 'fs';
import * as path from 'path';

interface VocabRow {
  word?: string;
  part_of_speech?: string;
  /** Authored scalar category in the local staging batches. */
  category?: string;
}

interface EnrichedCard {
  lemma?: string;
  partOfSpeech?: string;
  /** The field the runtime actually matches on. */
  tags?: string[];
}

export interface VocabCategoryIndex {
  /** Distinct cards per category, computed from the merged tag sets. */
  counts: ReadonlyMap<string, number>;
  /** Which files were read, for a message an operator can act on. */
  sources: readonly string[];
}

/** Resolved from cwd, matching scripts/genContentPools.ts and the app's loaders. */
const ENRICHED_FILE = path.join(process.cwd(), 'public/data/enriched-vocab.json');
const VOCAB_DIR = path.join(process.cwd(), 'src/data/vocab');

/**
 * The CEFR level tags `toDbRow` adds to EVERY card. Dropped because no unit can
 * usefully declare "A1" as its theme, and keeping them would make the vocabulary
 * look far larger and more permissive than it is.
 *
 * Deliberately NOT `isTopicalTag`. That helper answers a different question — "is
 * this a category a learner can browse in the Glossary", where `unit1`…`unit5`
 * markers are structural. This answers "does a unit's `vocabCategories` entry
 * match a card", and the runtime matches with a literal `tags.includes(cat)` and
 * no filtering at all. So `unit2-nouns` and `unit5-expressions` are exactly what a
 * unit must declare; filtering them here would fail six units over a tag the
 * loader accepts happily.
 */
const LEVEL_RE = /^[ab][12]$/i;


/**
 * Build the category index from whatever vocabulary sources are present.
 *
 * @throws if no source could be read — a broken environment must not masquerade
 *         as an empty vocabulary, which would report every real category as
 *         invalid and train people to ignore the gate.
 */
export function buildVocabCategoryIndex(): VocabCategoryIndex {
  const sources: string[] = [];

  // Cards are keyed like seedVocab's `onConflict: 'word,part_of_speech'` so the
  // same word is not counted twice. The VALUE is the UNION of that card's topical
  // tags across every source, because one card legitimately appears several times:
  // the enriched export holds both a bare `["noun","A1"]` row and a later enriched
  // row for the same lemma, and the staging batches repeat it again. Merging
  // rather than first-wins is what stops a topical tag being dropped by whichever
  // duplicate happened to be read first.
  const cardTags = new Map<string, Set<string>>();

  const addCard = (key: string, tags: readonly string[]): void => {
    let merged = cardTags.get(key);
    if (!merged) cardTags.set(key, (merged = new Set()));
    for (const raw of tags) {
      if (typeof raw !== 'string') continue;
      const tag = raw.trim();
      if (!tag || LEVEL_RE.test(tag)) continue;
      merged.add(tag);
    }
  };

  if (fs.existsSync(ENRICHED_FILE)) {
    const cards = JSON.parse(fs.readFileSync(ENRICHED_FILE, 'utf8')) as EnrichedCard[];
    for (const card of cards) {
      if (!card.lemma) continue;
      addCard(`${card.lemma}|${card.partOfSpeech ?? 'noun'}`, card.tags ?? []);
    }
    sources.push('public/data/enriched-vocab.json');
  }

  if (fs.existsSync(VOCAB_DIR)) {
    for (const file of fs.readdirSync(VOCAB_DIR).filter((f) => f.endsWith('.json'))) {
      const rows = JSON.parse(fs.readFileSync(path.join(VOCAB_DIR, file), 'utf8')) as VocabRow[];
      for (const row of rows) {
        if (!row.word) continue;
        // Scalar `category` becomes a one-element tags[], mirroring toDbRow().
        addCard(`${row.word}|${row.part_of_speech ?? 'noun'}`, row.category ? [row.category] : []);
      }
    }
    sources.push('src/data/vocab/*.json');
  }

  if (sources.length === 0) {
    // NOT a skip. See the header: an empty vocabulary would make this gate report
    // every category as invalid, and a gate that cries wolf is a gate that gets
    // deleted.
    throw new Error(
      'no vocabulary source found — cannot verify unit vocabCategories.\n' +
        `  Looked for: ${ENRICHED_FILE}\n` +
        `              ${VOCAB_DIR}\n` +
        '  `public/data/enriched-vocab.json` is tracked and must be present; if it is\n' +
        '  missing, restore it with `git checkout -- public/data/enriched-vocab.json`.',
    );
  }

  const counts = new Map<string, number>();
  for (const tags of cardTags.values()) {
    for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  return { counts, sources };
}

/**
 * The categories a unit may declare: every name matching at least one card,
 * sorted so an error message is stable and diffable.
 */
export function realVocabCategories(index: VocabCategoryIndex): string[] {
  return [...index.counts.keys()].sort((a, b) => a.localeCompare(b));
}
