/**
 * src/pages/DictationPage.tsx
 *
 * Audio-to-text dictation driven by the shared Lesson Engine
 * (`useExerciseSession` + `<DictationInput>`). Draws a finite deck of 10
 * unique items per round; "Play again" reshuffles. The +50 XP dictation tier
 * and SRS miss-queueing are owned by the engine session (xpAmount config).
 *
 * TWO MODES
 * ---------
 *   words     — one German word per clip. The recording is the Anki/Thorsten
 *               clip when one exists (resolved inside `speakWord`), otherwise
 *               synthesized speech.
 *   sentences — a whole German sentence, played from a BUNDLED recording
 *               (`examples[].audioUrl`). These come from the Goethe-Institut A1
 *               deck, which carries one clip per Anki CARD and each card has
 *               its own example sentence — 618 of them, none of which any
 *               surface could reach before `scripts/bundle-offline-seed.cjs`
 *               started copying `sentences[].audio_url` onto the examples.
 *               They are read from the Dexie `vocab` cache, so the mode works
 *               fully offline after first boot.
 *
 * TTS SAFETY (.clinerules C2.6)
 * -----------------------------
 * In both modes the audio IS the question and nothing speaks the answer before
 * lock. Sentence mode calls `playAudioUrl` with NO fallback text, so a failed
 * load is silent rather than reading the answer aloud.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { playAudioUrl, speakWord } from '../hooks/useSpeech';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { XP_REWARDS } from '../hooks/useXp';
import { theme } from '../config/theme';
import { curriculumService } from '../services';
import { openDb } from '../lib/db';
import { pickNUnique } from '../utils/questionGenerator';
import { useWeakKeysFor } from '../hooks/useSkillAccuracy';
import {
  useExerciseSession,
  type ExerciseQuestion,
} from '../hooks/useExerciseSession';
import { DictationInput } from '../components/exercises/DictationInput';
import { ExerciseRoundFooter } from '../components/exercises/ExerciseRoundFooter';
import { LoadingBlock, ContentPending } from '../components/common/LoadingBlock';
import { isCloseMatch, normalizeAnswer, normalizeForSpeech } from '../utils/answerNormalize';
import type { DictationWord } from '../types/curriculum';

type DictationMode = 'words' | 'sentences';

/** Engine-compatible dictation question (audio prompt = the item itself). */
interface DictationQuestion extends ExerciseQuestion {
  /** Bundled sentence recording. Absent in word mode, which resolves its own. */
  audioUrl?: string;
}

/** One bundled sentence + the clip that speaks it. */
interface SentenceClip {
  key: string;
  de: string;
  audioUrl: string;
}

const DECK_SIZE = 10;

/**
 * Grade a SPOKEN sentence the learner typed back.
 *
 * Word mode compares with `normalizeAnswer` only, because typing German is the
 * skill being tested and the diacritics must be reproduced as written. That
 * tolerance is wrong for a sentence heard through a 22 kHz mono clip: nobody
 * reliably recovers "ä" vs "ae" or "ß" vs "ss" from audio alone. So the
 * sentence path accepts an exact match OR a word-by-word `isCloseMatch`, which
 * is the same comparator `PronunciationPage` uses for the same reason.
 */
function matchesSpokenSentence(input: string, target: string): boolean {
  if (normalizeAnswer(input) === normalizeAnswer(target)) return true;
  const a = normalizeForSpeech(input).split(/\s+/).filter(Boolean);
  const b = normalizeForSpeech(target).split(/\s+/).filter(Boolean);
  if (a.length === 0 || a.length !== b.length) return false;
  return a.every((word, i) => isCloseMatch(word, b[i]));
}

export function DictationPage() {
  usePageTitle('Dictation');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const [mode, setMode] = useState<DictationMode>('words');
  const [dictationWords, setDictationWords] = useState<DictationWord[]>([]);
  const [sentenceClips, setSentenceClips] = useState<SentenceClip[]>([]);
  const [loaded, setLoaded] = useState(false);
  /** Increments to reshuffle a fresh deck. */
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // The word pool is a Supabase content pool; the sentence clips live in the
    // Dexie `vocab` cache that `useDexieInit` seeds from enriched-vocab.json.
    // Both are fetched so switching modes is instant.
    Promise.all([
      curriculumService.getDictationWords().catch(() => [] as DictationWord[]),
      (async () => {
        const db = openDb();
        if (!db) return [] as SentenceClip[];
        const cards = await db.vocab.toArray();
        const out: SentenceClip[] = [];
        for (const card of cards) {
          for (const ex of card.examples ?? []) {
            if (ex.audioUrl && ex.de) {
              out.push({ key: `${card.id}:${ex.audioUrl}`, de: ex.de, audioUrl: ex.audioUrl });
            }
          }
        }
        return out;
      })().catch(() => [] as SentenceClip[]),
    ]).then(([words, sentences]) => {
      if (cancelled) return;
      setDictationWords(words);
      setSentenceClips(sentences);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const useSentences = mode === 'sentences';

  // Finite without-replacement deck per round (Lesson Engine contract),
  // biased toward items this learner has got wrong before (SRS rows written
  // under moduleType 'dictation'). `runId` forces a fresh reshuffle on replay.
  const weakKeys = useWeakKeysFor('dictation');
  const deck = useMemo<DictationQuestion[]>(() => {
    if (useSentences) {
      return pickNUnique({
        items: sentenceClips,
        count: Math.min(DECK_SIZE, sentenceClips.length),
        getKey: (s) => s.key,
        preferKeys: weakKeys,
      }).map((s) => ({
        key: s.key,
        correctAnswer: s.de,
        audioUrl: s.audioUrl,
      }));
    }
    return pickNUnique({
      items: dictationWords,
      count: Math.min(DECK_SIZE, dictationWords.length),
      getKey: (w) => w.word,
      preferKeys: weakKeys,
    }).map((w) => ({
      key: w.word,
      correctAnswer: w.word,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dictationWords, sentenceClips, useSentences, runId, weakKeys]);

  const session = useExerciseSession<DictationQuestion>({
    questions: deck,
    module: 'dictation',
    xpAmount: XP_REWARDS.dictation, // +50 XP dictation tier
    matches: (input, q) =>
      useSentences
        ? matchesSpokenSentence(input, q.correctAnswer)
        : normalizeAnswer(input) === normalizeAnswer(q.correctAnswer),
  });

  const onPlayAudio = useCallback(
    (q: DictationQuestion) => {
      if (q.audioUrl) {
        // No fallback text: a load failure must stay silent rather than speak
        // the answer text that `q.correctAnswer` holds.
        playAudioUrl(q.audioUrl);
        return;
      }
      speakWord(q.correctAnswer);
    },
    []
  );

  const switchMode = useCallback((next: DictationMode) => {
    setMode(next);
    setRunId((r) => r + 1);
  }, []);

  const title = isDE ? 'Diktat' : 'Dictation';
  const subtitle = useSentences
    ? isDE
      ? 'Höre den ganzen Satz und tippe ihn ab.'
      : 'Listen to the whole sentence, then type it out.'
    : isDE
      ? 'Höre das Wort und tippe, was du gehört hast.'
      : 'Listen to the German word, then type what you heard.';

  if (!loaded) {
    // Loading guard — avoid blank flash while dictation words load.
    return <LoadingBlock />;
  }

  // Pool empty for the SELECTED mode (not seeded yet / offline before first
  // fetch) — friendly state.
  const poolSize = useSentences ? sentenceClips.length : dictationWords.length;
  if (poolSize === 0) {
    return (
      <div className={theme.page.container}>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-950 dark:text-white">{title}</h1>
        <ModeSwitch mode={mode} onChange={switchMode} isDE={isDE} sentenceCount={sentenceClips.length} />
        <ContentPending isDE={isDE} />
      </div>
    );
  }

  return (
    <div className={theme.page.container}>
      <h1 className="text-2xl font-semibold tracking-tight text-ink-950 dark:text-white">{title}</h1>
      <p className="mt-1 text-body text-ink-500 dark:text-ink-400">{subtitle}</p>

      <ModeSwitch mode={mode} onChange={switchMode} isDE={isDE} sentenceCount={sentenceClips.length} />

      <div className="mx-auto mt-6 max-w-xl">
        <DictationInput
          session={session}
          onPlayAudio={onPlayAudio}
          autoPlay={false}
          hideFooter
          itemNoun={useSentences ? { singular: 'Satz', plural: 'Sätze' } : { singular: 'Wort', plural: 'Wörter' }}
        />
        {/* Round footer: next/finish + play again (shared component) */}
        <ExerciseRoundFooter
          session={session}
          onPlayAgain={() => setRunId((r) => r + 1)}
          nextLabel={
            useSentences
              ? isDE
                ? 'Nächster Satz →'
                : 'Next Sentence →'
              : isDE
                ? 'Nächstes Wort →'
                : 'Next Word →'
          }
        />
      </div>
    </div>
  );
}

/** Words / Sentences toggle. Hidden entirely when no bundled sentence exists. */
function ModeSwitch({
  mode,
  onChange,
  isDE,
  sentenceCount,
}: {
  mode: DictationMode;
  onChange: (m: DictationMode) => void;
  isDE: boolean;
  sentenceCount: number;
}) {
  if (sentenceCount === 0) return null;
  const options: { value: DictationMode; label: string }[] = [
    { value: 'words', label: isDE ? 'Wörter' : 'Words' },
    { value: 'sentences', label: isDE ? 'Sätze' : 'Sentences' },
  ];
  return (
    <div role="tablist" aria-label={isDE ? 'Diktat-Modus' : 'Dictation mode'} className="mt-4 inline-flex gap-1 rounded-lg border border-ink-200 p-1 dark:border-ink-800">
      {options.map((o) => {
        const active = mode === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`${active ? theme.button.toggleActive : theme.button.toggleInactive} focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:outline-none`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
