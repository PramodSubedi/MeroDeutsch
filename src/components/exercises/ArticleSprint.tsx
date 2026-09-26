import { useEffect, useState } from 'react';
import { useLang } from '../../hooks/useLang';
import { ArticleSelector } from './ArticleSelector';
import type { ArticleQuestion } from './ArticleSelector';
import { useExerciseSession } from '../../hooks/useExerciseSession';
import { useWeakKeysFor } from '../../hooks/useSkillAccuracy';
import { pickNUnique } from '../../utils/questionGenerator';
import { curriculumService } from '../../services';
import { theme } from '../../config/theme';

/**
 * Article Sprint — der/die/das recall drill.
 *
 * Extracted from PracticeHubPage (v0.2.4 reintegration) into its own module so
 * it can be reached via the dedicated /article-sprint route + grid card, instead
 * of being inlined directly on the Practice hub (the inconsistency that made the
 * article section load "directly unlike other tools").
 *
 * TTS-safe: pre-lock speaks ONLY the bare noun (`speakPrompt`); the full
 * "der/die/das + noun" phrase audio appears AFTER the answer is locked.
 */
export function ArticleSprint() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const [deck, setDeck] = useState<ArticleQuestion[] | null>(null);
  // Adaptive: nouns this learner got wrong before are drawn first. Backed by
  // the SRS rows the engine already writes for moduleType 'article-sprint'.
  // Falls back to a plain draw when there is no history.
  const weakKeys = useWeakKeysFor('article-sprint');

  useEffect(() => {
    let cancelled = false;
    curriculumService
      .getArticles()
      .then((items) => {
        if (cancelled) return;
        const questions = items.map((a) => ({
          key: a.noun,
          correctAnswer: a.art,
          noun: a.noun,
          speakPrompt: a.noun,
          speakAfter: `${a.art} ${a.noun}`,
        }));
        // Fixed 8-question round, but ordered so the previously-missed nouns
        // lead. `slice(0, 8)` still bounds the round regardless of pool size.
        setDeck(
          pickNUnique({ items: questions, count: Math.min(8, questions.length), getKey: (q) => q.key, preferKeys: weakKeys })
        );
      })
      .catch(() => { if (!cancelled) setDeck([]); });
    return () => { cancelled = true; };
    // Re-run when the weak list changes so a retry re-tests the current misses.
  }, [weakKeys]);

  const session = useExerciseSession<ArticleQuestion>({
    questions: deck ?? [],
    module: 'article-sprint',
    getOptions: () => ['der', 'die', 'das'],
  });

  if (deck === null) {
    return <p className="text-body text-ink-500">{isDE ? 'Lade Nomina…' : 'Loading nouns…'}</p>;
  }
  if (deck.length === 0) {
    return (
      <p className="text-body text-ink-500">
        {isDE ? 'Keine Artikel-Daten offline verfügbar.' : 'No article data available offline.'}
      </p>
    );
  }
  if (!session.current) {
    return (
      <div className="space-y-3">
        <p className="rounded-md bg-success-50 p-3 text-body font-semibold text-success-700 dark:bg-success-900/30 dark:text-success-300">
          🎉 {isDE
            ? `Fertig! ${session.score}/${session.total} richtig (${session.accuracy}%).`
            : `Done! ${session.score}/${session.total} correct (${session.accuracy}%).`}
        </p>
        <button type="button" onClick={session.reset} className={theme.button.secondary}>
          {isDE ? 'Nochmal' : 'Play again'}
        </button>
      </div>
    );
  }
  return <ArticleSelector session={session} />;
}