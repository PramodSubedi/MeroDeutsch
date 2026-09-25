import { useLang } from '../hooks/useLang';
import { usePageTitle } from '../hooks/usePageTitle';
import { theme } from '../config/theme';

interface Faq {
  q: string;
  a: string;
}

export function HelpPage() {
  usePageTitle('Help');
  const { langMode } = useLang();
  const isDE = langMode === 'german';

  const faqs: Faq[] = isDE
    ? [
        {
          q: 'Was sind Lernserien?',
          a: 'Serien zählen, wie viele Tage hintereinander du gelernt hast. Lerne an zwei aufeinanderfolgenden Tagen, um deine Serie aufzubauen.',
        },
        {
          q: 'Was ist die SRS-Wiederholung?',
          a: 'SRS (spaced repetition) plant falsch beantwortete Wörter erneut (Boxen 1–5). Je besser du dich erinnerst, desto später wird das Wort wieder abgefragt.',
        },
        {
          q: 'Wie verdiene ich Abzeichen?',
          a: 'Abzeichen werden automatisch freigeschaltet, wenn du Meilensteine erreichst — z. B. Buchstaben üben oder Quizfragen beantworten. Deine Abzeichen findest du auf der Startseite.',
        },
        {
          q: 'Kann ich offline lernen?',
          a: 'Ja. MeroDeutsch ist eine PWA: Nach dem ersten Besuch werden Inhalte gecacht und funktionieren offline weiter.',
        },
        {
          q: 'Was bedeutet „Nur Deutsch“?',
          a: 'Im „Nur Deutsch“-Modus werden englische und nepalesische Hilfetexte ausgeblendet, damit du dich voll auf Deutsch konzentrierst.',
        },
        {
          q: 'Warum fragt die App nach dem Mikrofon?',
          a: 'Für Aussprache-Übungen. Die Spracherkennung läuft in deinem Browser; deine Audiodaten verlassen dein Gerät nicht.',
        },
        {
          q: 'Was ist der Unterschied zwischen Gast und Konto?',
          a: 'Als Gast wird dein Fortschritt nur auf diesem Gerät gespeichert. Mit einem Konto (Supabase) wird dein Fortschritt synchronisiert und ist auch auf anderen Geräten verfügbar.',
        },
      ]
    : [
        {
          q: 'What are streaks?',
          a: 'Streaks count how many days in a row you have learned. Practice on two consecutive days to build your streak.',
        },
        {
          q: 'What is SRS review?',
          a: 'SRS (spaced repetition) re-schedules words you answered wrong (boxes 1–5). The better you recall a word, the later it is shown again.',
        },
        {
          q: 'How do I earn badges?',
          a: 'Badges unlock automatically when you hit milestones — e.g., practicing letters or answering quiz questions. See your badges on the home page.',
        },
        {
          q: 'Can I learn offline?',
          a: 'Yes. MeroDeutsch is a PWA: after your first visit, content is cached and keeps working offline.',
        },
        {
          q: 'What does “Nur Deutsch” mean?',
          a: 'In “German-only” mode, English and Nepali helper text is hidden so you can focus fully on German.',
        },
        {
          q: 'Why does the app ask for microphone access?',
          a: 'For pronunciation practice. Speech recognition runs in your browser; your audio never leaves your device.',
        },
        {
          q: 'What is the difference between guest and account?',
          a: 'As a guest, your progress is stored on this device only. With an account (Supabase), your progress is synced and available on other devices.',
        },
      ];

  return (
    <div className={theme.page.container}>
      <div className="mb-6">
        <p className="text-body uppercase tracking-[0.25em] text-accent-600">{isDE ? 'Hilfe' : 'Help'}</p>
        <h1 className="text-2xl font-bold tracking-tight text-ink-950 dark:text-white">
          {isDE ? 'Häufig gestellte Fragen' : 'Frequently Asked Questions'}
        </h1>
        <p className="mt-1 text-body text-ink-500 dark:text-ink-400">
          {isDE ? 'Antworten auf die häufigsten Fragen.' : 'Answers to the most common questions.'}
        </p>
      </div>

      <div className="space-y-3">
        {faqs.map((faq) => (
          <div key={faq.q} className={theme.panel.surface}>
            <h2 className="text-body font-semibold text-ink-950 dark:text-white">{faq.q}</h2>
            <p className="mt-1.5 text-body leading-relaxed text-ink-600 dark:text-ink-300">{faq.a}</p>
          </div>
        ))}
      </div>

      {/* Content & audio attribution — CC BY-SA 4.0 obligation. */}
      <div className={`${theme.panel.surface} mt-6`}>
        <h2 className="text-body font-semibold text-ink-950 dark:text-white">
          {isDE ? 'Inhalte & Audio — Datenquellen' : 'Content & audio — data sources'}
        </h2>
        <p className="mt-1.5 text-body leading-relaxed text-ink-600 dark:text-ink-300">
          {isDE ? (
            <>
              Der Wortschatz basiert auf der{' '}
              <a className="text-accent-600 underline hover:text-accent-700" href="https://www.goethe.de/pro/relaunch/prf/de/A1_SD1_Wortliste_02.pdf" target="_blank" rel="noreferrer">Goethe-Institut A1-Wortliste</a>{' '}
              und dem Anki-Deck{' '}
              <a className="text-accent-600 underline hover:text-accent-700" href="https://github.com/patsytau/anki_german_a1_vocab" target="_blank" rel="noreferrer">anki_german_a1_vocab</a>{' '}
              von patsytau. Die Audioaussprachen wurden mit{' '}
              <a className="text-accent-600 underline hover:text-accent-700" href="https://github.com/thorstenMueller/Thorsten-Voice" target="_blank" rel="noreferrer">Thorsten-Voice</a>{' '}
              erzeugt. Lizenziert unter{' '}
              <a className="text-accent-600 underline hover:text-accent-700" href="http://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>.
            </>
          ) : (
            <>
              Vocabulary is based on the{' '}
              <a className="text-accent-600 underline hover:text-accent-700" href="https://www.goethe.de/pro/relaunch/prf/de/A1_SD1_Wortliste_02.pdf" target="_blank" rel="noreferrer">Goethe-Institut A1 wordlist</a>{' '}
              and the{' '}
              <a className="text-accent-600 underline hover:text-accent-700" href="https://github.com/patsytau/anki_german_a1_vocab" target="_blank" rel="noreferrer">anki_german_a1_vocab</a>{' '}
              deck by patsytau. Pronunciation audio was generated with{' '}
              <a className="text-accent-600 underline hover:text-accent-700" href="https://github.com/thorstenMueller/Thorsten-Voice" target="_blank" rel="noreferrer">Thorsten-Voice</a>.
              Licensed under{' '}
              <a className="text-accent-600 underline hover:text-accent-700" href="http://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>.
            </>
          )}
        </p>
      </div>
    </div>
  );
}