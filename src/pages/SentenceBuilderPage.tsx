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
import { useSearchParams } from 'react-router-dom';
import { Grid, Keyboard, Mic, ShieldAlert } from 'lucide-react';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { SEO } from '../components/common/SEO';
import { theme } from '../config/theme';
import { curriculumService } from '../services';
import { detectSeparableVerb } from '../data/a1Verbs';
import { TemplateResolver } from '../lib/templateResolver';
import type { LexicalEntity, SentenceExercise } from '../types/curriculum';
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

function toTemplateSentenceItem(ex: ReturnType<typeof TemplateResolver.resolveOriginStatement>, hint?: string): SentenceItem {
  return {
    id: ex.id,
    words: ex.correctOrder,
    distractors: ex.distractors,
    hint,
  };
}

const TEMPLATE_COUNTRIES: LexicalEntity[] = [
  { id: 'country:nepal', category: 'country', lemma: 'Nepal', partOfSpeech: 'noun', gender: 'neuter', caseGovernance: { prep_aus: 'aus' }, translations: { en: 'Nepal', ne: 'नेपाल' } },
  { id: 'country:schweiz', category: 'country', lemma: 'Schweiz', partOfSpeech: 'noun', gender: 'feminine', caseGovernance: { prep_aus: 'aus der' }, translations: { en: 'Switzerland', ne: 'स्वित्जरल्याण्ड' } },
  { id: 'country:deutschland', category: 'country', lemma: 'Deutschland', partOfSpeech: 'noun', gender: 'neuter', caseGovernance: { prep_aus: 'aus' }, translations: { en: 'Germany', ne: 'जर्मनी' } },
  { id: 'country:indien', category: 'country', lemma: 'Indien', partOfSpeech: 'noun', gender: 'neuter', caseGovernance: { prep_aus: 'aus' }, translations: { en: 'India', ne: 'भारत' } },
  { id: 'country:turkei', category: 'country', lemma: 'Türkei', partOfSpeech: 'noun', gender: 'feminine', caseGovernance: { prep_aus: 'aus der' }, translations: { en: 'Turkey', ne: 'टर्की' } },
];

export function SentenceBuilderPage() {
  usePageTitle('Sentence Builder');
  const { langMode } = useLang();
  const isDE = langMode === 'german';

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
        let pool: SentenceExercise[] = await curriculumService.getSentences('akkusativ', 4);
        // Top up from the full pool if the focused fetch is short.
        if (pool.length < 4) {
          const more = await curriculumService.getSentences(undefined, 8 - pool.length);
          pool = [...pool, ...more];
        }

        if (!cancelled && pool.length > 0) {
          setItems(pool.map((ex) => toSentenceItem(ex)));
          setError(null);
          return;
        }

        const generated = TemplateResolver.generateOriginExercises(TEMPLATE_COUNTRIES, ['ich', 'du', 'wir'], 4);
        if (!cancelled) {
          setItems(generated.map((exercise) => toTemplateSentenceItem(exercise, isDE ? 'Fokus: Herkunft mit "aus" / "aus der".' : 'Focus: origin with "aus" / "aus der".')));
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          const generated = TemplateResolver.generateOriginExercises(TEMPLATE_COUNTRIES, ['ich', 'du', 'wir'], 4);
          setItems(generated.map((exercise) => toTemplateSentenceItem(exercise, isDE ? 'Fokus: Herkunft mit "aus" / "aus der".' : 'Focus: origin with "aus" / "aus der".')));
          setError(e instanceof Error ? e.message : 'Failed to load sentences');
        }
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
        <h1 className="text-2xl font-bold text-ink-950 dark:text-white">
          {isDE ? 'Satzbau — Einheit 2' : 'Sentence Builder — Unit 2'}
        </h1>
        <p className="mt-1 text-body text-ink-500 dark:text-ink-400">
          {isDE
            ? 'Baue Sätze mit Artikeln und Genus. Achtung: der → den im Akkusativ!'
            : 'Build sentences with articles and gender. Watch out: der to den in the accusative!'}
        </p>
      </header>

      {/* Mode & Difficulty Segmented Controls */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg bg-ink-100 p-3 dark:bg-ink-800/80">
        {/* Interaction Mode */}
        <div className="flex items-center gap-1">
          <span className="mr-2 text-meta font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
            {isDE ? 'Modus:' : 'Mode:'}
          </span>
          <button
            type="button"
            onClick={() => setMode('tiles')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-meta font-bold transition ${
              mode === 'tiles'
                ? 'bg-accent-600 text-white shadow-sm'
                : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-200 dark:bg-ink-700 dark:border-ink-800 dark:text-ink-200'
            }`}
          >
            <Grid className="h-3.5 w-3.5" />
            {isDE ? 'Kacheln' : 'Tiles'}
          </button>
          <button
            type="button"
            onClick={() => setMode('typing')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-meta font-bold transition ${
              mode === 'typing'
                ? 'bg-accent-600 text-white shadow-sm'
                : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-200 dark:bg-ink-700 dark:border-ink-800 dark:text-ink-200'
            }`}
          >
            <Keyboard className="h-3.5 w-3.5" />
            {isDE ? 'Tippen' : 'Typing'}
          </button>
          <button
            type="button"
            onClick={() => setMode('voice')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-meta font-bold transition ${
              mode === 'voice'
                ? 'bg-accent-600 text-white shadow-sm'
                : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-200 dark:bg-ink-700 dark:border-ink-800 dark:text-ink-200'
            }`}
          >
            <Mic className="h-3.5 w-3.5" />
            {isDE ? 'Sprache' : 'Voice'}
          </button>
        </div>

        {/* Difficulty Selector */}
        <div className="flex items-center gap-1">
          <span className="mr-2 text-meta font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
            {isDE ? 'Schwierigkeit:' : 'Difficulty:'}
          </span>
          {(['easy', 'medium', 'hard'] as const).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setDifficulty(level)}
              className={`rounded-md px-3 py-1.5 text-meta font-bold capitalize transition ${
                difficulty === level
                  ? 'bg-ink-900 text-white shadow-sm dark:border border-ink-200 bg-white dark:text-ink-900'
                  : 'bg-white text-ink-700 hover:bg-ink-200 dark:bg-ink-700 dark:border-ink-800 dark:text-ink-200'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Focus selector: Akkusativ (Unit 2) | Trennbare Verben (Band D routine) */}
      <div className="mb-4 flex flex-wrap items-center gap-1">
        <span className="mr-2 text-meta font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
          {isDE ? 'Fokus:' : 'Focus:'}
        </span>
        <button
          type="button"
          onClick={() => setFocus('akkusativ')}
          className={`rounded-md px-3 py-1.5 text-meta font-bold transition ${
            focus === 'akkusativ'
              ? 'bg-accent-600 text-white shadow-sm'
              : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-200 dark:bg-ink-700 dark:border-ink-800 dark:text-ink-200'
          }`}
        >
          Akkusativ
        </button>
        <button
          type="button"
          onClick={() => setFocus('separable')}
          className={`rounded-md px-3 py-1.5 text-meta font-bold transition ${
            focus === 'separable'
              ? 'bg-accent-600 text-white shadow-sm'
              : 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-200 dark:bg-ink-700 dark:border-ink-800 dark:text-ink-200'
          }`}
        >
          {isDE ? 'Trennbare Verben' : 'Separable verbs'}
        </button>
      </div>

      {/* Focus rule note & Gender Legend (hidden in Nur DE — builder stays playable) */}
      {!isDE && (
        <div className="mb-6 space-y-3">
          {focus === 'akkusativ' && (
            <div className="flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50/70 p-3 text-meta text-accent-900 dark:border-accent-800/40 dark:bg-accent-950/30 dark:text-accent-200">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-accent-600 dark:text-accent-400" />
              <div>
                <strong>Akkusativ Rule:</strong> In accusative sentences (direct object), masculine{' '}
                <span className="font-bold text-accent-600 dark:text-accent-400">der / ein</span> changes to{' '}
                <span className="font-bold text-accent-600 dark:text-accent-400">den / einen</span>. Feminine,
                neuter, and plural remain unchanged!
              </div>
            </div>
          )}
          {focus === 'separable' && (
            <div className="flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50/70 p-3 text-meta text-accent-900 dark:border-accent-800/40 dark:bg-accent-950/30 dark:text-accent-200">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-accent-600 dark:text-accent-400" />
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
        <div className="py-8 text-center text-ink-500 dark:text-ink-400">
          {isDE ? 'Sätze werden geladen…' : 'Loading sentences…'}
        </div>
      ) : error ? (
        <div className="rounded-md bg-warning-50 p-4 text-body text-warning-800 dark:bg-warning-950/40 dark:text-warning-200">
          {isDE
            ? `Fehler beim Laden: ${error}. Zeige gecachte Sätze.`
            : `Load error: ${error}. Showing cached fallback.`}
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-ink-500 dark:text-ink-400">
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
