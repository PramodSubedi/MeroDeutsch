/**
 * audioService — unified pronunciation + feedback audio engine.
 *
 * Wraps the native Web Speech API (`window.speechSynthesis`) with a fixed
 * `de-DE` language, an optional global mute/volume toggle persisted in
 * localStorage (`md_audio_enabled`), and Web Audio FX for correct/wrong
 * outcomes and combo milestones.
 *
 * All in-app audio (article trainer, rapid-fire, alerts) should route through
 * this module so mute is honored globally.
 */

/* ───────────────────────────────────────────────────────────
 * Persisted audio toggle (global, across header + all pages)
 * ─────────────────────────────────────────────────────────── */

const AUDIO_KEY = 'md_audio_enabled';

export function isAudioEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(AUDIO_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setAudioEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AUDIO_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore storage failures
  }
  if (!enabled && typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/* ───────────────────────────────────────────────────────────
 * Speech synthesis (German)
 * ─────────────────────────────────────────────────────────── */

function getGermanVoice(): SpeechSynthesisVoice | undefined {
  if (typeof window === 'undefined' || !window.speechSynthesis) return undefined;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang.toLowerCase().startsWith('de'));
}

/**
 * Speak `text` in German, honoring the global mute toggle.
 * Rate override lets callers slow down for emphasis (default 0.85 ≈ normal app speed).
 */
export function speakGerman(text: string, rate = 0.85): void {
  if (!isAudioEnabled()) return;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE';
  u.rate = rate;
  const voice = getGermanVoice();
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
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