import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sharedTextDatabase, sharedTranslations } from '../data/sharedContent';
import { speakText, speakWord } from '../hooks/useSpeech';
import { useLang } from '../hooks/useLang';
import { useTranslation } from '../hooks/useTranslation';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { theme } from '../config/theme';
import { curriculumService } from '../services';
import type { ArticleItem } from '../types/curriculum';

function randomArticleItem(pool: ArticleItem[], previous: string | null) {
  const filtered = pool.filter((item) => item.noun !== previous);
  return filtered[Math.floor(Math.random() * filtered.length)];
}


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
  const [articlesData, setArticlesData] = useState<ArticleItem[]>([]);
  const [currentItem, setCurrentItem] = useState<ArticleItem | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    curriculumService.getArticles().then(data => {
      setArticlesData(data);
      setCurrentItem(randomArticleItem(data, null));
    });
  }, []);

  const [articleScore, setArticleScore] = useState(0);
  const [articleTotal, setArticleTotal] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [locked, setLocked] = useState(false);
  const [lastChoice, setLastChoice] = useState<'der' | 'die' | 'das' | null>(null);
  const [speechMessage, setSpeechMessage] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recording, setRecording] = useState(false);
  const [audioSupported, setAudioSupported] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerRef = useRef<number | null>(null);

  const { supported, status, start, stop } = useSpeechRecognition({
    lang: 'de-DE',
    onResult: (transcript) => {
      evaluateSpeech(transcript);
      stopRecording();
    },
    onError: (message) => {
      setSpeechMessage(message);
      addWrongAnswer({
        moduleType: 'articles',
        itemKey: targetPhrase,
        userAnswer: message,
        correctAnswer: targetPhrase,
      });
      stopRecording();
    },
  });

    const targetPhrase = useMemo(
    () => currentItem ? `${currentItem.art} ${currentItem.noun}` : '',
    [currentItem]
  );


  const stopRecording = useCallback(
    (force = false) => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecording(false);
      if (!force) {
        if (supported) {
          stop();
        }
        if (!supported && audioSupported) {
          setSpeechMessage(
            isDE
              ? 'Spracherkennung nicht verfügbar. Nur Audioaufnahme gespeichert.'
              : 'Speech recognition unavailable. Audio recording saved only.'
          );
        } else {
          setSpeechMessage(isDE ? 'Aufnahme gestoppt.' : 'Recording stopped.');
        }
      }
    },
    [audioSupported, isDE, sharedTranslations, stop, supported]
  );

  useEffect(() => {
    setAudioSupported(
      typeof window !== 'undefined' &&
        !!window.MediaRecorder &&
        !!(window.AudioContext || (window as any).webkitAudioContext)
    );
    return () => {
      stopRecording(true);
    };
  }, [stopRecording]);

  useEffect(() => {
    if (!recording) {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [recording]);

    const nextItem = useCallback(() => {
    if (articlesData.length > 0) {
      setCurrentItem((prev: ArticleItem | null) => {
        if (!prev) return randomArticleItem(articlesData, null);
        return randomArticleItem(articlesData, prev.noun);
      });
      setFeedback('');
      setLocked(false);
      setLastChoice(null);
      setSpeechMessage('');
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
    }
  }, [audioUrl, articlesData]);


  const evaluateSpeech = (spoken: string) => {
    const normalized = spoken.toLowerCase().trim();
    const target = targetPhrase.toLowerCase();
    const words = normalized.split(' ').filter(Boolean);

    if (normalized === target) {
      setFeedback(isDE ? `✅ Sehr gut! ${targetPhrase}` : `✅ Excellent! ${targetPhrase}`);
      setArticleScore((score) => score + 1);
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
    } else {
      setFeedback(
        isDE
          ? `❌ Falsch! Es ist ${targetPhrase}`
          : `❌ Wrong! It is ${targetPhrase}`
      );
      addWrongAnswer({
        moduleType: 'articles',
        itemKey: targetPhrase,
        userAnswer: `${choice} ${currentItem.noun}`,
        correctAnswer: targetPhrase,
      });
    }
    speakWord(targetPhrase);
  };

  const startRecording = useCallback(async () => {
    if (recording) return;

    if (!supported && !audioSupported) {
      setSpeechMessage(
        isDE
          ? 'Spracherkennung und Audioaufnahme werden hier nicht unterstützt.'
          : 'Speech recognition and audio recording are not supported in this browser.'
      );
      return;
    }

    if (!supported && audioSupported) {
      setSpeechMessage(
        isDE
          ? 'Spracherkennung nicht verfügbar. Nur Audioaufnahme ist möglich.'
          : 'Speech recognition unavailable. Audio recording only.'
      );
    }

    if (supported && !audioSupported) {
      setSpeechMessage(
        isDE
          ? 'Spracherkennung aktiv. Sprich jetzt.'
          : 'Speech recognition active. Speak now.'
      );
    }

    const shouldRecordAudio = audioSupported && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

    if (audioSupported && !shouldRecordAudio) {
      setSpeechMessage(
        isDE
          ? 'Audioaufnahme ist nicht verfügbar. Bitte überprüfe deine Browser-Einstellungen.'
          : 'Audio recording is unavailable. Please check your browser settings.'
      );
      return;
    }

    try {
      let stream: MediaStream | null = null;

      if (shouldRecordAudio) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        audioChunksRef.current = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        recorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
          }
          setAudioUrl(URL.createObjectURL(blob));
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
      }

      setRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordingTime((time) => time + 1);
      }, 1000);

      if (supported) {
        start();
      }

      if (stream) {
        startVisualizer(stream);
      }
    } catch (error) {
      setSpeechMessage(
        isDE
          ? 'Mikrofonberechtigung verweigert oder ein Fehler ist aufgetreten.'
          : 'Microphone permission denied or an error occurred.'
      );
    }
  }, [audioSupported, audioUrl, isDE, recording, start, supported]);

  const restartRecording = async () => {
    stopRecording(true);
    setAudioUrl(null);
    setRecordingTime(0);
    await startRecording();
  };

  const startVisualizer = (stream: MediaStream) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioContext;
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyserRef.current = analyser;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!analyserRef.current || !canvasRef.current) return;
      analyserRef.current.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i += 1) {
        const value = dataArray[i] - 128;
        sum += value * value;
      }
      const rms = Math.sqrt(sum / bufferLength) / 128;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.85)';
      const barWidth = width / 28;
      for (let i = 0; i < 28; i += 1) {
        const level = rms * (0.4 + 0.6 * (1 - Math.abs(i / 14 - 1)));
        const barHeight = Math.max(2, level * height);
        const x = i * barWidth;
        const y = height - barHeight;
        ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
      }
      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);
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

  const title = isDE ? 'Der, Die, Das' : sharedTextDatabase.articles.title;
  const description = isDE
    ? 'Lerne deutsche Substantive zusammen with ihrem Artikel.'
    : sharedTextDatabase.articles.description;

  if (!currentItem) return <div className={theme.page.container}>Loading...</div>;

  return (
    <div className={theme.page.container}>

      <div className={theme.panel.surface}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="mt-2 text-sm text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={() => setGuideOpen((open) => !open)}
            className={theme.button.secondary}
          >
            {isDE ? '💡 Schnellhilfe' : '💡 Quick Guide'} {guideOpen ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {guideOpen && (
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
            <div className="mb-2 text-sm font-semibold text-pink-700 dark:text-pink-300">DIE</div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">Feminine</div>
            <div className="mt-3 text-sm text-slate-700 dark:text-slate-300">{isDE ? 'स्त्रीलिङ्ग' : 'Feminine'}</div>
            <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              <div>-ung, -heit, -keit, -schaft, -e</div>
              <div>die Frau</div>
              <div>die Zeitung</div>
            </div>
          </div>
          <div className={theme.panel.accent}>
            <div className="mb-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">DAS</div>
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

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <div className={theme.panel.surface}>
          <div className="mb-4 text-sm uppercase tracking-wider text-slate-500">{isDE ? 'Trainer' : 'Trainer'}</div>
          <div className={`${theme.panel.muted} text-center`}> 
            <div className="text-4xl font-bold text-slate-900 dark:text-white">{currentItem.noun}</div>
            <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{currentItem.meaning}</div>
            {currentItem.sentence && (
              <div className="mt-3 flex flex-col items-center gap-2">
                <div className="text-base font-medium text-blue-700 dark:text-blue-300">{currentItem.sentence}</div>
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
            >
              🔊 {t(sharedTranslations.common.hear)}
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
              const buttonClass =
                choice === 'der'
                  ? 'bg-blue-600 text-white'
                  : choice === 'die'
                  ? 'bg-pink-600 text-white'
                  : 'bg-emerald-600 text-white';
              const selected = choice === lastChoice;
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => checkArticle(choice)}
                  disabled={locked}
                  className={`rounded-3xl px-4 py-3 text-sm font-semibold shadow-sm transition disabled:opacity-50 ${buttonClass} ${selected ? 'ring-4 ring-white/60' : ''}`}
                >
                  {choice.toUpperCase()}
                </button>
              );
            })}
          </div>

          {feedback && (
            <div className={theme.panel.tip}>
              {feedback}
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
    </div>
  );
}
