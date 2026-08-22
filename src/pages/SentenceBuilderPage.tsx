/**
 * src/pages/SentenceBuilderPage.tsx
 *
 * Unit 2 optional practice — sentence building with article/gender focus.
 * Reached from the bonus chip on the /learn spine (bonus nodes NEVER gate
 * the checkpoint).
 *
 * Data is DYNAMIC: fetched via curriculumService.getSentences() from the
 * randomized Supabase RPC (get_random_sentences) with write-through caching
 * to Dexie for offline reuse. No hardcoded sentence list.
 *
 * Nur DE: pedagogical hint chips are hidden when langMode === 'german' — the
 * builder (tiles + slots) stays fully playable.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Grid, Keyboard, Mic, ShieldAlert } from 'lucide-react';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { SEO } from '../components/common/SEO';
import { theme } from '../config/theme';
import { curriculumService } from '../services';
import type { SentenceExercise } from '../types/curriculum';
import type { SentenceItem } from '../components/exercises/SentenceBuilder';
import { SentenceBuilder } from '../components/exercises/SentenceBuilder';
import { GenderLegend } from '../components/ui/GenderBadge';

/** Map a dynamic SentenceExercise onto the SentenceBuilder item shape. */
function toSentenceItem(ex: SentenceExercise): SentenceItem {
  return {
    id: ex.id,
    words: ex.expected,
    distractors: ex.distractors,
  };
}

export function SentenceBuilderPage() {
  usePageTitle('Sentence Builder');
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  const [items, setItems] = useState<SentenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Controls state
  const [mode, setMode] = useState<'tiles' | 'typing' | 'voice'>('tiles');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // Pull a randomized subset from the dynamic pipeline (Unit 2 focus).
        const exercises = await curriculumService.getSentences('akkusativ', 4);
        // Top up from the full pool if the focused fetch is short.
        let pool = exercises;
        if (exercises.length < 4) {
          const more = await curriculumService.getSentences(undefined, 8 - exercises.length);
          pool = [...exercises, ...more];
        }
        if (!cancelled) {
          setItems(pool.map(toSentenceItem));
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load sentences');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={theme.page.container}>
      <SEO
        title="Sentence Builder | MeroDeutsch"
        description="Build German sentences tile by tile — practice articles, gender, and the Nominativ to Akkusativ rule."
      />
      <header className="mb-4">
        <Link
          to="/learn"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
        >
          ← {isDE ? 'Zurück zum Lernpfad' : 'Back to learning path'}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">
          {isDE ? 'Satzbau — Einheit 2' : 'Sentence Builder — Unit 2'}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isDE
            ? 'Baue Sätze mit Artikeln und Genus. Achtung: der → den im Akkusativ!'
            : 'Build sentences with articles and gender. Watch out: der to den in the accusative!'}
        </p>
      </header>

      {/* Mode & Difficulty Segmented Controls */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-100 p-3 dark:bg-slate-800/80">
        {/* Interaction Mode */}
        <div className="flex items-center gap-1">
          <span className="mr-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {isDE ? 'Modus:' : 'Mode:'}
          </span>
          <button
            type="button"
            onClick={() => setMode('tiles')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              mode === 'tiles'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            <Grid className="h-3.5 w-3.5" />
            {isDE ? 'Kacheln' : 'Tiles'}
          </button>
          <button
            type="button"
            onClick={() => setMode('typing')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              mode === 'typing'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            <Keyboard className="h-3.5 w-3.5" />
            {isDE ? 'Tippen' : 'Typing'}
          </button>
          <button
            type="button"
            onClick={() => setMode('voice')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              mode === 'voice'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            <Mic className="h-3.5 w-3.5" />
            {isDE ? 'Sprache' : 'Voice'}
          </button>
        </div>

        {/* Difficulty Selector */}
        <div className="flex items-center gap-1">
          <span className="mr-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {isDE ? 'Schwierigkeit:' : 'Difficulty:'}
          </span>
          {(['easy', 'medium', 'hard'] as const).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setDifficulty(level)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition ${
                difficulty === level
                  ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                  : 'bg-white text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Akkusativ Note & Gender Legend */}
      {!isDE && (
        <div className="mb-6 space-y-3">
          <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <div>
              <strong>Akkusativ Rule:</strong> In accusative sentences (direct object), masculine{' '}
              <span className="font-bold text-blue-600 dark:text-blue-400">der / ein</span> changes to{' '}
              <span className="font-bold text-blue-600 dark:text-blue-400">den / einen</span>. Feminine,
              neuter, and plural remain unchanged!
            </div>
          </div>
          <GenderLegend />
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-slate-500 dark:text-slate-400">
          {isDE ? 'Sätze werden geladen…' : 'Loading sentences…'}
        </div>
      ) : error ? (
        <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {isDE
            ? `Fehler beim Laden: ${error}. Zeige gecachte Sätze.`
            : `Load error: ${error}. Showing cached fallback.`}
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-slate-500 dark:text-slate-400">
          {isDE
            ? 'Noch keine Sätze gepuffert. Verbinde dich mit dem Internet, um üben zu können.'
            : 'No sentence exercises cached yet. Go online once to unlock offline practice.'}
        </div>
      ) : (
        <div className="mx-auto max-w-3xl">
          <SentenceBuilder items={items} module="grammar" mode={mode} difficulty={difficulty} />
        </div>
      )}
    </div>
  );
}
