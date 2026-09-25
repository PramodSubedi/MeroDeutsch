import { useState } from 'react';
import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { theme } from '../config/theme';

const CONTACT_EMAIL = 'merodeutsch.feedback@gmail.com';

export function FeedbackPage() {
  usePageTitle('Feedback');
  const { langMode } = useLang();
  const isDE = langMode === 'german';
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');

  const mailBody = message
    ? encodeURIComponent(message)
    : encodeURIComponent(
        isDE
          ? 'Hallo MeroDeutsch-Team, ich habe folgendes Feedback:'
          : 'Hello MeroDeutsch team, here is my feedback:'
      );

  const mailtoHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('MeroDeutsch Feedback')}&body=${mailBody}`;

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — leave copied false.
    }
  };

  return (
    <div className={theme.page.container}>
      <div className="mb-6">
        <p className="text-body uppercase tracking-[0.25em] text-accent-600">{isDE ? 'Feedback' : 'Feedback'}</p>
        <h1 className="text-2xl font-bold tracking-tight text-ink-950 dark:text-white">
          {isDE ? 'Feedback senden' : 'Send Feedback'}
        </h1>
        <p className="mt-1 text-body text-ink-500 dark:text-ink-400">
          {isDE
            ? 'Dein Feedback wird direkt an uns per E-Mail gesendet — es gibt keinen versteckten Server.'
            : 'Your feedback is sent directly to us by email — there is no hidden server.'}
        </p>
      </div>

      <div className={theme.panel.surface}>
        <label className="space-y-2 text-body font-medium text-ink-700 dark:text-ink-200" htmlFor="feedback-message">
          {isDE ? 'Deine Nachricht' : 'Your message'}
          <textarea
            id="feedback-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={6}
            placeholder={isDE
              ? 'Z. B. Fehler melden, Verbesserungen vorschlagen, Fragen stellen …'
              : 'E.g. report a bug, suggest an improvement, ask a question …'}
            className={`${theme.input} resize-y`}
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={mailtoHref}
            className={theme.button.primary}
          >
            ✉️ {isDE ? 'Per E-Mail senden' : 'Send via email'}
          </a>
          <button type="button" onClick={copyEmail} className={theme.button.secondary}>
            {copied ? '✓ ' + (isDE ? 'Kopiert!' : 'Copied!') : (isDE ? 'E-Mail kopieren' : 'Copy email')}
          </button>
        </div>

        <p className="mt-4 text-meta leading-relaxed text-ink-500 dark:text-ink-400">
          {isDE
            ? `Diese Seite öffnet deinen E-Mail-Client mit vorausgefüllter Nachricht an ${CONTACT_EMAIL}. Es wird keine Nachricht an einen Server gesendet, bis du sie selbst absendest.`
            : `This page opens your email client with a pre-filled message to ${CONTACT_EMAIL}. Nothing is sent to a server until you send it yourself.`}
        </p>
      </div>
    </div>
  );
}