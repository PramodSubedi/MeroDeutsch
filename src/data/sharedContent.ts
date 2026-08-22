/**
 * src/data/sharedContent.ts
 *
 * UI COPY ONLY — localization strings and section metadata.
 *
 * All curriculum DATA pools (alphabet, numbers, calendar, greetings,
 * vocabulary, grammar drills, roleplay, dictation, stories, rapid-fire,
 * spelling, pronunciation tips) have been migrated to the Supabase
 * `content_items` table (migration 011) and are served exclusively through
 * `curriculumService`. This module retains only presentational constants.
 */

export type LocalizedString = {
  german: string;
  normal: string;
};

const localize = (german: string, normal: string): LocalizedString => ({
  german,
  normal,
});

export const sharedTextDatabase = {
  alphabet: {
    title: 'German Alphabet',
    description: 'Learn German letters with pronunciation and examples',
  },
  articles: {
    title: 'Articles',
    description: 'Practice der/die/das with common nouns',
  },
  calendar: {
    title: 'Days & Months',
    description: 'Learn the days of the week and months',
  },
  numbers: {
    title: 'German Numbers',
    description: 'Learn to count in German with pronunciation',
  },
  greetings: {
    title: 'Essential Greetings',
    description: 'Common German greetings and phrases.',
  },
  stories: {
    title: 'Micro-Stories',
    description: 'A1-level stories with interactive word translations',
  },
} as const;

export const sharedTranslations = {
  common: {
    nextWord: localize('Nächstes Wort →', 'Next Word →'),
    startOver: localize('Erneut starten', 'Start over'),
    recordingStarted: localize('Aufnahme gestartet. Sprich jetzt.', 'Recording started. Speak now.'),
    recordingStopped: localize('Aufnahme gestoppt.', 'Recording stopped.'),
    microphoneUnavailable: localize('Mikrofon nicht verfügbar.', 'Microphone not available.'),
    speechUnsupported: localize('Spracherkennung wird in diesem Browser nicht unterstützt.', 'Speech recognition is not supported in this browser.'),
    hear: localize('Hören', 'Hear'),
    speak: localize('Sprechen', 'Speak'),
    stop: localize('Stopp', 'Stop'),
    correct: localize('Richtig!', 'Correct!'),
    wrong: localize('Falsch!', 'Wrong!'),
  },
  navigation: {
    alphabet: localize('Alphabet', 'Alphabet'),
    numbers: localize('Zahlen', 'Numbers'),
    calendar: localize('Kalender', 'Calendar'),
    articles: localize('Artikel', 'Articles'),
    greetings: localize('Grußformeln', 'Greetings'),
    toggleNormal: localize('EN+NE', 'EN+NE'),
    toggleGerman: localize('Nur DE', 'Nur DE'),
  },
  errors: {
    loadApp: localize('Die App konnte nicht geladen werden. Bitte neu laden.', 'The app failed to load. Please refresh.'),
  },
} as const;