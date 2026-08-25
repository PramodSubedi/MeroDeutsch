/**
 * useArticleRecorder — extracted from ArticlesPage.
 *
 * Owns the MediaRecorder + AnalyserNode canvas visualizer + recording timer
 * lifecycle so the page no longer juggles 11 refs + 5 record states inline.
 *
 * Behavior-preserving: identical audio/webm recording path, identical RMS bar
 * visualizer (brand blue #2563eb — canvas cannot read CSS vars), identical
 * recording-time tick. Web Speech start/stop is delegated back to the caller
 * via `startSpeech` / `stopSpeech` so the recognition session stays the
 * single source of truth.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface ArticleRecorderState {
  recording: boolean;
  recordingTime: number;
  audioUrl: string | null;
  audioSupported: boolean;
  speechMessage: string;
}

export interface ArticleRecorderControls {
  startRecording: () => Promise<void>;
  stopRecording: (force?: boolean) => void;
  restartRecording: () => Promise<void>;
  resetRecording: () => void;
  setMessage: (message: string) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export interface ArticleRecorderConfig {
  /** Whether the Web Speech API is available on this browser. */
  speechSupported: boolean;
  /** Stop the speech-recognition session (tears down MediaRecorder too). */
  stopSpeech: () => void;
  /** Start the speech-recognition session when supported. */
  startSpeech?: () => void;
  /** Brand blue for the visualizer bar fill. Canvas can't read CSS vars. */
  visualizerColor?: string;
  isDE: boolean;
}

export function useArticleRecorder(
  config: ArticleRecorderConfig
): [ArticleRecorderState, ArticleRecorderControls] {
  const {
    speechSupported: supported,
    stopSpeech,
    startSpeech,
    visualizerColor = 'rgba(37, 99, 235, 0.85)',
    isDE,
  } = config;

  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioSupported, setAudioSupported] = useState(false);
  const [speechMessage, setSpeechMessage] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerRef = useRef<number | null>(null);

  /** Stop MediaRecorder, stream tracks, audio context, animation frame + timer. */
  const stopRecording = useCallback((force = false) => {
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
        stopSpeech();
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
  }, [audioSupported, isDE, stopSpeech, supported]);

  // Detect MediaRecorder + AudioContext availability on mount; cleanup on unmount.
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

  // Clear recording timer when recording ends.
  useEffect(() => {
    if (!recording && timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [recording]);

  const startVisualizer = useCallback(
    (stream: MediaStream) => {
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
        const { width, height } = canvas;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = visualizerColor;
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
    },
    [visualizerColor]
  );

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
    } else if (supported && !audioSupported) {
      setSpeechMessage(
        isDE ? 'Spracherkennung aktiv. Sprich jetzt.' : 'Speech recognition active. Speak now.'
      );
    }

    const shouldRecordAudio =
      audioSupported && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

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
        recorder.ondataavailable = (event: BlobEvent) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          if (audioUrl) URL.revokeObjectURL(audioUrl);
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

      if (stream) startVisualizer(stream);
      if (supported) startSpeech?.();
    } catch {
      setSpeechMessage(
        isDE
          ? 'Mikrofonberechtigung verweigert oder ein Fehler ist aufgetreten.'
          : 'Microphone permission denied or an error occurred.'
      );
    }
  }, [audioSupported, audioUrl, isDE, recording, supported, startVisualizer, startSpeech]);

  const restartRecording = useCallback(async () => {
    stopRecording(true);
    setAudioUrl(null);
    setRecordingTime(0);
    await startRecording();
  }, [startRecording, stopRecording]);

  /** Stop everything and clear the recorded clip + status used by nextItem. */
  const resetRecording = useCallback(() => {
    stopRecording(true);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setRecordingTime(0);
    setSpeechMessage('');
  }, [audioUrl, stopRecording]);

  const setMessage = useCallback((message: string) => {
    setSpeechMessage(message);
  }, []);

  return [
    { recording, recordingTime, audioUrl, audioSupported, speechMessage },
    { startRecording, stopRecording, restartRecording, resetRecording, setMessage, canvasRef },
  ];
}