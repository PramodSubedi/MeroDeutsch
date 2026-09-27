/**
 * src/components/chat/ChatMessage.tsx — one bubble.
 *
 * Assistant turns carry the owl avatar, the rendered markdown, a row of
 * per-message actions (listen / copy / retry) and an optional navigation chip.
 * User turns are plain right-aligned bubbles with no avatar — an avatar on both
 * sides doubles the visual weight in a 320px column without adding information.
 *
 * TTS SAFETY (.clinerules C2.6 / C6)
 * ---------------------------------
 * Speech here is ALWAYS user-initiated, on an already-rendered, already-locked
 * answer. There is no auto-speak anywhere in this component and nothing can be
 * spoken before the learner has seen the text. A bundled recording
 * (`message.audioUrl`) is preferred over synthesis, so a word is heard in the
 * app's own recorded voice.
 */

import { useState } from 'react';
import { Check, Copy, RotateCcw, Volume2 } from 'lucide-react';

import { playAudioUrl, speakText } from '../../hooks/useSpeech';
import type { ChatMessage as ChatMessageData, MeroMood } from '../../types/chatbot';
import { ChatMarkdown, stripMarkdown } from './ChatMarkdown';
import { MeroAvatar } from './MeroAvatar';
import {
  ErrorCard,
  OnboardingCard,
  ProgressCard,
  ReportCard,
  RulesCard,
  VocabCard,
} from './payloads';

export interface ChatMessageProps {
  message: ChatMessageData;
  isDE: boolean;
  /** Current owl mood, used for settled assistant turns. */
  mood: MeroMood;
  onAction: (to: string) => void;
  /** Re-send the question this turn answered. */
  onRetry?: (text: string) => void;
  /** Dismiss the first-run welcome. */
  onDismissWelcome?: () => void;
}

/**
 * Render a payload card, or null when there is none.
 *
 * Kept separate from the bubble so the transcript can show a card INSTEAD of
 * prose when the card carries the whole answer, and alongside it when the
 * model added something worth reading. A payload that fails to render (empty
 * rules, missing vocab) simply yields null and the prose still shows — a
 * card must never be able to blank out a reply.
 */
function renderPayload(
  message: ChatMessageData,
  isDE: boolean,
  onAction: (to: string) => void,
  onDismissWelcome: (() => void) | undefined,
) {
  const p = message.payload;
  if (!p) return null;
  switch (p.kind) {
    case 'vocab':
      return <VocabCard hit={p.hit} isDE={isDE} />;
    case 'rules':
      return <RulesCard payload={p} />;
    case 'progress':
      return <ProgressCard payload={p} isDE={isDE} />;
    case 'error':
      return <ErrorCard payload={p} isDE={isDE} onAction={onAction} />;
    case 'report':
      return <ReportCard payload={p} />;
    case 'onboarding':
      return (
        <OnboardingCard
          payload={p}
          isDE={isDE}
          onAction={onAction}
          onDismiss={() => onDismissWelcome?.()}
        />
      );
    default:
      // `quiz` is rendered by the sidebar as a live card, never in the transcript.
      return null;
  }
}

export function ChatMessage({
  message,
  isDE,
  mood,
  onAction,
  onRetry,
  onDismissWelcome,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  // Markdown must be stripped before synthesis, otherwise the TTS engine
  // pronounces "**den**" including the asterisks.
  const plain = stripMarkdown(message.content);

  const handleListen = () => {
    if (message.audioUrl) {
      playAudioUrl(message.audioUrl);
      return;
    }
    if (plain) speakText(plain);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (insecure origin / denied permission) — a silent
      // no-op beats a modal about something the learner cannot fix.
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg rounded-br-sm bg-accent-600 px-3 py-2 text-body text-white">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <MeroAvatar mood={message.streaming ? 'thinking' : mood} size={28} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div
          className={`rounded-lg rounded-bl-sm px-3 py-2 ${
            message.error
              ? 'border border-warning-200 bg-warning-50 text-warning-900 dark:border-warning-800/50 dark:bg-warning-950/40 dark:text-warning-200'
              : 'bg-ink-100 text-ink-900 dark:bg-ink-800 dark:text-ink-100'
          }`}
        >
          {message.streaming ? (
            <span className="flex items-center gap-1 py-1" aria-label={isDE ? 'Mero tippt' : 'Mero is typing'}>
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-400 dark:bg-ink-500"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </span>
          ) : (
            <>
              {renderPayload(message, isDE, onAction, onDismissWelcome)}
              {message.content && (
                <div className={message.payload ? 'mt-2' : undefined}>
                  <ChatMarkdown text={message.content} />
                </div>
              )}
            </>
          )}
        </div>

        {!message.streaming && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={handleListen}
              disabled={!plain && !message.audioUrl}
              aria-label={isDE ? 'Antwort vorlesen' : 'Listen to reply'}
              title={isDE ? 'Vorlesen' : 'Listen'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-500 transition hover:bg-ink-100 hover:text-ink-800 active:scale-95 disabled:opacity-40 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
            >
              <Volume2 className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => void handleCopy()}
              disabled={!plain}
              aria-label={isDE ? 'Antwort kopieren' : 'Copy reply'}
              title={isDE ? 'Kopieren' : 'Copy'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-500 transition hover:bg-ink-100 hover:text-ink-800 active:scale-95 disabled:opacity-40 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
            >
              {copied ? (
                <Check className="h-4 w-4 text-success-600" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            {onRetry && message.inReplyTo && (
              <button
                type="button"
                onClick={() => onRetry(message.inReplyTo as string)}
                aria-label={isDE ? 'Nochmal fragen' : 'Ask again'}
                title={isDE ? 'Nochmal fragen' : 'Ask again'}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-500 transition hover:bg-ink-100 hover:text-ink-800 active:scale-95 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
            )}

            {message.action && (
              <button
                type="button"
                onClick={() => onAction(message.action!.to)}
                className="inline-flex min-h-[32px] items-center rounded-md border border-accent-300 bg-accent-50 px-2.5 py-1 text-meta font-semibold text-accent-700 transition hover:bg-accent-100 active:scale-[0.98] dark:border-accent-800 dark:bg-accent-950/50 dark:text-accent-300 dark:hover:bg-accent-950"
              >
                → {message.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
