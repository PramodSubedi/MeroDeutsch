/**
 * src/lib/vocabLookup.ts — look a word up in the app's OWN vocabulary store.
 *
 * WHY THIS EXISTS
 * ---------------
 * "What does X mean?" is an acceptance criterion, and an LLM's definition is
 * exactly the kind of thing a small model hallucination makes untrustworthy.
 * So the companion answers from `db.vocab` (the same `VocabCard` rows the
 * Glossary and Vocab Trainer already show, seeded at boot) and only asks the
 * model to explain the card it was handed.
 *
 * Returns null on a miss — the caller then says so honestly instead of
 * inventing a translation.
 */

import { db } from './db';
import type { VocabCard } from '../types';

export interface VocabHit {
  lemma: string;
  article: string | null;
  plural: string | null;
  partOfSpeech: string;
  cefrLevel: string;
  en: string;
  np: string;
  examples: string[];
  audioUrl: string | null;
}

function toHit(card: VocabCard): VocabHit {
  return {
    lemma: card.lemma,
    article: card.article,
    plural: card.plural,
    partOfSpeech: card.partOfSpeech,
    cefrLevel: card.cefrLevel,
    en: card.translation?.en ?? '',
    np: card.translation?.np ?? '',
    examples: (card.examples ?? []).map((e) => e.de).filter(Boolean).slice(0, 3),
    audioUrl: card.audioUrl ?? null,
  };
}

/** Strip a leading article so "der Hund" and "hund" both resolve. */
export function normalizeTerm(raw: string): string {
  return raw
    .trim()
    .replace(/^(der|die|das|ein|eine|dem|den|des)\s+/i, '')
    .replace(/[.?!,;:]+$/, '')
    .toLowerCase();
}

export async function lookupVocab(rawTerm: string): Promise<VocabHit | null> {
  if (!db) return null;
  const term = normalizeTerm(rawTerm);
  if (term.length < 2) return null;

  try {
    // Indexed path first — this is the cheap, common case.
    const exact = await db.vocab.where('lemma').equalsIgnoreCase(term).first();
    if (exact) return toHit(exact);

    // Prefix, then substring. Lazy iteration, so a miss costs a table scan
    // but only ever on an explicit user lookup — never on app boot.
    const prefix = await db.vocab
      .filter((c) => c.lemma?.toLowerCase().startsWith(term))
      .first();
    if (prefix) return toHit(prefix);

    const loose = await db.vocab
      .filter((c) => c.lemma?.toLowerCase().includes(term))
      .first();
    return loose ? toHit(loose) : null;
  } catch {
    // A failed lookup must never break the chat — treat it as a miss.
    return null;
  }
}
