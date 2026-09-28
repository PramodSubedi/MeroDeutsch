/**
 * audioEnabled — the persisted global mute flag, and NOTHING else.
 *
 * WHY THIS IS A SEPARATE LEAF MODULE
 * ----------------------------------
 * `useSpeech.ts` is the single entry point for every German utterance in the app
 * (it prefers a bundled MP3 from `src/data/audioManifest.ts` and falls back to
 * `speechSynthesis`). `audioService.ts` delegates its speech to `useSpeech` but
 * still owns the Web Audio outcome FX.
 *
 * The mute flag is read by BOTH. Leaving it in `audioService.ts` would make
 * `useSpeech -> audioService -> useSpeech` a cycle. Keeping it here gives every
 * other module a dependency-free import.
 *
 * `audioService.ts` re-exports `isAudioEnabled` / `setAudioEnabled`, so existing
 * call sites (notably `Header.tsx`) are unaffected.
 *
 * The invariant this file exists to guarantee: the header mute button silences
 * EVERY sound the app makes — recorded clips, synthesized speech, and the
 * correct/wrong/combo tones.
 */

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
