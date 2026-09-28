/**
 * src/hooks/useAssessmentActive.ts
 *
 * Tells the AI companion that a graded run is in flight, for exactly as long as
 * the caller says so.
 *
 * WHY A HOOK AND NOT A RAW ACQUIRE/RELEASE
 * ----------------------------------------
 * The signal is reference-counted, which makes overlapping owners safe — but it
 * also makes it unforgiving: one acquire without its matching release pins the
 * panel shut for the rest of the session, and the symptom (a companion that
 * never appears again) looks nothing like its cause. This hook acquires on the
 * false→true edge, releases on the true→false edge, and releases once more on
 * unmount, so a caller that navigates away mid-run cannot leak a claim.
 *
 * A page-level claim is what a page WITHOUT a deck-driven engine needs:
 * Rapid Blitz has its own timer state machine, so there is no session to hook.
 */

import { useEffect, useRef } from 'react';

import { acquireAssessment, releaseAssessment } from '../lib/assessmentSignal';

export function useAssessmentActive(active: boolean): void {
  const held = useRef(false);

  useEffect(() => {
    if (active === held.current) return;
    held.current = active;
    if (active) acquireAssessment();
    else releaseAssessment();
  }, [active]);

  // Unmount while still holding must NOT strand the count at a permanent 1,
  // which would suppress every future proactive reveal.
  useEffect(
    () => () => {
      if (held.current) {
        held.current = false;
        releaseAssessment();
      }
    },
    [],
  );
}