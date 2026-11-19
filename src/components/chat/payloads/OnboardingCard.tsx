/** First-run welcome for Mero. */

import type { ChatPayload } from '../../../types/chatbot';

export type OnboardingPayload = Extract<ChatPayload, { kind: 'onboarding' }>;

export function OnboardingCard({
  isDE,
  onAction,
  onDismiss,
}: {
  isDE: boolean;
  onAction: (to: string) => void;
  onDismiss: () => void;
}) {
  const abilities = isDE
    ? [
        'Warum war das falsch? — erklärt deine echten Fehler',
        'Was sollte ich üben? — zeigt deine schwächste Stelle',
        'Wo bin ich im Kurs? — sagt dir den nächsten Schritt',
        'Frag mich ein Wort — mit Aussprache und Beispiel',
        'Praktiziere mit mir — ich frage dich ab',
      ]
    : [
        'Why was that wrong? — explains your real mistakes',
        'What should I practise? — shows your weakest spot',
        'Where am I? — tells you the next step',
        'Ask me a word — with audio and an example',
        'Practise with me — I quiz you inside the chat',
      ];

  return (
    <div className="rounded-md border border-accent-200 bg-accent-50/60 p-3 dark:border-accent-800 dark:bg-accent-950/30">
      <p className="text-body font-bold text-ink-900 dark:text-ink-100">
        {isDE ? 'Ich bin Mero, deine Lern-Eule 🦉' : "I'm Mero, your study owl 🦉"}
      </p>

      <ul className="mt-2 space-y-1">
        {abilities.map((a) => (
          <li key={a} className="text-meta text-ink-700 dark:text-ink-300">
            · {a}
          </li>
        ))}
      </ul>


      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onAction('/practice')}
          className="inline-flex min-h-[36px] items-center rounded-md bg-accent-600 px-3 py-1.5 text-meta font-semibold text-white transition hover:bg-accent-700 active:scale-[0.98]"
        >
          {isDE ? 'Ablauf starten' : 'Start a drill'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex min-h-[36px] items-center rounded-md border border-ink-200 bg-white px-3 py-1.5 text-meta font-semibold text-ink-700 transition hover:bg-ink-50 active:scale-[0.98] dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300"
        >
          {isDE ? 'Alles klar' : 'Got it'}
        </button>
      </div>
    </div>
  );
}
