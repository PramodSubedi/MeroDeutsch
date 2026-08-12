import { alphabetData } from './alphabet';
import { articlesData } from './articles';
import { spellingWords } from './spelling';
import { numbersData as numbersByRange } from './numbers';
import type { CalendarItem, GreetingItem, NumberItem } from '../types';

export { alphabetData, articlesData, spellingWords };

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
} as const;

export type LocalizedString = {
  german: string;
  normal: string;
};

const localize = (german: string, normal: string): LocalizedString => ({
  german,
  normal,
});

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

export const numbersData: NumberItem[] = Object.values(numbersByRange).flat();

export const greetingsData: GreetingItem[] = [
  { de: 'Hallo', engPh: 'hah-lo', nepPh: 'हालो', en: 'Hello', ne: 'नमस्ते' },
  { de: 'Guten Morgen', engPh: 'goo-ten mor-gen', nepPh: 'गुटेन मोर्गेन', en: 'Good Morning', ne: 'शुभ प्रभात' },
  { de: 'Guten Tag', engPh: 'goo-ten tahk', nepPh: 'गुटेन टाक', en: 'Good Day', ne: 'नमस्कार' },
  { de: 'Guten Abend', engPh: 'goo-ten ah-bent', nepPh: 'गुटेन आबेन्ट', en: 'Good Evening', ne: 'शुभ साँझ' },
  { de: 'Auf Wiedersehen', engPh: 'owf vee-der-zayn', nepPh: 'आउफ विडरजेन', en: 'Goodbye', ne: 'फेरि भेटौंला' },
  { de: 'Danke', engPh: 'dahn-kuh', nepPh: 'डानके', en: 'Thank you', ne: 'धन्यवाद' },
  { de: 'Bitte', engPh: 'bih-tuh', nepPh: 'बिट्टे', en: 'Please / You are welcome', ne: 'कृपया / स्वागत छ' },
  { de: 'Entschuldigung', engPh: 'ent-shul-di-gung', nepPh: 'एन्टशुल्डिगुङ', en: 'Excuse me / Sorry', ne: 'माफ गर्नुहोस्' },
];

export const calendarData: CalendarItem[] = [
  { de: 'Montag', engPh: 'mohn-tak', nepPh: 'मोन्-टाक', en: 'Monday', ne: 'सोमबार' },
  { de: 'Dienstag', engPh: 'deen-stak', nepPh: 'डिन्स्ताक', en: 'Tuesday', ne: 'मंगलबार' },
  { de: 'Mittwoch', engPh: 'mitt-vok', nepPh: 'मित्त्वोख', en: 'Wednesday', ne: 'बुधबार' },
  { de: 'Donnerstag', engPh: 'don-ner-shtahk', nepPh: 'डोनरश्ताक', en: 'Thursday', ne: 'बिहिबार' },
  { de: 'Freitag', engPh: 'fray-tahk', nepPh: 'फ्राइटाक', en: 'Friday', ne: 'शुक्रबार' },
  { de: 'Samstag', engPh: 'zahm-stahk', nepPh: 'ज़ामसताक', en: 'Saturday', ne: 'शनिबार' },
  { de: 'Sonntag', engPh: 'zohn-tahk', nepPh: 'ज़ोनताक', en: 'Sunday', ne: 'आइतबार' },
  { de: 'Januar', engPh: 'yah-noo-ahr', nepPh: 'जानुअर', en: 'January', ne: 'जनवरी' },
  { de: 'Februar', engPh: 'fay-broo-ahr', nepPh: 'फेब्रुअर', en: 'February', ne: 'फेब्रुअरी' },
  { de: 'März', engPh: 'maertz', nepPh: 'मेर्स', en: 'March', ne: 'मार्च' },
  { de: 'April', engPh: 'ah-pril', nepPh: 'एप्रिल', en: 'April', ne: 'अप्रिल' },
  { de: 'Mai', engPh: 'my', nepPh: 'माई', en: 'May', ne: 'मे' },
  { de: 'Juni', engPh: 'yoo-nee', nepPh: 'जुनी', en: 'June', ne: 'जून' },
  { de: 'Juli', engPh: 'yoo-lee', nepPh: 'जुलाई', en: 'July', ne: 'जुलाई' },
  { de: 'August', engPh: 'ow-goost', nepPh: 'अगस्ट', en: 'August', ne: 'अगष्ट' },
  { de: 'September', engPh: 'zep-tem-ber', nepPh: 'सेप्टेम्बर', en: 'September', ne: 'सेप्टेम्बर' },
  { de: 'Oktober', engPh: 'ok-toh-ber', nepPh: 'अक्टोबर', en: 'October', ne: 'अक्टोबर' },
  { de: 'November', engPh: 'noh-vem-ber', nepPh: 'नोभेम्बर', en: 'November', ne: 'नोभेम्बर' },
  { de: 'Dezember', engPh: 'day-tsem-ber', nepPh: 'डे़ज़ेम्बर', en: 'December', ne: 'दिसेम्बर' },
];
