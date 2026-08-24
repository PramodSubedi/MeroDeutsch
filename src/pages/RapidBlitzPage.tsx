/**
 * pages/RapidBlitzPage.tsx
 *
 * 60-second multi-challenge Rapid Blitz game.
 * Rotates through 6 challenge types: vocabulary, audio, articles, numbers, verbs, pronunciation.
 * Supports mode filtering: users pick a mode to focus on, or play Mixed.
 *
 * When accessed via /rapid-blitz (from Practice Tools Grid): shows mode selector first.
 * When accessed via /rapid-fire (from homepage): skips mode selector, goes straight to game.
 *
 * Game flow: idle -> preRound (timer paused, instructions shown) -> countdown -> playing
 *            -> (sectionInfo -> countdown -> playing) x6 -> finished
 */

import React, { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import { useRapidBlitzMultiChallenge, getChallengeQuestion } from '../hooks/useRapidBlitzMultiChallenge';
import { ChallengeView } from '../components/RapidBlitz/ChallengeView';
import { theme } from '../config/theme';
import { Link } from 'react-router-dom';
import { BookOpen, Ear, Tag, Hash, Edit3, Mic } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { GetReadyCountdown } from '../components/common/GetReadyCountdown';

const CHALLENGE_MODES = [
  'vocabulary-translation',
  'audio-comprehension',
  'article-precision',
  'number-conversion',
  'verb-conjugation',
  'pronunciation-reading',
] as const;

interface ModeInfo {
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}

const MODE_INFO: Record<string, ModeInfo> = {
  vocabulary: { title: 'Vocabulary Translation', description: 'Match English → German', icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/50' },
  audio: { title: 'Audio Comprehension', description: 'Listen & select meaning', icon: Ear, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900/50' },
  article: { title: 'Article Precision', description: 'Select der/die/das', icon: Tag, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900/50' },
  number: { title: 'Number Conversion', description: 'Digits ↔ German text', icon: Hash, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50' },
  verb: { title: 'Verb Conjugation', description: 'Conjugate the verb', icon: Edit3, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/50' },
  pronunciation: { title: 'Pronunciation & Reading', description: 'Speak the word', icon: Mic, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50' },
};

const MIXED_INFO: ModeInfo = {
  title: 'Mixed Challenge',
  description: 'All 6 types shuffled',
  icon: BookOpen,
  color: 'text-slate-700 dark:text-slate-300',
  bg: 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700',
};

/** Per-mode how-to-play instructions shown during the pre-round banner. */
const MODE_INSTRUCTIONS: Record<string, { do: string; example: string }> = {
  'vocabulary-translation': {
    do: 'Read the English word, then tap the correct German translation.',
    example: 'e.g. "apple" → "der Apfel"',
  },
  'audio-comprehension': {
    do: 'Listen to the German audio, then tap the correct English meaning.',
    example: 'e.g. 🔊 "Haus" → "house"',
  },
  'article-precision': {
    do: 'Read the German noun, then tap the correct article (der/die/das).',
    example: 'e.g. "___ Apfel" → "der"',
  },
  'number-conversion': {
    do: 'Convert between digits and German number words.',
    example: 'e.g. "5" → "fünf" or "fünf" → "5"',
  },
  'verb-conjugation': {
    do: 'Read the pronoun + verb, then tap the correct conjugated form.',
    example: 'e.g. "ich ___ (sein)" → "bin"',
  },
  'pronunciation-reading': {
    do: 'Read the German word out loud into your microphone.',
    example: 'e.g. Say "Guten Morgen" clearly',
  },
};

/** How-to-play instructions shown for the Mixed Challenge. */
const MIXED_INSTRUCTIONS: { do: string; example: string } = {
  do: 'Challenges rotate across all 6 types. Answer as many as you can before the clock runs out!',
  example: 'Each correct answer is worth up to 20 XP (10 × combo multiplier).',
};

export function RapidBlitzPage() {
  usePageTitle('Rapid Blitz | MeroDeutsch');
  const location = useLocation();

  // Show mode selector only when accessed from /rapid-blitz (practice tools grid)
  // Skip mode selector when accessed from /rapid-fire (homepage) — go straight to game
  const showModeSelector = location.pathname === '/rapid-blitz';

  const [selectedMode, setSelectedMode] = React.useState<string | null>(() => {
    // On /rapid-fire (homepage), always use Mixed mode — ignore stored mode
    if (location.pathname === '/rapid-fire') return null;
    const stored = localStorage.getItem('rapidBlitzMode');
    if (stored) return stored;
    const urlMode = new URLSearchParams(window.location.search).get('mode');
    return urlMode ? urlMode : null;
  });

  // Persist mode to localStorage whenever it changes
  React.useEffect(() => {
    if (selectedMode) {
      localStorage.setItem('rapidBlitzMode', selectedMode);
    } else {
      localStorage.removeItem('rapidBlitzMode');
    }
  }, [selectedMode]);

  // If navigating to /rapid-fire (homepage) while a mode is stored, reset to Mixed
  React.useEffect(() => {
    if (location.pathname === '/rapid-fire') {
      setSelectedMode(null);
    }
  }, [location.pathname]);

  const modeForHook = selectedMode || undefined;
  const modeLabel = selectedMode ? MODE_INFO[selectedMode.split('-')[0]] : MIXED_INFO;

  const {
    status,
    challenges,
    currentChallenge,
    currentIndex,
    currentSectionType,
    currentSection,
    totalSections,
    secondsLeft,
    score,
    combo,
    multiplier,
    bestScore,
    correctCount,
    wrongCount,
    history,
    locked,
    startGame,
    continuePreRound,
    startPlaying,
    answer,
    answerSpeech,
    skip,
  } = useRapidBlitzMultiChallenge(modeForHook as any);

  const accuracy = useMemo(() => {
    if (correctCount + wrongCount === 0) return 0;
    return Math.round((correctCount / (correctCount + wrongCount)) * 100);
  }, [correctCount, wrongCount]);

  // Lock body scroll while the finished overlay is open (prevents background
  // scrolling behind the fixed modal on mobile).
  useEffect(() => {
    if (status !== 'finished') return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [status]);

  // ── Idle / mode selection state ─────────────────────────────────
  if (status === 'idle') {
    // If no mode selector needed (homepage route /rapid-fire), show simple idle
    if (!showModeSelector) {
      return (
        <div className={theme.page.container}>
          <div className="mx-auto w-full max-w-xl px-2 sm:px-0">
            <div className={theme.panel.surface}>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Rapid Blitz</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">60 seconds of mixed challenges</p>

              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-800/60">
                <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Mode: Mixed (all 6 types)</div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                  <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Best Score</div>
                  <div className="mt-1 text-2xl font-bold text-blue-600">{bestScore}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                  <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Score</div>
                  <div className="mt-1 text-2xl font-bold text-emerald-600">{score}</div>
                </div>
              </div>

              {challenges.length === 0 ? (
                <p className="mt-6 rounded-xl bg-amber-50 p-3 text-center text-sm font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  Loading questions… connect to the internet once to populate them.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={startGame}
                  className={`${theme.button.primary} mt-6 w-full text-lg`}
                >
                  ⚡ Start Blitz
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Mode selector version (for /rapid-blitz from practice tools)
    return (
      <div className={theme.page.container}>
        <div className="mx-auto w-full max-w-xl px-2 sm:px-0">
          <div className={theme.panel.surface}>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Rapid Blitz</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">60 seconds with rotating challenges</p>

            <div className="mt-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Choose a mode</h2>
                {selectedMode && (
                  <button type="button" onClick={() => setSelectedMode(null)} className="text-xs text-slate-500 dark:text-slate-400 underline">
                    ← Back to all modes
                  </button>
                )}
              </div>

              {!selectedMode && (
                <div className="space-y-3 mb-4">
                  {/* Mixed card */}
                  <div
                    onClick={() => setSelectedMode(null)}
                    className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 transition-all hover:scale-[1.02] ${MIXED_INFO.bg} border-slate-300`}
                  >
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white dark:bg-slate-800">
                      <MIXED_INFO.icon className={`h-6 w-6 ${MIXED_INFO.color}`} />
                    </div>
                    <div className="flex-1">
                      <span className="block text-lg font-bold text-slate-900 dark:text-white">Mixed Challenge</span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">All 6 types shuffled</span>
                    </div>
                  </div>

                  {CHALLENGE_MODES.map((mode) => {
                    const info = MODE_INFO[mode.split('-')[0]];
                    const Icon = info.icon;
                    return (
                      <div
                        key={mode}
                        onClick={() => setSelectedMode(mode)}
                        className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 transition-all hover:scale-[1.02] ${
                          selectedMode === mode ? 'border-orange-500 ring-2 ring-orange-400' : 'border-slate-300 dark:border-slate-600'
                        } ${info.bg}`}
                      >
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white dark:bg-slate-800">
                          <Icon className={`h-6 w-6 ${info.color}`} />
                        </div>
                        <div className="flex-1">
                          <span className="block text-lg font-bold text-slate-900 dark:text-white">{info.title}</span>
                          <span className="text-sm text-slate-500 dark:text-slate-400">{info.description}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedMode && (
                <div className={`mb-4 flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 ${modeLabel.bg} border-slate-300`}>
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white dark:bg-slate-800">
                    <modeLabel.icon className={`h-6 w-6 ${modeLabel.color}`} />
                  </div>
                  <div className="flex-1">
                    <span className="block text-lg font-bold text-slate-900 dark:text-white">{modeLabel.title}</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{modeLabel.description}</span>
                  </div>
                </div>
              )}

              {/* Score / Best */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                  <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Best Score</div>
                  <div className="mt-1 text-2xl font-bold text-blue-600">{bestScore}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                  <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Score</div>
                  <div className="mt-1 text-2xl font-bold text-emerald-600">{score}</div>
                </div>
              </div>

              {challenges.length === 0 ? (
                <p className="mt-6 rounded-xl bg-amber-50 p-3 text-center text-sm font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  Loading questions… connect to the internet once to populate them.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={startGame}
                  className={`${theme.button.primary} mt-6 w-full text-lg`}
                >
                  ⚡ Start Blitz
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Pre-round / section info (timer paused until the player proceeds) ──
  // The banner shows the mode title, a short description, and a how-to-play
  // example.  The timer is NOT running during this phase — it only starts
  // once the player clicks "Continue" (which transitions to the countdown).
  if (status === 'preRound' || status === 'sectionInfo') {
    // For sectionInfo (mixed mode), show the current section's challenge type.
    const activeType = selectedMode || currentSectionType || undefined;
    const info: ModeInfo = activeType ? MODE_INFO[activeType.split('-')[0]] : MIXED_INFO;
    const Icon = info.icon;
    const instructions = activeType ? MODE_INSTRUCTIONS[activeType] : MIXED_INSTRUCTIONS;
    const isSectionInfo = status === 'sectionInfo';

    return (
      <div className={theme.page.container}>
        <div className="mx-auto w-full max-w-xl px-2 sm:px-0">
          <div className={theme.panel.surface}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Rapid Blitz</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">60 seconds of rotating challenges</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white dark:bg-slate-800">
                <Icon className={`h-6 w-6 ${info.color}`} />
              </div>
            </div>

            {/* Mode title + description */}
            <div className="mb-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                {isSectionInfo
                  ? `Section ${currentSection}/${totalSections} — ${info.title}`
                  : selectedMode
                    ? `${info.title} — ${info.description}`
                    : 'Mixed Challenge — all 6 types shuffled'}
              </div>
              <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{info.title}</div>
            </div>

            {/* How-to-play instructions with example */}
            <div className="mx-auto mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-left dark:border-blue-800 dark:bg-blue-950/40">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {instructions.do}
              </div>
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {instructions.example}
              </div>
            </div>

            {/* Timer is paused here — Continue starts the countdown + timer */}
            {challenges.length === 0 ? (
              <p className="mt-6 rounded-xl bg-amber-50 p-3 text-center text-sm font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                Loading questions… connect to the internet once to populate them.
              </p>
            ) : (
              <button
                type="button"
                onClick={continuePreRound}
                className={`${theme.button.primary} w-full text-lg`}
              >
                {isSectionInfo ? `▶ Continue — Section ${currentSection}` : selectedMode ? `⚡ Start ${info.title}` : '⚡ Start Blitz (Mixed)'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Countdown state (3→2→1→GO!) ───────────────────────────────
  if (status === 'countdown') {
    return (
      <div className={theme.page.container}>
        <div className="mx-auto flex min-h-[80vh] w-full max-w-xl items-center justify-center px-2 sm:px-0">
          <div className="text-center">
            <GetReadyCountdown
              onDone={startPlaying}
              title={selectedMode ? modeLabel.title : 'Mixed Challenge'}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Playing state ─────────────────────────────────────────────
  if (status === 'playing') {
    const comboActive = combo >= 3;
    const timeColor = secondsLeft <= 10 ? 'text-red-500' : 'text-slate-700 dark:text-slate-200';

    return (
      <div className={theme.page.container}>
        <div className="mx-auto w-full max-w-xl px-2 sm:px-0">
          <div className={theme.panel.surface}>
            {/* Timer bar */}
            <div className="mb-4">
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Time</span>
                <span className={timeColor}>{secondsLeft}s</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-1000" style={{ width: `${(secondsLeft / 60) * 100}%` }} />
              </div>
            </div>

            {/* HUD */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
              <span className="text-slate-700 dark:text-slate-200">Score: <span className="text-blue-600">{score}</span></span>
              <span className="text-slate-700 dark:text-slate-200">Accuracy: <span className="text-amber-600">{accuracy}%</span></span>
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold ${comboActive ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                🔥 {combo}x Combo · {multiplier}×
              </span>
            </div>

            {/* Section + challenge type indicator */}
            <div className="mb-4 flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                {currentChallenge?.type || 'Unknown'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Section {currentSection}/{totalSections} · {currentIndex + 1}/{challenges.length}
              </span>
            </div>

            {/* Challenge view */}
            <ChallengeView challenge={currentChallenge} locked={locked} onAnswer={answer} onAnswerSpeech={answerSpeech} />

            {/* Skip button */}
            <button type="button" onClick={skip} className={`${theme.button.secondary} mt-4 w-full`}>⏭ Skip</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Finished state with answer review ────────────────────────
  return (
    <div className={theme.page.container}>
      <div className={theme.modal.overlay}>
        <div className={theme.modal.dialog}>
          <div className="text-center">
            <div className="text-4xl font-extrabold text-slate-900 dark:text-white">
              {selectedMode ? `${modeLabel.title} Complete!` : 'Blitz Complete!'}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/40">
              <div className="text-xs uppercase tracking-wider text-slate-500">Score</div>
              <div className="mt-1 text-2xl font-bold text-blue-600">{score}</div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
              <div className="text-xs uppercase tracking-wider text-slate-500">Accuracy</div>
              <div className="mt-1 text-2xl font-bold text-emerald-600">{accuracy}%</div>
            </div>
          </div>

          {/* Answer review summary */}
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Answer Review</h3>
            <div className="max-h-60 space-y-2 overflow-y-auto">
              {history.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No answers recorded.</p>
              ) : (
                history.map((record, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg border p-3 text-xs ${
                      record.isCorrect
                        ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/40'
                        : 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {record.round !== undefined ? `Q${record.round}.${idx + 1}` : `Q${idx + 1}`}: {getChallengeQuestion(record.challenge)}
                      </span>
                      <span className={record.isCorrect ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}>
                        {record.isCorrect ? '✓ Correct' : '✗ Wrong'}
                      </span>
                    </div>
                    <div className="mt-1 space-y-1">
                      <div className="text-slate-600 dark:text-slate-400">Your answer: <span className="font-medium">{record.userAnswer}</span></div>
                      {!record.isCorrect && (
                        <div className="text-emerald-700 dark:text-emerald-300">Correct answer: <span className="font-medium">{record.correctAnswer}</span></div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <button type="button" onClick={startGame} className={theme.button.primary}>Play Again</button>
            <Link to="/practice" className={`${theme.button.secondary} text-center`}>Back to Practice</Link>
          </div>
        </div>
      </div>
    </div>
  );
}