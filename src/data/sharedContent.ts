import { alphabetData } from './alphabet';
import { articlesData } from './articles';
import { spellingWords } from './spelling';
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

export const numbersData: NumberItem[] = [
  { n: 0, de: 'null', engPh: 'nool', nepPh: 'नुल्', en: 'zero', ne: 'शून्य' },
  { n: 1, de: 'eins', engPh: 'ine-ss', nepPh: 'आइन्स्', en: 'one', ne: 'एक' },
  { n: 2, de: 'zwei', engPh: 'tsvy', nepPh: 'त्स्वाइ', en: 'two', ne: 'दुई' },
  { n: 3, de: 'drei', engPh: 'dry', nepPh: 'द्राई', en: 'three', ne: 'तीन' },
  { n: 4, de: 'vier', engPh: 'feer', nepPh: 'फीअर', en: 'four', ne: 'चार' },
  { n: 5, de: 'fünf', engPh: 'fuenf', nepPh: 'फ्युन्फ्', en: 'five', ne: 'पाँच' },
  { n: 6, de: 'sechs', engPh: 'zex', nepPh: 'ज़ेक्स', en: 'six', ne: 'छ' },
  { n: 7, de: 'sieben', engPh: 'zee-ben', nepPh: 'ज़ीबेन्', en: 'seven', ne: 'सात' },
  { n: 8, de: 'acht', engPh: 'ahkt', nepPh: 'आख्त्', en: 'eight', ne: 'आठ' },
  { n: 9, de: 'neun', engPh: 'noin', nepPh: 'नोइन्', en: 'nine', ne: 'नौ' },
  { n: 10, de: 'zehn', engPh: 'tsayn', nepPh: 'त्सेन्', en: 'ten', ne: 'दश' },
  { n: 11, de: 'elf', engPh: 'elf', nepPh: 'एल्फ्', en: 'eleven', ne: 'एघार' },
  { n: 12, de: 'zwölf', engPh: 'tsvurf', nepPh: 'त्स्वोल्फ्', en: 'twelve', ne: 'बाह्र' },
  { n: 13, de: 'dreizehn', engPh: 'dry-tsayn', nepPh: 'द्राई-त्सेन्', en: 'thirteen', ne: 'तेरह', note: 'drei + zehn' },
  { n: 14, de: 'vierzehn', engPh: 'feer-tsayn', nepPh: 'फीअर-त्सेन्', en: 'fourteen', ne: 'चौध', note: 'vier + zehn' },
  { n: 15, de: 'fünfzehn', engPh: 'fuenf-tsayn', nepPh: 'फ्युन्फ्-त्सेन्', en: 'fifteen', ne: 'पन्ध्र', note: 'fünf + zehn' },
  { n: 16, de: 'sechzehn', engPh: 'zex-tsayn', nepPh: 'ज़ेक्स-त्सेन्', en: 'sixteen', ne: 'सोह्र', note: 'sechs + zehn' },
  { n: 17, de: 'siebzehn', engPh: 'zeep-tsayn', nepPh: 'ज़ीब्-त्सेन्', en: 'seventeen', ne: 'सत्र', note: 'sieben + zehn' },
  { n: 18, de: 'achtzehn', engPh: 'ahkt-tsayn', nepPh: 'आख्त्-त्सेन्', en: 'eighteen', ne: 'अठार', note: 'acht + zehn' },
  { n: 19, de: 'neunzehn', engPh: 'noin-tsayn', nepPh: 'नोइन्-त्सेन्', en: 'nineteen', ne: 'उन्नाइस', note: 'neun + zehn' },
  { n: 20, de: 'zwanzig', engPh: 'tsvahn-tsikh', nepPh: 'त्स्वान्-त्सिख्', en: 'twenty', ne: 'बीस', note: 'base tens' },
  { n: 21, de: 'einundzwanzig', engPh: 'ine-oont-tsvahn-tsikh', nepPh: 'आइन्-उन्ड्-त्स्वान्त्सिख्', en: 'twenty-one', ne: 'एक्काइस', note: 'eins + und + zwanzig' },
  { n: 22, de: 'zweiundzwanzig', engPh: 'tsvy-oont-tsvahn-tsikh', nepPh: 'त्स्वाइ-उन्ड्-त्स्वान्त्सिख्', en: 'twenty-two', ne: 'बाइस', note: 'zwei + und + zwanzig' },
  { n: 30, de: 'dreißig', engPh: 'dry-sikh', nepPh: 'द्राई-सिख्', en: 'thirty', ne: 'तीस', note: 'drei + ßig' },
  { n: 33, de: 'dreiunddreißig', engPh: 'dry-oont-dry-sikh', nepPh: 'द्राई-उन्ड्-द्राईसिख्', en: 'thirty-three', ne: 'तैंतीस', note: 'drei + und + dreißig' },
  { n: 40, de: 'vierzig', engPh: 'feer-tsikh', nepPh: 'फीअर-त्सिख्', en: 'forty', ne: 'चालीस', note: 'vier + zig' },
  { n: 45, de: 'fünfundvierzig', engPh: 'fuenf-oont-feer-tsikh', nepPh: 'फ्युन्फ्-उन्ड्-फीअर्त्सिख्', en: 'forty-five', ne: 'पैंतालीस', note: 'fünf + und + vierzig' },
  { n: 50, de: 'fünfzig', engPh: 'fuenf-tsikh', nepPh: 'फ्युन्फ्-त्सिख्', en: 'fifty', ne: 'पचास', note: 'fünf + zig' },
  { n: 60, de: 'sechzig', engPh: 'zex-tsikh', nepPh: 'ज़ेक्स-त्सिख्', en: 'sixty', ne: 'साठी', note: 'sechs + zig' },
  { n: 70, de: 'siebzig', engPh: 'zeep-tsikh', nepPh: 'ज़ीब्-त्सिख्', en: 'seventy', ne: 'सत्तरी', note: 'sieben + zig' },
  { n: 80, de: 'achtzig', engPh: 'ahkt-tsikh', nepPh: 'आख्त्-त्सिख्', en: 'eighty', ne: 'अस्सी', note: 'acht + zig' },
  { n: 90, de: 'neunzig', engPh: 'noin-tsikh', nepPh: 'नोइन्-त्सिख्', en: 'ninety', ne: 'नब्बे', note: 'neun + zig' },
  { n: 99, de: 'neunundneunzig', engPh: 'noin-oont-noin-tsikh', nepPh: 'नोइन्-उन्ड्-नोइन्त्सिख्', en: 'ninety-nine', ne: 'निन्यानबे', note: 'neun + und + neunzig' },
  { n: 100, de: 'hundert', engPh: 'hoon-dert', nepPh: 'हुन्डर्त्', en: 'one hundred', ne: 'एक सय', note: '100 = hundert' },
  { n: 101, de: 'hunderteins', engPh: 'hoon-dert-ine-ss', nepPh: 'हुन्डर्त्-आइन्स्', en: 'one hundred one', ne: 'एक सय एक', note: 'hundert + eins' },
  { n: 200, de: 'zweihundert', engPh: 'tsvy-hoon-dert', nepPh: 'त्स्वाइ-हुन्डर्त्', en: 'two hundred', ne: 'दुई सय', note: 'zwei + hundert' },
  { n: 1000, de: 'tausend', engPh: 'tow-zent', nepPh: 'ताउज़ेन्ट्', en: 'one thousand', ne: 'एक हजार', note: '1000 = tausend' },
  { n: 2000, de: 'zweitausend', engPh: 'tsvy-tow-zent', nepPh: 'त्स्वाइ-ताउज़ेन्ट्', en: 'two thousand', ne: 'दुई हजार', note: 'zwei + tausend' },
  { n: 1000000, de: 'eine Million', engPh: 'ine-eh mil-yohn', nepPh: 'आइने मिल्योन्', en: 'one million', ne: 'एक लाख', note: '1,000,000 = eine Million' },
];

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
