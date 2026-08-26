import { useCallback, useEffect, useState } from 'react';
import { getItem, setItem } from '../utils/safeStorage';
import { AUDIO_BY_LEMMA } from '../data/audioManifest';

export type SpeechSpeed = 'slow' | 'normal' | 'fast';

const SPEED_KEY = 'meroDeutschSpeechSpeed';
const SPEED_RATES: Record<SpeechSpeed, number> = {
  slow: 0.6,
  normal: 0.85,
  fast: 1.05,
};

function loadSpeed(): SpeechSpeed {
  const stored = getItem(SPEED_KEY);
  return stored === 'slow' || stored === 'normal' || stored === 'fast' ? stored : 'normal';
}

/**
 * Optional pre-recorded audio fallback.
 * If `public/audio/{id}.mp3` exists, play it; otherwise silently report failure
 * so the caller can fall back to speechSynthesis.
 * This lets us ship a few sample clips without requiring hundreds of MP3s.
 */
function audioFileExists(id: string): Promise<boolean> {
  return new Promise((resolve) => {
    const audio = new Audio(`/audio/${id}.mp3`);
    audio.oncanplaythrough = () => resolve(true);
    audio.onerror = () => resolve(false);
    // Trigger the load so oncanplaythrough/onerror fire.
    audio.load();
  });
}

/** Prefer natural-sounding German voices over robotic defaults. */
function getGermanVoice(): SpeechSynthesisVoice | undefined {
  if (typeof window === 'undefined' || !window.speechSynthesis) return undefined;
  const voices = window.speechSynthesis.getVoices();
  const de = voices.filter((v) => v.lang.toLowerCase().startsWith('de'));
  if (de.length === 0) return undefined;
  const natural = de.find((v) => /natural/i.test(v.name));
  if (natural) return natural;
  const google = de.find((v) => /google/i.test(v.name));
  if (google) return google;
  const female = de.find((v) => /(female|katja|anna|hedda|zira|hazel|susan)/i.test(v.name));
  if (female) return female;
  return de[0];
}

/** Speech synthesis — change only this file for audio behavior */
export function speakText(text: string, rateOverride?: number) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const rate = rateOverride ?? SPEED_RATES[loadSpeed()];
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE';
  u.rate = rate;
  const voice = getGermanVoice();
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}

/** Look up a bundled clip for a German word (case-insensitive lemma match). */
function localAudioFor(text: string): string | null {
  if (!text) return null;
  const key = text.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(AUDIO_BY_LEMMA, key) ? AUDIO_BY_LEMMA[key] : null;
}

/** Play a bundled MP3; on any playback failure, fall back to speechSynthesis. */
function playFile(url: string, fallbackText: string) {
  const audio = new Audio(url);
  audio.onerror = () => speakText(fallbackText);
  audio.play().catch(() => speakText(fallbackText));
}

/** Speak a word, preferring a pre-recorded clip if present, else TTS. */
export async function speakWordWithAudio(id: string, text: string) {
  // 1) Bundled Anki/Thorsten-Voice clips (preferred — natural voice).
  const bundled = localAudioFor(text);
  if (bundled) {
    playFile(bundled, text);
    return;
  }
  // 2) Legacy per-id sample clips.
  const exists = await audioFileExists(id);
  if (!exists) {
    // 3) speechSynthesis fallback.
    speakText(text);
    return;
  }
  const audio = new Audio(`/audio/${id}.mp3`);
  audio.onerror = () => speakText(text);
  audio.play().catch(() => speakText(text));
}

export function speakLetter(text: string) {
  speakText(text, 0.75);
}

export function speakWord(text: string) {
  // Prefer bundled Thorsten-Voice clip (natural voice) before OS TTS.
  const bundled = localAudioFor(text);
  if (bundled) {
    playFile(bundled, text);
    return;
  }
  speakText(text);
}

/**
 * Global speech-speed control. Persists to localStorage and lets all modules
 * (Alphabet, Numbers, Glossary, Dictation) share one system.
 */
export function useSpeechSpeed() {
  const [speed, setSpeed] = useState<SpeechSpeed>(loadSpeed);

  useEffect(() => {
    setItem(SPEED_KEY, speed);
    // Re-cancel any in-flight utterance so the new rate applies immediately.
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, [speed]);

  const setNextSpeed = useCallback(() => {
    setSpeed((prev) => (prev === 'slow' ? 'normal' : prev === 'normal' ? 'fast' : 'slow'));
  }, []);

  return {
    speed,
    rates: SPEED_RATES,
    setSpeed,
    setNextSpeed,
  };
}

export { SPEED_RATES };