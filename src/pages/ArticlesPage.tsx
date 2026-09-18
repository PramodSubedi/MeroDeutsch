import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sharedTextDatabase, sharedTranslations } from '../data/sharedContent';
import { speakText, speakWord } from '../hooks/useSpeech';
import { useLang } from '../hooks/useLang';
import { useTranslation } from '../hooks/useTranslation';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { useXp } from '../hooks/useXp';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useDailyQuests } from '../hooks/useDailyQuests';
import { useArticleRecorder } from '../hooks/useArticleRecorder';
import { theme } from '../config/theme';
import { curriculumService } from '../services';
import { CompactAudioButton } from '../components/CompactAudioButton';
import { GenderLegend } from '../components/ui/GenderBadge';
import { MatchPairs, type MatchPair } from '../components/exercises/MatchPairs';
import { GENDER_PRONOUNS } from '../data/genderPronouns';
import { pickRandom } from '../utils/questionGenerator';
import { getHint } from '../data/hints';
import type { ArticleItem } from '../types';


function formatTime(seconds: number) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

/** Short Web Audio success/error beep (no asset pipeline needed). */
function playBeep(success: boolean) {
  if (typeof window === 'undefined' || !window.AudioContext) return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = success ? 'sine' : 'square';
  osc.frequency.value = success ? 660 : 220;
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
  osc.start();
  osc.stop(ctx.currentTime + 0.25);
  osc.onended = () => ctx.close();
}

export function ArticlesPage() {
  const { langMode } = useLang();
  const { isDE, t } = useTranslation(langMode);
  const { quests, reportAccuracy, claimReward } = useDailyQuests();
  const [mode, setMode] = useState<'learn' | 'quiz' | 'pronouns'>('quiz');
  const [articlesData, setArticlesData] = useState<ArticleItem[]>([]);
  const [currentItem, setCurrentItem] = useState<ArticleItem | null>(null);
  const [articleScore, setArticleScore] = useState(0);
  const [articleTotal, setArticleTotal] = useState(0);

  useEffect(() => {
    curriculumService
      .getArticles()
      .then((data) => {
        // Dynamic + offline-first: RPC -> table SELECT -> Dexie cache.
        // No bundled JSON fallback — an empty pool renders a friendly state.
        setArticlesData(data);
        if (data.length > 0) setCurrentItem(pickRandom(data));
      })
      .catch(() => {
        setArticlesData([]);
        setCurrentItem(null);
      });
  }, []);

  // Report Accuracy Master quest on quiz completion (no auto-play).
  // Auto-play was causing premature audio before user opened quiz.
  // User can click CompactAudioButton to hear noun, or Full Phrase for article + noun.
  useEffect(() => {
    if (!currentItem || mode !== 'quiz') return;
    // Only report accuracy, don't auto-play
    reportAccuracy(articleTotal > 0 ? articleScore / articleTotal : 0.5);
  }, [currentItem, mode, articleScore, articleTotal, reportAccuracy]);

  // Claim any completed-but-unclaimed daily quest rewards.
  useEffect(() => {
    const completed = quests.find((q) => q.completed && !q.claimed);
    if (completed) {
      claimReward(completed.id);
    }
  }, [quests, claimReward]);

  const [feedback, setFeedback] = useState('');
  const [hint, setHint] = useState<{ en: string; ne: string; de: string } | null>(null);
  const [locked, setLocked] = useState(false);
  const [lastChoice, setLastChoice] = useState<'der' | 'die' | 'das' | null>(null);
  const { supported, status, start, stop } = useSpeechRecognition({
    lang: 'de-DE',
    onResult: (transcript) => {
      evaluateSpeech(transcript);
      recorderControlsRef.current?.stopRecording();
    },
    onError: (message) => {
      recorderControlsRef.current?.setMessage(message);
      addWrongAnswer({
        moduleType: 'articles',
        itemKey: targetPhrase,
        userAnswer: message,
        correctAnswer: targetPhrase,
      });
      recorderControlsRef.current?.stopRecording();
    },
  });

  // Ref bridge: the recorder hook is constructed below, but the speech
  // callbacks above may fire before it exists on this render. Calling
  // through the ref keeps Web Speech + MediaRecorder lifecycle in sync.
  const [recorderState, recorderControls] = useArticleRecorder({
    speechSupported: supported,
    stopSpeech: stop,
    startSpeech: start,
    isDE,
  });
  const recorderControlsRef = useRef(recorderControls);
  recorderControlsRef.current = recorderControls;

  const {
    recording,
    recordingTime,
    audioUrl,
    audioSupported,
    speechMessage,
  } = recorderState;
  const { canvasRef, startRecording, stopRecording, restartRecording, resetRecording } =
    recorderControls;

  const targetPhrase = useMemo(
    () => (currentItem ? `${currentItem.art} ${currentItem.noun}` : ''),
    [currentItem]
  );

  const nextItem = useCallback(() => {
    if (articlesData.length > 0) {
      setCurrentItem((prev: ArticleItem | null) => {
        if (!prev) return pickRandom(articlesData);
        return pickRandom(articlesData, (item) => item.noun === prev.noun);
      });
      setFeedback('');
      setHint(null);
      setLocked(false);
      setLastChoice(null);
      resetRecording();
    }
  }, [articlesData, resetRecording]);

  const evaluateSpeech = (spoken: string) => {
    const normalized = spoken.toLowerCase().trim();
    const target = targetPhrase.toLowerCase();
    const words = normalized.split(' ').filter(Boolean);

    if (normalized === target) {
      setFeedback(isDE ? `✅ Sehr gut! ${targetPhrase}` : `✅ Excellent! ${targetPhrase}`);
      setArticleScore((score) => score + 1);
      // +10 XP for a fully correct spoken article phrase
      reportAnswer({ correct: true, module: 'articles' });
    } else if (currentItem && words[0] === currentItem.art && words.length === 1) {
      setFeedback(
        isDE
          ? `👍 Richtig! Sage jetzt: ${targetPhrase}`
          : `👍 Correct article! Now say: ${targetPhrase}`
      );
    } else if (currentItem && words.includes(currentItem.noun.toLowerCase()) && words[0] !== currentItem.art) {
      setFeedback(
        isDE
          ? `❌ Falsch. Der richtige Artikel ist: ${targetPhrase}`
          : `❌ Wrong. Correct: ${targetPhrase}`
      );
    } else {
      setFeedback(
        isDE
          ? `❌ Nicht ganz. Sage: ${targetPhrase}`
          : `❌ Not quite. Say: ${targetPhrase}`
      );
    }
    setLocked(true);
    setArticleTotal((total) => total + 1);
  };

  const { addWrongAnswer } = useReviewQueue();
  const { reportAnswer } = useXp();

  const checkArticle = (choice: 'der' | 'die' | 'das') => {
    if (locked || !currentItem) return;
    const correct = choice === currentItem.art;
    setLocked(true);
    setLastChoice(choice);
    setArticleTotal((total) => total + 1);
    playBeep(correct);
    if (correct) {
      setArticleScore((score) => score + 1);
      setFeedback(isDE ? '🎉 Richtig! ' + targetPhrase : '🎉 Correct! ' + targetPhrase);
      // +10 XP for a correct article answer
      reportAnswer({ correct: true, module: 'articles' });
    } else {
      setFeedback(
        isDE
          ? `❌ Falsch! Es ist ${targetPhrase}`
          : `❌ Wrong! It is ${targetPhrase}`
      );
      // U4 micro-hint — one short teaching line (EN + NE), hidden in Nur DE.
      setHint(getHint('articles', 'wrong-article'));
      addWrongAnswer({
        moduleType: 'articles',
        itemKey: targetPhrase,
        userAnswer: `${choice} ${currentItem.noun}`,
        correctAnswer: targetPhrase,
      });
    }
    speakWord(targetPhrase);
  };


  const recorderEnabled = audioSupported || supported;
  const recorderModeHint = !audioSupported && supported
    ? isDE
      ? 'Nur Spracherkennung aktiv.'
      : 'Speech recognition only.'
    : !supported && audioSupported
    ? isDE
      ? 'Nur Audioaufnahme aktiv.'
      : 'Audio recording only.'
    : '';

  const articlePercent = articleTotal ? Math.round((articleScore / articleTotal) * 100) : 0;

  // Gender → pronoun matching pairs (first 8 hand-verified person nouns;
  // right column = the matching personal pronoun er/sie/es).
  const pronounPairs = useMemo<MatchPair[]>(
    () =>
      GENDER_PRONOUNS.slice(0, 8).map((p) => ({
        id: p.noun,
        de: `${p.article} ${p.noun}`,
        en: p.pronoun,
      })),
    []
  );

  const title = isDE ? 'Der, Die, Das' : sharedTextDatabase.articles.title;
  const description = isDE
    ? 'Lerne deutsche Substantive zusammen with ihrem Artikel.'
    : sharedTextDatabase.articles.description;

  return (
    <div className={theme.page.container}>

      <div className={theme.panel.surface}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="mt-2 text-sm text-slate-500">{description}</p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            {/* Mode Toggle: Learn vs Quiz */}
            <div className="flex gap-2 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setMode('learn')}
                className={`px-4 py-2 rounded-full font-semibold text-sm transition-all ${
                  mode === 'learn'
                    ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-300'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {isDE ? '📚 Lernen' : '📚 Learn'}
              </button>
              <button
                type="button"
                onClick={() => setMode('quiz')}
                className={`px-4 py-2 rounded-full font-semibold text-sm transition-all ${
                  mode === 'quiz'
                    ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-300'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {isDE ? '⚡ Quiz' : '⚡ Quiz'}
              </button>
              <button
                type="button"
                onClick={() => setMode('pronouns')}
                className={`px-4 py-2 rounded-full font-semibold text-sm transition-all ${
                  mode === 'pronouns'
                    ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-300'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {isDE ? '🔤 Pronomen' : '🔤 Pronouns'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* LEARN MODE: Study materials and rules */}
      {mode === 'learn' && (
        <div className="mb-4 grid gap-4 lg:grid-cols-3">
          <div className={theme.panel.accent}>
            <div className="mb-2 text-sm font-semibold text-blue-700 dark:text-blue-300">DER</div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">Masculine</div>
            <div className="mt-3 text-sm text-slate-700 dark:text-slate-300">{isDE ? 'पुलिङ्ग' : 'Masculine'}</div>
            <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              <div>Days, months, seasons, compass points.</div>
              <div>der Mann</div>
              <div>der Tag</div>
            </div>
          </div>
          <div className={theme.panel.accent}>
            <div className="mb-2 text-sm font-semibold text-red-700 dark:text-red-300">DIE</div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">Feminine</div>
            <div className="mt-3 text-sm text-slate-700 dark:text-slate-300">{isDE ? 'स्त्रीलिङ्ग' : 'Feminine'}</div>
            <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              <div>-ung, -heit, -keit, -schaft, -e</div>
              <div>die Frau</div>
              <div>die Zeitung</div>
            </div>
          </div>
          <div className={theme.panel.accent}>
            <div className="mb-2 text-sm font-semibold text-green-700 dark:text-green-300">DAS</div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">Neuter</div>
            <div className="mt-3 text-sm text-slate-700 dark:text-slate-300">{isDE ? 'नपुंसकलिङ्ग' : 'Neuter'}</div>
            <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              <div>-chen, -lein, -ment, -um</div>
              <div>das Kind</div>
              <div>das Mädchen</div>
            </div>
          </div>
        </div>
      )}

      {/* PRONOUNS MODE: gender → personal pronoun matching (der → er …) */}
      {mode === 'pronouns' && (
        <div className="mx-auto max-w-lg space-y-4">
          <p className="text-center text-sm text-slate-600 dark:text-slate-300">
            {isDE
              ? 'der → er · die → sie · das → es — das Pronomen folgt dem Genus.'
              : 'der → er · die → sie · das → es — the pronoun follows the gender.'}
          </p>
          <MatchPairs
            pairs={pronounPairs}
            module="articles"
            speakOnMatch={false}
            columnLabels={{ left: isDE ? 'Nomen' : 'Noun', right: isDE ? 'Pronomen' : 'Pronoun' }}
          />
        </div>
      )}

      {/* QUIZ MODE: Interactive trainer */}
      {mode === 'quiz' && !currentItem && (
        <div className={theme.page.container}>
          <div className="text-center text-slate-500 dark:text-slate-400">
            {isDE ? 'Wörter werden geladen…' : 'Loading words...'}
          </div>
        </div>
      )}

      {mode === 'quiz' && currentItem && (
        <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <div className={theme.panel.surface}>
          <div className="mb-4 text-sm uppercase tracking-wider text-slate-500">{isDE ? 'Trainer' : 'Trainer'}</div>
          <div className={`${theme.panel.muted} text-center`}> 
            <div className="flex items-center justify-center gap-3">
              <div className="text-4xl font-bold text-slate-900 dark:text-white">{currentItem.noun}</div>
              <CompactAudioButton 
                word={currentItem.noun}
                ariaLabel={`Hear pronunciation of ${currentItem.noun}`}
              />
            </div>
            <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{currentItem.meaning}</div>
            {currentItem.sentence && (
              <div className="mt-3 flex flex-col items-center gap-2">
                {/* Hide article in displayed sentence to prevent spoiling the answer */}
                <div className="text-base font-medium text-blue-700 dark:text-blue-300">
                  {currentItem.sentence.replace(
                    new RegExp(`^(${['der', 'die', 'das'].join('|')})\\s`, 'i'),
                    '_____ '
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => speakText(currentItem.sentence as string, 0.85)}
                  className={theme.button.icon}
                  aria-label="Speak sentence"
                >
                  🔊 {isDE ? 'Satz' : 'Sentence'}
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => speakWord(targetPhrase)}
              className={`${theme.button.primary} flex-1 min-w-[140px]`}
              title="Hear the article + noun together (e.g., 'der Tisch')"
            >
              🔊 {isDE ? 'Vollständig hören' : 'Full Phrase'}
            </button>
            <button
              type="button"
              onClick={startRecording}
              disabled={!recorderEnabled || recording}
              className={`${theme.button.primary} flex-1 min-w-[140px] disabled:opacity-50`}
            >
              🎤 {recording ? (isDE ? 'Aufnahme läuft…' : 'Recording…') : t(sharedTranslations.common.speak)}
            </button>
          </div>

          <div className={theme.panel.muted}>
            <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-200">
              <span>{isDE ? 'Recorder' : 'Recorder'}</span>
              <span>{formatTime(recordingTime)}</span>
            </div>
            <div className="mb-3 h-16 overflow-hidden rounded-2xl bg-white text-center dark:bg-slate-800">
              <canvas ref={canvasRef} width={320} height={64} className="w-full h-full" />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={startRecording}
                disabled={!recorderEnabled || recording}
                className={`${theme.button.primary} flex-1 min-w-[140px] disabled:opacity-50`}
              >
                🎙 {recording ? (isDE ? 'Aufnahme läuft…' : 'Recording…') : (isDE ? 'Aufnahme starten' : 'Start recording')}
              </button>
              <button
                type="button"
                onClick={() => stopRecording()}
                disabled={!recording}
                className={`${theme.button.danger} flex-1 min-w-[140px] disabled:opacity-50`}
              >
                ⏹ {t(sharedTranslations.common.stop)}
              </button>
              <button
                type="button"
                onClick={restartRecording}
                disabled={recording}
                className={`${theme.button.secondary} flex-1 min-w-[140px] disabled:opacity-50`}
              >
                ↻ {t(sharedTranslations.common.startOver)}
              </button>
            </div>
            {audioUrl && (
              <audio controls src={audioUrl} className="mt-4 w-full rounded-2xl bg-white p-2 dark:bg-slate-800" />
            )}
            <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              {speechMessage || status}
              {recorderModeHint && <span className="block mt-1 font-medium text-slate-600 dark:text-slate-300">{recorderModeHint}</span>}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {(['der', 'die', 'das'] as const).map((choice) => {
              // Global gender color tokens: der=blue, die=red, das=green.
              const buttonClass = `${theme.gender[choice === 'die' ? 'dieF' : choice].bg} text-white`;
              const selected = choice === lastChoice;
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => checkArticle(choice)}
                  disabled={locked}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm transition disabled:opacity-50 ${buttonClass} ${selected ? 'ring-4 ring-white/60' : ''}`}
                >
                  {choice.toUpperCase()}
                </button>
              );
            })}
          </div>

          {/* Gender color legend — global tokens: der=blue, die=red, das=green, Pl=amber */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <span className={`h-2.5 w-2.5 rounded-full ${theme.gender.der.bg}`} aria-hidden="true" />
              der
            </span>
            <span className="inline-flex items-center gap-1">
              <span className={`h-2.5 w-2.5 rounded-full ${theme.gender.dieF.bg}`} aria-hidden="true" />
              die
            </span>
            <span className="inline-flex items-center gap-1">
              <span className={`h-2.5 w-2.5 rounded-full ${theme.gender.das.bg}`} aria-hidden="true" />
              das
            </span>
            <span className="inline-flex items-center gap-1">
              <span className={`h-2.5 w-2.5 rounded-full ${theme.gender.diePl.bg}`} aria-hidden="true" />
              {isDE ? 'Pl.' : 'Plural'}
            </span>
          </div>

          {feedback && (
            <div className={theme.panel.tip}>
              {feedback}
              {hint && (
                <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  {isDE ? hint.de : (
                    <>
                      <div>{hint.en}</div>
                      <div className="mt-0.5 text-slate-500 dark:text-slate-400">{hint.ne}</div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={nextItem}
            className={`${theme.button.secondary} mt-4 w-full`}
          >
            {isDE ? 'Nächstes Wort →' : 'Next Word →'}
          </button>
        </div>

        <div className={theme.panel.surface}>
          <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
            <div>{isDE ? 'Lehrplan' : 'Learning stats'}</div>
            <div>
              {isDE ? 'Punkte: ' : 'Score: '} {articleScore} / {articleTotal}
            </div>
            <div>{isDE ? 'Trefferquote: ' : 'Accuracy: '} {articlePercent}%</div>
          </div>          
          {/* Gender Legend Reference */}
          <div className={theme.panel.muted + ' rounded-xl p-3 mt-4'}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              {isDE ? 'Gender' : 'Genders'}
            </div>
            <GenderLegend />
          </div>
                    <div className={theme.panel.tip}>
            <p className="font-semibold">{isDE ? 'Tipp' : 'Tip'}:</p>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              {isDE
                ? 'Sprich den Artikel zusammen mit dem Nomen: „der Tisch“, „die Sonne“, „das Buch“. '
                : 'Speak the article together with the noun: “der Tisch”, “die Sonne”, “das Buch”.'}
            </p>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
