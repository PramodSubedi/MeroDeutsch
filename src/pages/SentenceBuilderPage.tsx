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
import { Link, useSearchParams } from 'react-router-dom';
import { Grid, Keyboard, Mic, ShieldAlert } from 'lucide-react';
import { useLang } from '../hooks/useLang';
import { useAuth } from '../hooks/useAuth';
import { usePageTitle } from '../hooks/usePageTitle';
import { SEO } from '../components/common/SEO';
import { theme } from '../config/theme';
import { curriculumService } from '../services';
import { detectSeparableVerb } from '../data/a1Verbs';
import type { SentenceExercise } from '../types/curriculum';
import type { SentenceItem } from '../components/exercises/SentenceBuilder';
import { SentenceBuilder } from '../components/exercises/SentenceBuilder';
import { GenderLegend } from '../components/ui/GenderBadge';

/** Map a dynamic SentenceExercise onto the SentenceBuilder item shape. */
function toSentenceItem(ex: SentenceExercise, hint?: string): SentenceItem {
  return {
    id: ex.id,
    words: ex.expected,
    distractors: ex.distractors,
    hint,
  };
}

export function SentenceBuilderPage() {
  usePageTitle('Sentence Builder');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const { isAuthenticated } = useAuth();

  const [items, setItems] = useState<SentenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** True when the separable focus found NO drills in the cached pool. */
  const [separableEmpty, setSeparableEmpty] = useState(false);

  // Controls state
  const [mode, setMode] = useState<'tiles' | 'typing' | 'voice'>('tiles');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  // Focus: 'akkusativ' (Unit 2 pipeline, default) | 'separable' (trennbare
  // Verben — Band D routine batch + NotebookLM conversation pool sentences).
  // Deep-linked from the /learn spine chip (/sentence-builder?focus=separable).
  const [searchParams, setSearchParams] = useSearchParams();
  const [focus, setFocusState] = useState<'akkusativ' | 'separable'>(() =>
    searchParams.get('focus') === 'separable' ? 'separable' : 'akkusativ'
  );
  const setFocus = (next: 'akkusativ' | 'separable') => {
    setFocusState(next);
    setSearchParams(next === 'separable' ? { focus: next } : {}, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSeparableEmpty(false);
    void (async () => {
      try {
        if (focus === 'separable') {
          // SAME dynamic pipeline, wider pool, then a deterministic filter:
          // last word = the verb's prefix AND another word starts with the
          // verb's bare stem (detectSeparableVerb — see a1Verbs.ts). No new
          // content engine, no hardcoded sentence list.
          const pool = await curriculumService.getSentences(undefined, 32);
          const separable = pool.filter((ex) => detectSeparableVerb(ex.expected) !== null);
          if (!cancelled) {
            const sepHint = isDE
              ? 'Trennbares Verb: Stamm an Position 2, Präfix am ENDE — "Ich stehe um sechs Uhr auf."'
              : 'Separable verb: stem in Position 2, prefix at the END — "Ich stehe um sechs Uhr auf."';
            setItems(separable.slice(0, 6).map((ex) => toSentenceItem(ex, sepHint)));
            setSeparableEmpty(separable.length === 0);
            setLoading(false);
          }
          return;
        }
        // Pull a randomized subset from the dynamic pipeline (Unit 2 focus).
        const exercises = await curriculumService.getSentences('akkusativ', 4);
        // Top up from the full pool if the focused fetch is short.
        let pool = exercises;
        if (exercises.length < 4) {
          const more = await curriculumService.getSentences(undefined, 8 - exercises.length);
          pool = [...exercises, ...more];
        }
        if (!cancelled) {
          setItems(pool.map((ex) => toSentenceItem(ex)));
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
  }, [focus, isDE]);

  return (
    <div className={theme.page.container}>
      <SEO
        title="Sentence Builder | MeroDeutsch"
        description="Build German sentences tile by tile — practice articles, gender, and the Nominativ to Akkusativ rule."
      />
      <header className="mb-4">
        <Link
          to={isAuthenticated ? '/learn' : '/home'}
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
        >
          ← {isDE
            ? (isAuthenticated ? 'Zurück zum Lernpfad' : 'Zurück zur Startseite')
            : (isAuthenticated ? 'Back to learning path' : 'Back to Home')}
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

      {/* Focus selector: Akkusativ (Unit 2) | Trennbare Verben (Band D routine) */}
      <div className="mb-4 flex flex-wrap items-center gap-1">
        <span className="mr-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {isDE ? 'Fokus:' : 'Focus:'}
        </span>
        <button
          type="button"
          onClick={() => setFocus('akkusativ')}
          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
            focus === 'akkusativ'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200'
          }`}
        >
          Akkusativ
        </button>
        <button
          type="button"
          onClick={() => setFocus('separable')}
          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
            focus === 'separable'
              ? 'bg-violet-600 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200'
          }`}
        >
          {isDE ? 'Trennbare Verben' : 'Separable verbs'}
        </button>
      </div>

      {/* Focus rule note & Gender Legend (hidden in Nur DE — builder stays playable) */}
      {!isDE && (
        <div className="mb-6 space-y-3">
          {focus === 'akkusativ' && (
            <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-200">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <div>
                <strong>Akkusativ Rule:</strong> In accusative sentences (direct object), masculine{' '}
                <span className="font-bold text-blue-600 dark:text-blue-400">der / ein</span> changes to{' '}
                <span className="font-bold text-blue-600 dark:text-blue-400">den / einen</span>. Feminine,
                neuter, and plural remain unchanged!
              </div>
            </div>
          )}
          {focus === 'separable' && (
            <div className="flex items-start gap-2.5 rounded-xl border border-violet-200 bg-violet-50/70 p-3 text-xs text-violet-900 dark:border-violet-800/40 dark:bg-violet-950/30 dark:text-violet-200">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
              <div>
                <strong>Trennbare Verben (separable verbs):</strong> the conjugated stem stays in
                Position 2 and the prefix flies to the END — "Ich{' '}
                <span className="font-bold">stehe</span> um sechs Uhr{' '}
                <span className="font-bold">auf</span>." (aufstehen → stehe … auf)
              </div>
            </div>
          )}
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
          {separableEmpty
            ? isDE
              ? 'Noch keine trennbaren Verben im Cache. Gehe einmal online, um die Satz-Pools zu aktualisieren.'
              : 'No separable-verb sentences cached yet. Go online once to refresh the sentence pools.'
            : isDE
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
