/**
 * audioService — the mute toggle's home and the Web Audio outcome FX.
 *
 * WHAT MOVED OUT OF HERE
 * ----------------------
 * Speech. The `getGermanVoice()` picker that used to live here was a verbatim
 * duplicate of the one in `useSpeech.ts`, which made it possible for two
 * surfaces to sound different from one another. `speakGerman` / `speakPhrase`
 * are now thin delegates to `useSpeech`, which prefers a bundled MP3 from
 * `/audio/anki/` and falls back to `speechSynthesis` — so every call site that
 * imported `speakGerman` from here gets natural recordings for free.
 *
 * The mute FLAG moved to `utils/audioEnabled.ts` so that `useSpeech` can read it
 * without importing this module (which would be circular). It is re-exported
 * below, so `Header.tsx` and existing importers are unaffected.
 *
 * What stays: the outcome FX. Those are synthesized tones, not speech, and they
 * are already mute-aware.
 */

/* ───────────────────────────────────────────────────────────
 * Persisted audio toggle (global, across header + all pages)
 * Re-exported for back-compat; the owner is utils/audioEnabled.ts.
 * ─────────────────────────────────────────────────────────── */

import { isAudioEnabled } from './audioEnabled';
import { speakText } from '../hooks/useSpeech';

export { isAudioEnabled, setAudioEnabled } from './audioEnabled';

/* ───────────────────────────────────────────────────────────
 * Speech (delegates to useSpeech — see the file header)
 * ─────────────────────────────────────────────────────────── */

/**
 * Speak `text` in German, honoring the global mute toggle.
 * Rate override lets callers slow down for emphasis (default: the Settings
 * speed). Delegates to `useSpeech.speakText`, so a bundled recording is
 * preferred whenever the text is a German lemma with a clip.
 */
export function speakGerman(text: string, rate = 0.85): void {
  speakText(text, rate);
}

/** Speak the full "article + noun" phrase for a card, e.g. "der Tisch". */
export function speakPhrase(article: string, noun: string): void {
  speakGerman(`${article} ${noun}`);
}

/* ───────────────────────────────────────────────────────────
 * Web Audio feedback FX (correct / wrong / combo milestone)
 * ─────────────────────────────────────────────────────────── */

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', gainValue = 0.2): void {
  if (!isAudioEnabled()) return;
  if (typeof window === 'undefined' || !window.AudioContext) return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
    osc.onended = () => void ctx.close();
  } catch {
    // AudioContext can be blocked by autoplay policies — silently ignore.
  }
}

/** Correct answer chime — a rising two-tone (+10 XP feel). */
export function playCorrectFx(): void {
  playTone(660, 0.12, 'sine', 0.2);
  window.setTimeout(() => playTone(880, 0.18, 'sine', 0.18), 90);
}

/** Incorrect answer buzz. */
export function playWrongFx(): void {
  playTone(220, 0.3, 'square', 0.12);
}

/** Combo milestone fanfare — played when the combo threshold is crossed. */
export function playComboFx(): void {
  playTone(523, 0.1, 'triangle', 0.16);
  window.setTimeout(() => playTone(659, 0.1, 'triangle', 0.16), 90);
  window.setTimeout(() => playTone(784, 0.2, 'triangle', 0.16), 180);
}
