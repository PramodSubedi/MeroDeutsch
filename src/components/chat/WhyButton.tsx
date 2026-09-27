/**
 * src/components/chat/WhyButton.tsx — "Why was that wrong?"
 *
 * This is the affordance the feature was originally specified around: answer
 * a question wrong, tap "Why?", and Mero explains the rule. Until now the
 * companion was PULL-ONLY, so a learner who wanted an explanation had to know
 * the panel existed, open it, and type a question at exactly the moment they
 * most needed the answer.
 *
 * WHY IT IS A SEPARATE COMPONENT
 * ------------------------------
 * It talks to the chat through `enqueuePrompt` rather than importing
 * `ChatSidebar`. That keeps the whole coupling to one store method, so it can
 * be dropped into any drill footer without dragging the chat (and `marked`,
 * and zustand) into that module's graph.
 *
 * IT RENDERS NOTHING UNLESS IT WOULD ACTUALLY WORK
 * -----------------------------------------------
 * Disabled companion, wrong route, or an empty review queue all return null —
 * no dead button for the learner to press.
 */

import { useLocation } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';

import { useReviewQueue } from '../../hooks/useReviewQueue';
import { useLang } from '../../hooks/useLang';
import { useChatStore } from '../../lib/chatStore';
import { CHATBOT_ENABLED, isLearningRoute } from '../../config/chatbot';

export interface WhyButtonProps {
  className?: string;
}

export function WhyButton({ className = '' }: WhyButtonProps) {
  const { queue } = useReviewQueue();
  const { langMode } = useLang();
  const { pathname } = useLocation();
  const enqueuePrompt = useChatStore((s) => s.enqueuePrompt);
  const enabled = useChatStore((s) => s.settings.enabled);

  const isDE = langMode === 'german';

  if (!CHATBOT_ENABLED || !enabled || !isLearningRoute(pathname) || queue.length === 0) {
    return null;
  }

  // Worst-first, matching how the Dashboard queue is ordered: the mistake they
  // keep making beats the one they made once.
  const worst = [...queue].sort((a, b) => (b.errorCount ?? 0) - (a.errorCount ?? 0))[0];
  const target = (worst.correctAnswer || worst.itemKey || '').trim();
  if (!target) return null;

  return (
    <button
      type="button"
      onClick={() =>
        enqueuePrompt(isDE ? `Warum war "${target}" falsch?` : `Why was "${target}" wrong?`)
      }
      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-ink-200 bg-white px-3 py-2 text-body font-medium text-ink-700 transition hover:border-accent-400 hover:text-accent-600 active:scale-[0.98] dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300 ${className}`}
    >
      <HelpCircle className="h-4 w-4" aria-hidden="true" />
      {isDE ? 'Warum falsch?' : 'Why was that wrong?'}
    </button>
  );
}
