/**
 * src/lib/chatPractice.ts — build a real drill deck for the chat.
 *
 * REAL DATA ONLY
 * --------------
 * Every question is drawn from something the app already teaches: the
 * learner's own weak items, the `db.vocab` cards behind the Glossary, or the
 * curriculum's practice bank. Nothing is invented, which is the only way a
 * "Quiz me" round can also be allowed to write back to the SRS queue.
 *
 * THE TWO HARD RULES THIS FILE EXISTS TO HONOUR
 * ---------------------------------------------
 *  · `.clinerules` C2.9 — options are shuffled ONCE, here, at build time, and
 *    are never re-sorted afterwards, so a locked question cannot reshuffle
 *    under the learner's finger.
 *  · `.clinerules` C2.6/C6 — `speakPrompt` is the PROMPT only. In
 *    hear-then-type mode the model speaks the question; the answer is never
 *    reachable from anything speakable.
 */

import { db } from './db';
import { shuffleArray } from '../utils/shuffleArray';
import { getHint } from '../data/hints';
import type { ContextSnapshot, QuizQuestion, WeakItemSnapshot } from '../types/chatbot';
import type { VocabCard } from '../types';

export type PracticeMode = 'choice' | 'type' | 'listen';

export interface DeckOptions {
  count: number;
  mode: PracticeMode;
  ctx: ContextSnapshot;
}

/** One question built from a vocabulary card. */
function fromCard(card: VocabCard, mode: PracticeMode, cards: VocabCard[]): QuizQuestion | null {
  // Nouns are the most valuable drill: the article is the classic A1 trap and
  // every card carries a real gender, plural and example.
  const showArticle = card.partOfSpeech === 'noun' && Boolean(card.article);
  const answer = showArticle ? `${card.article} ${card.lemma}` : card.lemma;
  if (!answer) return null;

  const distractors: string[] = [];
  if (showArticle) {
    const others = ['der', 'die', 'das'].filter((a) => a !== card.article);
    for (const a of others) distractors.push(`${a} ${card.lemma}`);
  } else {
    const pool = cards
      .filter((c) => c.id !== card.id && c.lemma !== card.lemma)
      .slice(0, 24);
    for (const c of pool) {
      distractors.push(c.article && c.partOfSpeech === 'noun' ? `${c.article} ${c.lemma}` : c.lemma);
      if (distractors.length >= 3) break;
    }
  }
  if (mode !== 'choice' || distractors.length < 2) {
    return {
      itemKey: card.id,
      moduleType: 'chat-vocab',
      prompt: showArticle ? `Welcher Artikel passt zu „${card.lemma}“?` : `Write the German for “${card.translation?.en ?? card.lemma}”`,
      speakPrompt: card.lemma,
      options: [],
      correct: answer,
      mode: mode === 'choice' ? 'type' : mode,
      source: 'vocabulary',
    };
  }

  // C2.9: shuffled here, once. The deck keeps this order for the whole round.
  const options = shuffleArray([answer, ...distractors.slice(0, 3)]);
  return {
    itemKey: card.id,
    moduleType: 'chat-vocab',
    prompt: showArticle
      ? `Welcher Artikel passt zu „${card.lemma}“?`
      : `What is the German for “${card.translation?.en ?? card.lemma}”?`,
    speakPrompt: card.lemma,
    options,
    correct: answer,
    mode: 'choice',
    source: 'vocabulary',
  };
}

/** One question built from something the learner keeps getting wrong. */
function fromWeakItem(item: WeakItemSnapshot, mode: PracticeMode): QuizQuestion {
  const answer = item.correctAnswer || item.itemKey;
  // Their OWN wrong answer is the best distractor there is.
  const options =
    mode === 'choice' && item.userAnswer && item.userAnswer.trim() !== answer.trim()
      ? shuffleArray([answer, item.userAnswer.trim()])
      : [];
  const hint = getHint(item.moduleType, 'wrong-answer');
  return {
    itemKey: item.itemKey,
    moduleType: item.moduleType,
    prompt: 'Which one is correct?',
    speakPrompt: answer,
    options,
    correct: answer,
    mode: options.length >= 2 ? 'choice' : 'type',
    hint: { en: hint.en, de: hint.de },
    source: 'weak_item',
  };
}

/**
 * Build a deck: weak items FIRST (they are the highest-value repetitions),
 * topped up from the vocabulary store so a learner with an empty queue still
 * gets a real round.
 */
export async function buildPracticeDeck(options: DeckOptions): Promise<QuizQuestion[]> {
  const { count, mode, ctx } = options;
  const deck: QuizQuestion[] = [];

  for (const item of ctx.weakItems) {
    if (deck.length >= count) break;
    if (!item.correctAnswer && !item.itemKey) continue;
    deck.push(fromWeakItem(item, mode));
  }

  if (deck.length < count && db) {
    try {
      // Same store the Glossary and Vocab Trainer read, so "Quiz me" and the
      // rest of the app can never disagree about a word.
      const cards = await db.vocab.limit(400).toArray();
      const shuffled = shuffleArray(cards);
      for (const card of shuffled) {
        if (deck.length >= count) break;
        const q = fromCard(card, mode, cards);
        if (q) deck.push(q);
      }
    } catch {
      // A failed read yields a short (or empty) deck, never a crash.
    }
  }

  return deck.slice(0, count);
}

/**
 * Score a typed answer.
 *
 * THE ARTICLE IS THE ANSWER WHEN THE LEARNER SUPPLIES ONE
 * -------------------------------------------------------
 * A first pass normalised by stripping the leading article on BOTH sides, to be
 * kind to someone who types "Hund" for "der Hund". That was wrong twice over:
 *
 *   1. In a tap-to-choose question, picking *der* over *das* IS the exercise,
 *      and stripping the article marked every single one of them correct.
 *   2. Even in a typed question it accepted a genuinely wrong article —
 *      "die Hund" scored as correct for "der Hund".
 *
 * Both silently poisoned the review queue with false positives, so a learner's
 * real article errors would never resurface. The rule is now:
 *
 *   · exact (case/space-insensitive) match      -> correct
 *   · a wrong article was supplied               -> WRONG
 *   · the article was OMITTED while typing       -> forgiven
 */
export function isAnswerCorrect(
  given: string,
  correct: string,
  mode: 'choice' | 'type' | 'listen' = 'type',
): boolean {
  const flat = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const g = flat(given);
  const c = flat(correct);
  if (g === c) return true;
  // Between explicit options the article is load-bearing — nothing to forgive.
  if (mode === 'choice') return false;

  const suppliesArticle = (s: string) => /^(der|die|das)\s/.test(s);
  // The learner typed an article and it is not the right one: a real error.
  if (suppliesArticle(g)) return false;
  // The correct answer has no article either, so there is nothing to forgive.
  if (!suppliesArticle(c)) return false;
  return g === c.replace(/^(der|die|das)\s+/, '');
}
