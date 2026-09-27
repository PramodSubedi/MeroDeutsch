/**
 * src/hooks/useChatbotTriggers.ts — Mero notices things worth mentioning.
 *
 * FOUR TRIGGERS, all of them answering the same question: "is this the moment
 * an explanation would actually be wanted?"
 *
 *   1. a repeated mistake          (owned by ChatSidebar — it is the one that
 *                                   needs the queue, so it lives next to the
 *                                   consumer)
 *   2. a failed checkpoint         — "you just missed the gate for module 5"
 *   3. a streak about to break     — "you have a 9-day streak and no activity
 *                                    today"
 *   4. a new weakest skill         — "your listening is now the weakest"
 *
 * EVERY TRIGGER IS ONCE-ONLY, TRACKED IN A REF
 * ---------------------------------------------
 * None of these may nag. A component-level effect that fires on every render
 * would re-queue the same nudge forever; each trigger therefore sets a ref the
 * first time it fires and never fires again for that subject in that session.
 *
 * WHY LEVEL IS DETECTED BY COMPARISON, NOT `onLevelUp`
 * -----------------------------------------------------
 * `useXp().onLevelUp(cb)` REPLACES a single global callback, and `Layout`
 * already owns it to drive the celebration modal. Subscribing again here would
 * silently break level-up celebrations app-wide. Comparing `xp.level` across
 * renders observes the same event without competing for the callback.
 */

import { useEffect, useRef } from 'react';

import { useActivityLog } from './useActivityLog';
import { useLang } from './useLang';
import { useXp } from './useXp';
import { useA1Path } from './useA1Path';
import { useChatStore } from '../lib/chatStore';
import { CHECKPOINT_PASS_THRESHOLD } from '../data/a1Path';
import { toLocalDateKey } from '../utils/dateUtils';
import type { ContextSnapshot } from '../types/chatbot';

export function useChatbotTriggers(snapshot: ContextSnapshot): void {
  const { level: xpLevel } = useXp();
  const { activities } = useActivityLog();
  const { attemptsByUnit } = useA1Path();
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  // ── 2. a failed checkpoint ────────────────────────────────────────────
  const failedUnits = useRef<Set<number>>(new Set());
  useEffect(() => {
    for (const [key, record] of Object.entries(attemptsByUnit)) {
      const unit = Number(key);
      if (!Number.isFinite(unit)) continue;
      if (failedUnits.current.has(unit)) continue;
      if (record.lastScore >= CHECKPOINT_PASS_THRESHOLD) continue;
      failedUnits.current.add(unit);
      useChatStore
        .getState()
        .enqueuePrompt(
          isDE
            ? 'Ich habe die Prüfung nicht bestanden. Was habe ich falsch gemacht?'
            : "I didn't pass the checkpoint. What did I get wrong?",
        );
    }
  }, [attemptsByUnit, isDE]);

  // ── 3. a streak about to break ────────────────────────────────────────
  // The activity log stores UTC dates while `toLocalDateKey` is local, so near
  // midnight the two can disagree. Accepting EITHER key is the cheap fix and
  // errs towards not nagging.
  const streakNudged = useRef(false);
  useEffect(() => {
    if (streakNudged.current) return;
    if (snapshot.streak.current < 2) return;
    const today = toLocalDateKey();
    const utcToday = new Date().toISOString().split('T')[0];
    const activeToday = activities.some(
      (day) => (day.date === today || day.date === utcToday) && day.count > 0,
    );
    if (activeToday) return;
    streakNudged.current = true;
    useChatStore
      .getState()
      .enqueuePrompt(isDE ? 'Meine Serie ist in Gefahr!' : 'My streak is at risk!');
  }, [activities, snapshot.streak.current, isDE]);

  // ── 4. a new weakest skill ────────────────────────────────────────────
  const seenWeakest = useRef<string | null>(null);
  useEffect(() => {
    const current = snapshot.weakestSkill?.category ?? null;
    // Seed on first sight without firing — "you are bad at something" the
    // moment a new learner opens the app is not encouragement.
    if (seenWeakest.current === null) {
      seenWeakest.current = current;
      return;
    }
    if (!current || current === seenWeakest.current) return;
    seenWeakest.current = current;
    useChatStore
      .getState()
      .enqueuePrompt(isDE ? 'Meine schwächste Fähigkeit?' : 'What is my weakest skill?');
  }, [snapshot.weakestSkill?.category, isDE]);

  // ── level change (celebration) ────────────────────────────────────────
  // First render is the baseline, not an event.
  const lastLevel = useRef(xpLevel);
  useEffect(() => {
    if (xpLevel === lastLevel.current) return;
    lastLevel.current = xpLevel;
    useChatStore.getState().enqueuePrompt(isDE ? `Level ${xpLevel} erreicht!` : `I reached level ${xpLevel}!`);
  }, [xpLevel, isDE]);
}
