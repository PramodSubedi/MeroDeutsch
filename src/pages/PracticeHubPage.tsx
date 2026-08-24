import { useEffect, useState } from 'react';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { PracticeToolsGrid } from '../components/PracticeToolsGrid';
import { ArticleSelector } from '../components/exercises/ArticleSelector';
import type { ArticleQuestion } from '../components/exercises/ArticleSelector';
import { useExerciseSession } from '../hooks/useExerciseSession';
import { curriculumService } from '../services';
import { theme } from '../config/theme';

/**
 * Article Sprint — der/die/das drill powered by the ArticleSelector Lesson
 * Engine primitive (v0.2.4 reintegration). TTS-safe: pre-lock 🔊 speaks the
 * bare noun only; gender dot + full phrase audio appear AFTER lock.
 */
function ArticleSprint() {
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const [deck, setDeck] = useState<ArticleQuestion[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    curriculumService
      .getArticles()
      .then((items) => {
        if (cancelled) return;
        setDeck(items.slice(0, 8).map((a) => ({
          key: a.noun,
          correctAnswer: a.art,
          noun: a.noun,
          speakPrompt: a.noun,
          speakAfter: `${a.art} ${a.noun}`,
        })));
      })
      .catch(() => { if (!cancelled) setDeck([]); });
    return () => { cancelled = true; };
  }, []);

  const session = useExerciseSession<ArticleQuestion>({
    questions: deck ?? [],
    module: 'article-sprint',
    getOptions: () => ['der', 'die', 'das'],
  });

  if (deck === null) {
    return <p className="text-sm text-slate-500">{isDE ? 'Lade Nomina…' : 'Loading nouns…'}</p>;
  }
  if (deck.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        {isDE ? 'Keine Artikel-Daten offline verfügbar.' : 'No article data available offline.'}
      </p>
    );
  }
  if (!session.current) {
    return (
      <div className="space-y-3">
        <p className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">
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

/**
 * Practice Hub - Dedicated page for quick-access practice tools.
 * Separates practice utilities from core curriculum modules to reduce cognitive load.
 */
export function PracticeHubPage() {
  usePageTitle('Practice');
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  return (
    <div className={theme.page.container}>
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
          {isDE ? 'Übungswerkzeuge' : 'Practice Hub'}
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">
          {isDE
            ? 'Erweitere deine Fähigkeiten mit interaktiven Übungswerkzeugen — Aussprache, Diktat, Grammatik und mehr.'
            : 'Enhance your skills with interactive practice tools — pronunciation, dictation, grammar, and more.'}
        </p>
      </div>

      <PracticeToolsGrid />

      {/* Article Sprint (reintegrated Lesson Engine primitive) */}
      <section className={`${theme.panel.surface} mx-auto mt-6 max-w-xl`}>
        <h2 className="mb-1 text-lg font-bold text-slate-950 dark:text-white">
          {isDE ? 'Artikel-Sprint' : 'Article Sprint'}
        </h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          {isDE
            ? 'der / die / das? Tippe den Nomen, höre ihn dir an und wähle den Artikel.'
            : 'der / die / das? Tap 🔊 to hear the noun, then pick its article.'}
        </p>
        <ArticleSprint />
      </section>
    </div>
  );
}
