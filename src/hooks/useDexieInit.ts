/**
 * useDexieInit — Phase 2.1 runtime bootstrap for the Dexie data layer.
 *
 * Runs once on the client (SSR-safe via openDb()). Responsibilities:
 *   1. Seed `db.vocab` from static vocabulary if the table is empty.
 *      Preference order:
 *        a) `public/data/enriched-vocab.json` (full VocabCard schema, produced by
 *           `npm run enrich`) — preferred when present.
 *        b) `vocabularyData` (legacy VocabEntry[]) adapted to VocabCard — always
 *           available as a fallback so the app is never empty.
 *
 * Seeding is idempotent (guarded by `db.vocab.count() === 0`), so repeated
 * mounts or hot-reloads never duplicate rows.
 */
import { useEffect, useState } from 'react';
import { openDb, seedVocab } from '../lib/db';
import { vocabularyData } from '../data/loadVocabulary';
import type { VocabEntry } from '../data/loadVocabulary';
import type { VocabCard } from '../types';

/** Map a legacy VocabEntry onto the enriched VocabCard schema (lossy: no
 * phonetics/article/plural exist in the legacy data). Used only until
 * `npm run enrich` produces public/data/enriched-vocab.json. */
function adaptLegacyVocab(v: VocabEntry): VocabCard {
  const pos = v.tags.includes('verb')
    ? 'verb'
    : v.tags.includes('adjective')
    ? 'adjective'
    : 'noun';
  return {
    id: v.id,
    lemma: v.de,
    article: null,
    plural: null,
    partOfSpeech: pos,
    cefrLevel: v.level === 'A1' ? 'A1' : 'A1',
    translation: { en: v.en, np: v.ne },
    phonetics: { ipa: '', devanagari: '' },
    tags: v.tags,
    examples: v.exampleDe ? [{ de: v.exampleDe, en: v.en, np: v.ne }] : [],
  };
}

/** Lightweight shape check for fetched enriched vocab before seeding. */
function isVocabCardLike(obj: unknown): obj is VocabCard {
  if (!obj || typeof obj !== 'object') return false;
  const c = obj as Record<string, unknown>;
  return typeof c.id === 'string' && typeof c.lemma === 'string';
}

/** Bootstrap the Dexie vocab table. Returns `true` once seeding has settled. */
export function useDexieInit(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const store = openDb();
    if (!store) {
      // SSR — nothing to seed.
      setReady(true);
      return;
    }

    let cancelled = false;
    const seed = async () => {
      const count = await store.vocab.count();
      if (count === 0) {
        // (a) Prefer fully-enriched cards when the pipeline has been run.
        let cards: VocabCard[] = vocabularyData.map(adaptLegacyVocab);
        try {
          const resp = await fetch('/data/enriched-vocab.json', { cache: 'no-store' });
          if (resp.ok) {
            const json = (await resp.json()) as unknown;
            if (Array.isArray(json)) {
              const valid = json.filter(isVocabCardLike) as VocabCard[];
              if (valid.length > 0) cards = valid;
            }
          }
        } catch {
          // Enriched file absent/not run yet — keep the legacy-derived fallback.
        }
        await seedVocab(cards);
      }
      if (!cancelled) setReady(true);
    };

    void seed();
    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}
