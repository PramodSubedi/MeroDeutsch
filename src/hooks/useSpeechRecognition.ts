import { useCallback, useEffect, useRef, useState } from 'react';

interface UseSpeechRecognitionOptions {
  lang?: string;
  onResult?: (transcript: string) => void;
  onError?: (message: string) => void;
}

function getSpeechRecognitionConstructor(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported(): boolean {
  return !!getSpeechRecognitionConstructor();
}

export function useSpeechRecognition({ lang = 'de-DE', onResult, onError }: UseSpeechRecognitionOptions = {}) {
  const [supported, setSupported] = useState<boolean>(() => isSpeechRecognitionSupported());
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState<string>(() =>
    supported ? 'Ready to listen.' : 'Speech recognition is not supported in this browser.'
  );
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setSupported(!!getSpeechRecognitionConstructor());
  }, []);

  useEffect(
    () => () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    },
    []
  );

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.abort();
    } catch {
      // ignore
    }
    setListening(false);
    setStatus('Stopped.');
  }, []);

  const start = useCallback(() => {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setSupported(false);
      setStatus('Speech recognition is not supported in this browser.');
      onError?.('Speech recognition is not supported in this browser.');
      return;
    }

    if (listening) return;

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setStatus('Listening...');
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.toString() || '';
      if (transcript) {
        onResult?.(transcript.trim());
      }
    };

    recognition.onerror = (event: any) => {
      const message = event.error === 'no-speech'
        ? 'No speech was detected. Try again.'
        : event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? 'Microphone permission was denied.'
        : 'Speech recognition error. Please try again.';
      setStatus(message);
      setListening(false);
      onError?.(message);
    };

    recognition.onend = () => {
      setListening(false);
      setStatus('Ready to listen.');
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setStatus('Could not start speech recognition.');
      setListening(false);
      onError?.('Could not start speech recognition.');
    }
  }, [lang, listening, onError, onResult]);

  return { supported, listening, status, start, stop };
}
