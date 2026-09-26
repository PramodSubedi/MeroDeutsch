import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { speakWord } from '../hooks/useSpeech';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAnswerReporter } from '../hooks/useExerciseSession';
import { useSpeechRecognition, isSpeechRecognitionSupported } from '../hooks/useSpeechRecognition';
import { drawWithoutReplacement } from '../utils/questionGenerator';
import {
  isCloseMatch,
  levenshtein,
  normalizeForSpeech,
  speechDiffIndices,
} from '../utils/answerNormalize';
import { LoadingBlock } from '../components/common/LoadingBlock';
import { theme } from '../config/theme';
import { curriculumService } from '../services';
import type { VocabCard } from '../types';
import { Link } from 'react-router-dom';
import { A1_PHONETICS, A1_SOUND_SHIFTS } from '../data/a1ResourcePack';

/** The one practice word shape this page renders (a flat A1 lemma). */
interface PracticeWord {
  id: string;
  de: string;
  en: string;
  ne: string;
}

export function PronunciationPage() {
  usePageTitle('Pronunciation');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  // Lesson Engine integration: XP + SRS reporting via the shared reporter.
  const reportResult = useAnswerReporter();
  const [word, setWord] = useState<PracticeWord | null>(null);
  const [loadingWords, setLoadingWords] = useState(true);
  const [wordLoadFailed, setWordLoadFailed] = useState(false);
  const [reloadWords, setReloadWords] = useState(0);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [result, setResult] = useState<null | 'correct' | 'partial' | 'wrong'>(null);
  const [typed, setTyped] = useState('');
  /** What the recogniser actually heard on the last attempt — drives the
      per-character hint. Kept so the learner can see the gap, not just a verdict. */
  const [heard, setHeard] = useState<string>('');
  // Track shown word keys so the same prompt isn't repeated until the pool cycles.
  const usedWordKeysRef = useRef<Set<string>>(new Set());
  const vocabRef = useRef<PracticeWord[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoadingWords(true);
    setWordLoadFailed(false);
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
        if (cancelled) return;
        if (!pool || pool.length === 0) {
          setWordLoadFailed(false);
          setLoadingWords(false);
          return;
        }
        vocabRef.current = pool;
        const first = drawWithoutReplacement(pool, usedWordKeysRef.current, (v) => v.id);
        setWord(first ?? pool[0]);
        setLoadingWords(false);
      })
      .catch(() => {
        if (!cancelled) {
          setWordLoadFailed(true);
          setLoadingWords(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadWords]);

  const supported = useMemo(isSpeechRecognitionSupported, []);
  const supportsNative = typeof window !== 'undefined' && 'speechSynthesis' in window;

  /** Which letters of the target the last attempt most likely got wrong. */
  const diffIndices = useMemo(
    () => (heard && word && result !== 'correct' ? speechDiffIndices(heard, word.de) : []),
    [heard, word, result]
  );

  const handleResult = useCallback(
    (transcript: string) => {
      if (!word) return;
      setHeard(transcript);
      const target = normalizeForSpeech(word.de);
      const spoken = normalizeForSpeech(transcript);
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
        <div className="mt-4 rounded-md border border-warning-200 bg-warning-50 p-4 text-body text-warning-800 dark:border-warning-700 dark:bg-warning-900/20 dark:text-warning-300">
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
    // Clear the transcript too, or the previous word's "I heard" hint would
    // linger under the new word and highlight letters that were never attempted.
    setHeard('');
  };

  if (!word) {
    if (loadingWords) {
      return <LoadingBlock label={isDE ? 'Wörter werden geladen…' : 'Loading words…'} />;
    }
    return (
      <div className={theme.page.container}>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-950 dark:text-white">
          {isDE ? 'Aussprache-Übung' : 'Pronunciation Practice'}
        </h1>
        <div role="alert" className="mt-4 rounded-md border border-warning-200 bg-warning-50 p-4 text-body text-warning-800 dark:border-warning-700 dark:bg-warning-900/20 dark:text-warning-300">
          {wordLoadFailed
            ? isDE ? 'Wörter konnten nicht geladen werden. Prüfe deine Verbindung und versuche es erneut.' : 'Words could not be loaded. Check your connection and try again.'
            : isDE ? 'Keine Wörter verfügbar.' : 'No words are available.'}
        </div>
        <button type="button" onClick={() => setReloadWords((attempt) => attempt + 1)} className={`${theme.button.secondary} mt-4`}>
          {isDE ? 'Erneut versuchen' : 'Retry'}
        </button>
      </div>
    );
  }

  return (
    <div className={theme.page.container}>
      <h1 className="text-2xl font-semibold tracking-tight text-ink-950 dark:text-white">{isDE ? 'Aussprache-Übung' : 'Pronunciation Practice'}</h1>
      <p className="mt-1 text-body text-ink-500 dark:text-ink-400">
        {isDE
          ? 'Sprich das Wort — die App vergleicht deine Antwort.'
          : 'Speak the word — the app compares your answer.'}
      </p>

      {!supported && (
        <div className="mt-4 rounded-md border border-warning-200 bg-warning-50 p-4 text-body text-warning-800 dark:border-warning-700 dark:bg-warning-900/20 dark:text-warning-300">
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
        <p className="mt-1 text-body text-ink-500 dark:text-ink-400">
          {isDE
            ? 'Die Zweite-Regel: EI = Eye, IE = Eee, EU = Oy. W klingt wie V, V wie F, Z immer wie TS.'
            : 'The SECOND letter wins: EI = "Eye", IE = "Eee", EU = "Oy". W sounds like V, V like F, Z is always "TS".'}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {A1_PHONETICS.map((r) => (
            <div
              key={r.combo}
              className="rounded-md border border-accent-100 bg-accent-50/60 p-4 text-body dark:border-accent-900/40 dark:bg-accent-950/30"
            >
              <div className="font-bold text-accent-700 dark:text-accent-300">
                {r.combo} → <span className="uppercase tracking-wide">{r.sound}</span>
              </div>
              <div className="mt-1 text-ink-700 dark:text-ink-200">{r.examples.join(' · ')}</div>
            </div>
          ))}
          {A1_SOUND_SHIFTS.map((r) => (
            <div
              key={r.combo}
              className="rounded-md border border-accent-100 bg-accent-50/60 p-4 text-body dark:border-accent-900/40 dark:bg-accent-950/30"
            >
              <div className="font-bold text-accent-700 dark:text-accent-300">
                {r.combo} → <span className="uppercase tracking-wide">{r.sound}</span>
              </div>
              <div className="mt-1 text-ink-700 dark:text-ink-200">{r.examples.join(' · ')}</div>
            </div>
          ))}
        </div>
        <Link to="/games?game=oddoneout" className={`${theme.button.primary} mt-4 inline-flex min-h-[44px] items-center`}>
          {isDE ? 'Spiel: Phonetik-Rätsel →' : 'Play the phonetic trap game →'}
        </Link>
      </div>

      <div className={`${theme.panel.surface} mx-auto mt-6 max-w-xl`}>
        <div className="mb-2 flex items-center justify-between text-body text-ink-500 dark:text-ink-400">
          <span>{isDE ? 'Punkte' : 'Score'}: <b className="text-ink-900 dark:text-white">{score}</b> / {total}</span>
          <span>{status}</span>
        </div>

        <div className="mb-4 rounded-lg border border-dashed border-accent-300 bg-accent-50/60 p-4 text-center dark:border-accent-700 dark:bg-accent-950/40">
          <div className="text-3xl font-bold text-ink-900 dark:text-white">{word.de}</div>
          <div className="mt-1 text-body text-accent-600 dark:text-accent-300">{isDE ? '' : word.en}</div>
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
          <div className={`mt-4 rounded-md p-3 text-center text-body font-semibold ${
            result === 'correct'
              ? 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300'
              : result === 'partial'
              ? 'bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300'
              : 'bg-danger-50 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300'
          }`}>
            {result === 'correct' && (isDE ? '🎉 Sehr gut!' : '🎉 Excellent!')}
            {result === 'partial' && (isDE ? `👍 Fast! Richtig: ${word.de}` : `👍 Almost! Correct: ${word.de}`)}
            {result === 'wrong' && (isDE ? `❌ Richtig: ${word.de}` : `❌ Correct: ${word.de}`)}
          </div>
        )}

        {/* WHAT THE APP HEARD, and which letters to focus on.
            A verdict alone ("wrong") tells a learner nothing actionable; showing
            the mispronounced letter turns the same data into a fix. Falls back to
            the plain transcript when the two words are too different to align
            (see speechDiffIndices). Only rendered when something was misheard —
            spelling out a correct word would just be noise. */}
        {result && result !== 'correct' && heard && (
          <div className="mt-3 rounded-md border border-ink-200 bg-white p-3 text-center dark:border-ink-800 dark:bg-ink-900">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
              {isDE ? 'Ich habe gehört' : 'I heard'}
            </div>
            <div className="mt-1 text-lg text-ink-700 dark:text-ink-200">
              {diffIndices.length > 0 ? (
                <>
                  {word.de.split('').map((ch, i) =>
                    diffIndices.includes(i) ? (
                      <span
                        key={`${ch}-${i}`}
                        className="rounded-sm bg-danger-100 px-0.5 font-bold text-danger-700 underline decoration-danger-500 decoration-2 underline-offset-2 dark:bg-danger-900/40 dark:text-danger-300"
                      >
                        {ch}
                      </span>
                    ) : (
                      <span key={`${ch}-${i}`}>{ch}</span>
                    )
                  )}
                </>
              ) : (
                <span className="italic text-ink-500 dark:text-ink-400">“{heard}”</span>
              )}
            </div>
            {diffIndices.length > 0 && (
              <p className="mt-2 text-meta text-ink-500 dark:text-ink-400">
                {isDE
                  ? 'Achte auf die hervorgehobenen Buchstaben.'
                  : 'Focus on the highlighted letters.'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}