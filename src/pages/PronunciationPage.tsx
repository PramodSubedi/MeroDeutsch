import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { speakWord } from '../hooks/useSpeech';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAnswerReporter } from '../hooks/useExerciseSession';
import { useSpeechRecognition, isSpeechRecognitionSupported } from '../hooks/useSpeechRecognition';
import { drawWithoutReplacement } from '../utils/questionGenerator';
import { LoadingBlock } from '../components/common/LoadingBlock';
import { theme } from '../config/theme';
import { curriculumService } from '../services';
import type { VocabCard } from '../types';
import { Link } from 'react-router-dom';
import { A1_PHONETICS, A1_SOUND_SHIFTS } from '../data/a1ResourcePack';

function normalizeForCompare(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics (ä→a, ö→o, ü→u)
    .replace(/ß/g, 'ss');
}

/** Classic Levenshtein edit distance (iterative, two-row DP). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1) // substitution
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

/**
 * Fuzzy match tolerance tuned for Web Speech API transcription variance:
 * ASR often transcribes correct-but-accented speech with 1–2 character
 * differences ("haus" → "hauss"/"hous"). Exact equality alone produces
 * false negatives that penalize CORRECT pronunciation.
 * Tolerance: ≤1 edit for short words, ≤~20% of length for longer ones.
 */
function isCloseMatch(spoken: string, target: string): boolean {
  if (spoken === target) return true;
  if (spoken.length === 0 || target.length === 0) return false;
  const maxDist = Math.max(1, Math.floor(Math.max(spoken.length, target.length) * 0.2));
  return levenshtein(spoken, target) <= maxDist;
}

export function PronunciationPage() {
  usePageTitle('Pronunciation');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  // Lesson Engine integration: XP + SRS reporting via the shared reporter.
  const reportResult = useAnswerReporter();
  const [word, setWord] = useState<any>(null);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [result, setResult] = useState<null | 'correct' | 'partial' | 'wrong'>(null);
  const [typed, setTyped] = useState('');
  // Track shown word keys so the same prompt isn't repeated until the pool cycles.
  const usedWordKeysRef = useRef<Set<string>>(new Set());
  const vocabRef = useRef<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    // Prefer an A1-lemma pool (mapped to the {id,de,en,ne} shape the page renders)
    // so practice stays A1-level; fall back to the general vocab table when the
    // A1 pool is thin/offline (legacy behavior). (Phase 4)
    const MIN_POOL = 8;
    const toLemma = (c: VocabCard) => ({
      id: c.id,
      de: c.lemma,
      en: c.translation?.en ?? '',
      ne: c.translation?.np ?? '',
    });
    curriculumService
      .getVocabularyFiltered({ level: 'A1' })
      .then((a1) => {
        if (cancelled) return null;
        if (a1 && a1.length >= MIN_POOL) return a1.map(toLemma);
        return curriculumService
          .getVocabularyFiltered({})
          .then((v) =>
            (v ?? []).map((e) => ({
              id: e.id,
              de: e.lemma,
              en: e.translation?.en ?? '',
              ne: e.translation?.np ?? '',
            }))
          );
      })
      .then((pool) => {
        if (cancelled || !pool || pool.length === 0) return;
        vocabRef.current = pool;
        const first = drawWithoutReplacement(pool, usedWordKeysRef.current, (v) => v.id);
        setWord(first ?? pool[0]);
      })
      .catch(() => {
        /* Offline / schema variance: keep empty state -> page shows Loading. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const supported = useMemo(isSpeechRecognitionSupported, []);
  const supportsNative = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const handleResult = useCallback(
    (transcript: string) => {
      if (!word) return;
      const target = normalizeForCompare(word.de);
      const spoken = normalizeForCompare(transcript);
      setTotal((t) => t + 1);

      // Correct: exact OR near-exact (fuzzy) match — tolerant of ASR
      // transcription variance so correct pronunciation isn't penalized.
      if (isCloseMatch(spoken, target)) {
        setResult('correct');
        setScore((s) => s + 1);
        // +10 XP for a correct pronunciation answer (shared reporter)
        reportResult({ correct: true, module: 'pronunciation' });
        return;
      }

      // Partial: any spoken WORD is close to any target word (word-level
      // fuzzy match instead of brittle substring containment).
      const targetTokens = target.split(/\s+/).filter(Boolean);
      const spokenTokens = spoken.split(/\s+/).filter(Boolean);
      const wordMatch =
        spokenTokens.length > 0 &&
        spokenTokens.some((st) =>
          targetTokens.some((tt) => {
            const tol = Math.max(1, Math.floor(tt.length * 0.25));
            return levenshtein(st, tt) <= tol;
          })
        );

      if (wordMatch) {
        setResult('partial');
        // Near-miss (correct word / lightly accented): queue for review as a soft-wrong
        // so it re-appears in SRS and is not silently dropped from XP/progress.
        reportResult({
          correct: false,
          module: 'pronunciation',
          itemKey: word.de,
          userAnswer: transcript,
          correctAnswer: word.de,
        });
      } else {
        setResult('wrong');
        reportResult({
          correct: false,
          module: 'pronunciation',
          itemKey: word.de,
          userAnswer: transcript,
          correctAnswer: word.de,
        });
      }
    },
    [reportResult, word]
  );

  const { listening, status, start } = useSpeechRecognition({
    lang: 'de-DE',
    onResult: (transcript) => {
      handleResult(transcript);
    },
  });

  if (!supportsNative) {
    return (
      <div className={theme.page.container}>
        <h1 className="text-2xl font-bold">{isDE ? 'Aussprache' : 'Pronunciation'}</h1>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          {isDE ? 'Dein Browser unterstützt keine Sprachsynthese.' : 'Your browser does not support speech synthesis.'}
        </div>
      </div>
    );
  }

  const next = () => {
    const vocab = vocabRef.current;
    if (vocab.length === 0) return;
    let n = drawWithoutReplacement(vocab, usedWordKeysRef.current, (v) => v.id);
    // Pool exhausted — cycle without repeating the first word forever.
    if (!n) {
      usedWordKeysRef.current.clear();
      n = drawWithoutReplacement(vocab, usedWordKeysRef.current, (v) => v.id);
    }
    if (!n) return;
    setWord(n);
    setResult(null);
    setTyped('');
  };

  if (!word) {
    return <LoadingBlock />;
  }

  return (
    <div className={theme.page.container}>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{isDE ? 'Aussprache-Übung' : 'Pronunciation Practice'}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {isDE
          ? 'Sprich das Wort — die App vergleicht deine Antwort.'
          : 'Speak the word — the app compares your answer.'}
      </p>

      {!supported && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          {isDE
            ? 'Spracherkennung nicht unterstützt — Tipp-Übung ist verfügbar.'
            : 'Speech recognition not supported — typing practice is available.'}
        </div>
      )}

      {/* Diphthong + sound-shift rules from the A1 Resource Pack (Unit 1). */}
      <div className={`${theme.panel.surface} mt-6`}>
        <h2 className="text-lg font-semibold">
          {isDE ? 'Diphthonge & Lautverschiebung' : 'Diphthongs & Sound Shifts'}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isDE
            ? 'Die Zweite-Regel: EI = Eye, IE = Eee, EU = Oy. W klingt wie V, V wie F, Z immer wie TS.'
            : 'The SECOND letter wins: EI = "Eye", IE = "Eee", EU = "Oy". W sounds like V, V like F, Z is always "TS".'}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {A1_PHONETICS.map((r) => (
            <div
              key={r.combo}
              className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm dark:border-blue-900/40 dark:bg-blue-950/30"
            >
              <div className="font-bold text-blue-700 dark:text-blue-300">
                {r.combo} → <span className="uppercase tracking-wide">{r.sound}</span>
              </div>
              <div className="mt-1 text-slate-700 dark:text-slate-200">{r.examples.join(' · ')}</div>
            </div>
          ))}
          {A1_SOUND_SHIFTS.map((r) => (
            <div
              key={r.combo}
              className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm dark:border-indigo-900/40 dark:bg-indigo-950/30"
            >
              <div className="font-bold text-indigo-700 dark:text-indigo-300">
                {r.combo} → <span className="uppercase tracking-wide">{r.sound}</span>
              </div>
              <div className="mt-1 text-slate-700 dark:text-slate-200">{r.examples.join(' · ')}</div>
            </div>
          ))}
        </div>
        <Link to="/games?game=oddoneout" className={`${theme.button.primary} mt-4 inline-flex min-h-[44px] items-center`}>
          {isDE ? 'Spiel: Phonetik-Rätsel →' : 'Play the phonetic trap game →'}
        </Link>
      </div>

      <div className={`${theme.panel.surface} mx-auto mt-6 max-w-xl`}>
        <div className="mb-2 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>{isDE ? 'Punkte' : 'Score'}: <b className="text-slate-900 dark:text-white">{score}</b> / {total}</span>
          <span>{status}</span>
        </div>

        <div className="mb-4 rounded-2xl border border-dashed border-blue-300 bg-blue-50/60 p-4 text-center dark:border-blue-700 dark:bg-blue-950/40">
          <div className="text-3xl font-bold text-slate-900 dark:text-white">{word.de}</div>
          <div className="mt-1 text-sm text-blue-600 dark:text-blue-300">{isDE ? '' : word.en}</div>
          <button type="button" onClick={() => speakWord(word.de)} className={`${theme.button.primary} mt-3`}>
            🔊 {isDE ? 'Wort hören' : 'Hear word'}
          </button>
        </div>

        {!supported ? (
          // Typing fallback
          <div>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={isDE ? 'Tippe das Wort…' : 'Type the word…'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && typed.trim()) {
                  handleResult(typed);
                }
              }}
              className={theme.input}
            />
            <div className="mt-4 flex justify-center">
              {result === 'correct' || result === 'partial' || result === 'wrong' ? (
                <button type="button" onClick={next} className={theme.button.primary}>
                  {isDE ? 'Nächstes Wort →' : 'Next Word →'}
                </button>
              ) : (
                <button
                  type="button"
                  className={theme.button.secondary}
                  onClick={() => {
                    if (typed.trim()) handleResult(typed);
                  }}
                >
                  {isDE ? 'Prüfen' : 'Check'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" onClick={start} disabled={listening} className={`${theme.button.primary} disabled:opacity-50`}>
              🎤 {listening ? (isDE ? 'Höre zu…' : 'Listening…') : isDE ? 'Sprechen' : 'Speak'}
            </button>
            {result && (
              <button type="button" onClick={next} className={theme.button.primary}>
                {isDE ? 'Nächstes Wort →' : 'Next Word →'}
              </button>
            )}
          </div>
        )}

        {result && (
          <div className={`mt-4 rounded-xl p-3 text-center text-sm font-semibold ${
            result === 'correct'
              ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              : result === 'partial'
              ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
              : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
          }`}>
            {result === 'correct' && (isDE ? '🎉 Sehr gut!' : '🎉 Excellent!')}
            {result === 'partial' && (isDE ? `👍 Fast! Richtig: ${word.de}` : `👍 Almost! Correct: ${word.de}`)}
            {result === 'wrong' && (isDE ? `❌ Richtig: ${word.de}` : `❌ Correct: ${word.de}`)}
          </div>
        )}
      </div>
    </div>
  );
}