/**
 * src/components/chat/payloads/VocabCard.tsx
 *
 * A vocabulary card built from a REAL `VocabCard` row, not from model output.
 *
 * The gender badge is the app's own `GenderBadge` (locked theme tokens — no
 * one-off hexes, .clinerules C1.8) and the audio is the shared
 * `CompactAudioButton`, so a word sounds exactly as it does everywhere else in
 * the app. The English/Nepali line is hidden in Nur-DE mode (C1.5).
 */

import { GenderBadge } from '../../ui/GenderBadge';
import { CompactAudioButton } from '../../CompactAudioButton';
import type { VocabHit } from '../../../lib/vocabLookup';

/** `VocabCard.article` is a loose string; the badge wants the narrow union. */
function narrowArticle(article: string | null): 'der' | 'die' | 'das' | null {
  return article === 'der' || article === 'die' || article === 'das' ? article : null;
}

export interface VocabCardProps {
  hit: VocabHit;
  isDE: boolean;
}

export function VocabCard({ hit, isDE }: VocabCardProps) {
  const article = narrowArticle(hit.article);
  return (
    <div className="rounded-md border border-ink-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-900">
      <div className="flex items-center gap-2">
        {article && <GenderBadge article={article} labeled={false} />}
        <span className="text-body font-bold text-ink-950 dark:text-white">
          {article ? `${article} ${hit.lemma}` : hit.lemma}
        </span>
        <span className="ml-auto">
          <CompactAudioButton word={hit.lemma} />
        </span>
      </div>

      <p className="mt-1.5 text-body text-ink-700 dark:text-ink-300">{hit.en}</p>
      {!isDE && hit.np && (
        <p className="text-meta text-ink-500 dark:text-ink-400">{hit.np}</p>
      )}

      {hit.plural && (
        <p className="mt-1 text-meta text-ink-500 dark:text-ink-400">
          {isDE ? 'Plural' : 'Plural'}: <span className="font-semibold">{hit.plural}</span>
        </p>
      )}

      {hit.examples.length > 0 && (
        <ul className="mt-2 space-y-1">
          {hit.examples.map((ex) => (
            <li key={ex} className="text-meta italic text-ink-600 dark:text-ink-400">
              „{ex}“
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-micro uppercase tracking-wider text-ink-400 dark:text-ink-500">
        {hit.partOfSpeech} · {hit.cefrLevel}
      </p>
    </div>
  );
}
