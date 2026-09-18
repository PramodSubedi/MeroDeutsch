/**
 * scripts/poolsData.ts
 *
 * EMBEDDED copies of every former hardcoded curriculum pool. This module is
 * the permanent source for scripts/seedContentPools.ts so seeding keeps
 * working after the original src/data/*.ts files are deleted from the repo.
 */

/* ── Alphabet (former src/data/alphabet.ts) ─────────────────── */

export interface AlphabetItemSeed {
  id: string;
  letter: string;
  gerPhonetic: string;
  engPhonetic: string;
  nepPhonetic: string;
  type: 'vowel' | 'consonant';
  category: 'standard' | 'special';
  example: string;
  exampleFull: string;
  speak: string;
  speakWord: string;
}

export const ALPHABET: AlphabetItemSeed[] = [
  { id: 'A', letter: 'A a', gerPhonetic: 'Ah', engPhonetic: 'Ah', nepPhonetic: 'आ', type: 'vowel', category: 'standard', example: 'Apfel', exampleFull: 'Apfel (Apple / स्याउ)', speak: 'A', speakWord: 'Apfel' },
  { id: 'B', letter: 'B b', gerPhonetic: 'Be', engPhonetic: 'Bay', nepPhonetic: 'बे', type: 'consonant', category: 'standard', example: 'Buch', exampleFull: 'Buch (Book / किताब)', speak: 'B', speakWord: 'Buch' },
  { id: 'C', letter: 'C c', gerPhonetic: 'Ce', engPhonetic: 'Tsay', nepPhonetic: 'त्से', type: 'consonant', category: 'standard', example: 'Computer', exampleFull: 'Computer (Computer / कम्प्युटर)', speak: 'C', speakWord: 'Computer' },
  { id: 'D', letter: 'D d', gerPhonetic: 'De', engPhonetic: 'Day', nepPhonetic: 'डे', type: 'consonant', category: 'standard', example: 'Danke', exampleFull: 'Danke (Thanks / धन्यवाद)', speak: 'D', speakWord: 'Danke' },
  { id: 'E', letter: 'E e', gerPhonetic: 'E', engPhonetic: 'Ay', nepPhonetic: 'ए', type: 'vowel', category: 'standard', example: 'Elefant', exampleFull: 'Elefant (Elephant / हात्ती)', speak: 'E', speakWord: 'Elefant' },
  { id: 'F', letter: 'F f', gerPhonetic: 'Eff', engPhonetic: 'Eff', nepPhonetic: 'एफ्', type: 'consonant', category: 'standard', example: 'Fisch', exampleFull: 'Fisch (Fish / माछा)', speak: 'F', speakWord: 'Fisch' },
  { id: 'G', letter: 'G g', gerPhonetic: 'Ge', engPhonetic: 'Gay', nepPhonetic: 'गे', type: 'consonant', category: 'standard', example: 'Gut', exampleFull: 'Gut (Good / राम्रो)', speak: 'G', speakWord: 'Gut' },
  { id: 'H', letter: 'H h', gerPhonetic: 'Ha', engPhonetic: 'Hah', nepPhonetic: 'हा', type: 'consonant', category: 'standard', example: 'Haus', exampleFull: 'Haus (House / घर)', speak: 'H', speakWord: 'Haus' },
  { id: 'I', letter: 'I i', gerPhonetic: 'I', engPhonetic: 'Ee', nepPhonetic: 'ई', type: 'vowel', category: 'standard', example: 'Igel', exampleFull: 'Igel (Hedgehog / दुम्सी)', speak: 'I', speakWord: 'Igel' },
  { id: 'J', letter: 'J j', gerPhonetic: 'Jot', engPhonetic: 'Yot', nepPhonetic: 'योट्', type: 'consonant', category: 'standard', example: 'Ja', exampleFull: 'Ja (Yes / हो)', speak: 'J', speakWord: 'Ja' },
  { id: 'K', letter: 'K k', gerPhonetic: 'Ka', engPhonetic: 'Kah', nepPhonetic: 'का', type: 'consonant', category: 'standard', example: 'Kaffee', exampleFull: 'Kaffee (Coffee / कफी)', speak: 'K', speakWord: 'Kaffee' },
  { id: 'L', letter: 'L l', gerPhonetic: 'Ell', engPhonetic: 'Ell', nepPhonetic: 'एल्', type: 'consonant', category: 'standard', example: 'Lampe', exampleFull: 'Lampe (Lamp / बत्ती)', speak: 'L', speakWord: 'Lampe' },
  { id: 'M', letter: 'M m', gerPhonetic: 'Emm', engPhonetic: 'Emm', nepPhonetic: 'एम्', type: 'consonant', category: 'standard', example: 'Mutter', exampleFull: 'Mutter (Mother / आमा)', speak: 'M', speakWord: 'Mutter' },
  { id: 'N', letter: 'N n', gerPhonetic: 'Enn', engPhonetic: 'Enn', nepPhonetic: 'एन्', type: 'consonant', category: 'standard', example: 'Name', exampleFull: 'Name (Name / नाम)', speak: 'N', speakWord: 'Name' },
  { id: 'O', letter: 'O o', gerPhonetic: 'O', engPhonetic: 'Oh', nepPhonetic: 'ओ', type: 'vowel', category: 'standard', example: 'Orange', exampleFull: 'Orange (Orange / सुन्तला)', speak: 'O', speakWord: 'Orange' },
  { id: 'P', letter: 'P p', gerPhonetic: 'Pe', engPhonetic: 'Pay', nepPhonetic: 'पे', type: 'consonant', category: 'standard', example: 'Papa', exampleFull: 'Papa (Dad / बाबा)', speak: 'P', speakWord: 'Papa' },
  { id: 'Q', letter: 'Q q', gerPhonetic: 'Ku', engPhonetic: 'Koo', nepPhonetic: 'कु', type: 'consonant', category: 'standard', example: 'Quelle', exampleFull: 'Quelle (Source / मुहान)', speak: 'Q', speakWord: 'Quelle' },
  { id: 'R', letter: 'R r', gerPhonetic: 'Err', engPhonetic: 'Err', nepPhonetic: 'एर', type: 'consonant', category: 'standard', example: 'Rot', exampleFull: 'Rot (Red / रातो)', speak: 'R', speakWord: 'Rot' },
  { id: 'S', letter: 'S s', gerPhonetic: 'Ess', engPhonetic: 'Ess', nepPhonetic: 'एस्', type: 'consonant', category: 'standard', example: 'Sonne', exampleFull: 'Sonne (Sun / घाम)', speak: 'S', speakWord: 'Sonne' },
  { id: 'T', letter: 'T t', gerPhonetic: 'Te', engPhonetic: 'Tay', nepPhonetic: 'टे', type: 'consonant', category: 'standard', example: 'Tee', exampleFull: 'Tee (Tea / चिया)', speak: 'T', speakWord: 'Tee' },
  { id: 'U', letter: 'U u', gerPhonetic: 'U', engPhonetic: 'Oo', nepPhonetic: 'ऊ', type: 'vowel', category: 'standard', example: 'Uhr', exampleFull: 'Uhr (Clock / घडी)', speak: 'U', speakWord: 'Uhr' },
  { id: 'V', letter: 'V v', gerPhonetic: 'Fau', engPhonetic: 'Fow (like F)', nepPhonetic: 'फाउ', type: 'consonant', category: 'standard', example: 'Vater', exampleFull: 'Vater (Father / बुबा)', speak: 'V', speakWord: 'Vater' },
  { id: 'W', letter: 'W w', gerPhonetic: 'We', engPhonetic: 'Vay (like V)', nepPhonetic: 'भे', type: 'consonant', category: 'standard', example: 'Wasser', exampleFull: 'Wasser (Water / पानी)', speak: 'W', speakWord: 'Wasser' },
  { id: 'X', letter: 'X x', gerPhonetic: 'Iks', engPhonetic: 'Iks', nepPhonetic: 'इक्स्', type: 'consonant', category: 'standard', example: 'Xylophon', exampleFull: 'Xylophon (Xylophone)', speak: 'X', speakWord: 'Xylophon' },
  { id: 'Y', letter: 'Y y', gerPhonetic: 'Ypsilon', engPhonetic: 'Ipsilon', nepPhonetic: 'इप्सिलन', type: 'consonant', category: 'standard', example: 'Yoga', exampleFull: 'Yoga (Yoga / योग)', speak: 'Y', speakWord: 'Yoga' },
  { id: 'Z', letter: 'Z z', gerPhonetic: 'Zett', engPhonetic: 'Tset', nepPhonetic: 'त्सेट्', type: 'consonant', category: 'standard', example: 'Zug', exampleFull: 'Zug (Train / रेल)', speak: 'Z', speakWord: 'Zug' },
  { id: 'Ae', letter: 'Ä ä', gerPhonetic: 'A-Umlaut', engPhonetic: 'Eh', nepPhonetic: 'ए (छोटो)', type: 'vowel', category: 'special', example: 'Äpfel', exampleFull: 'Äpfel (Apples / स्याउहरू)', speak: 'Ä', speakWord: 'Äpfel' },
  { id: 'Oe', letter: 'Ö ö', gerPhonetic: 'O-Umlaut', engPhonetic: 'Uuh', nepPhonetic: 'अ / ओ', type: 'vowel', category: 'special', example: 'Öl', exampleFull: 'Öl (Oil / तेल)', speak: 'Ö', speakWord: 'Öl' },
  { id: 'Ue', letter: 'Ü ü', gerPhonetic: 'U-Umlaut', engPhonetic: 'Eww', nepPhonetic: 'उइ / इ', type: 'vowel', category: 'special', example: 'Über', exampleFull: 'Über (Over / माथि)', speak: 'Ü', speakWord: 'Über' },
  { id: 'Sz', letter: 'ß', gerPhonetic: 'Eszett', engPhonetic: 'Sharp S', nepPhonetic: 'एस्-त्सेट्', type: 'consonant', category: 'special', example: 'Straße', exampleFull: 'Straße (Street / सडक)', speak: 'ß', speakWord: 'Straße' },
];

/* ── Numbers (former src/data/numbers.ts) ───────────────────── */

export interface NumberItemSeed {
  n: number;
  de: string;
  engPh: string;
  nepPh: string;
  en: string;
  ne: string;
  note?: string;
}

export const NUMBERS: NumberItemSeed[] = [
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

/* ── Greetings + Calendar (former src/data/sharedContent.ts) ── */

export interface GreetingItemSeed {
  de: string;
  engPh: string;
  nepPh: string;
  en: string;
  ne: string;
}

export const GREETINGS: GreetingItemSeed[] = [
  { de: 'Hallo', engPh: 'hah-lo', nepPh: 'हालो', en: 'Hello', ne: 'नमस्ते' },
  { de: 'Guten Morgen', engPh: 'goo-ten mor-gen', nepPh: 'गुटेन मोर्गेन', en: 'Good Morning', ne: 'शुभ प्रभात' },
  { de: 'Guten Tag', engPh: 'goo-ten tahk', nepPh: 'गुटेन टाक', en: 'Good Day', ne: 'नमस्कार' },
  { de: 'Guten Abend', engPh: 'goo-ten ah-bent', nepPh: 'गुटेन आबेन्ट', en: 'Good Evening', ne: 'शुभ साँझ' },
  { de: 'Auf Wiedersehen', engPh: 'owf vee-der-zayn', nepPh: 'आउफ विडरजेन', en: 'Goodbye', ne: 'फेरि भेटौंला' },
  { de: 'Danke', engPh: 'dahn-kuh', nepPh: 'डानके', en: 'Thank you', ne: 'धन्यवाद' },
  { de: 'Bitte', engPh: 'bih-tuh', nepPh: 'बिट्टे', en: 'Please / You are welcome', ne: 'कृपया / स्वागत छ' },
  { de: 'Entschuldigung', engPh: 'ent-shul-di-gung', nepPh: 'एन्टशुल्डिगुङ', en: 'Excuse me / Sorry', ne: 'माफ गर्नुहोस्' },
];

export const CALENDAR: GreetingItemSeed[] = [
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

/* ── Vocabulary (former src/data/loadVocabulary.ts + vocab/*.json) ── */

export interface VocabEntrySeed {
  id: string;
  de: string;
  en: string;
  ne: string;
  tags: string[];
  level: 'A1';
  exampleDe?: string;
}

export const VOCAB: VocabEntrySeed[] = [
  { id: 'fam-mutter', de: 'Mutter', en: 'mother', ne: 'आमा', tags: ['family'], level: 'A1', exampleDe: 'Meine Mutter kocht.' },
  { id: 'food-ich', de: 'Ich', en: 'I', ne: '', tags: ['food', 'A1'], level: 'A1' },
  { id: 'genera-practice', de: 'Practice', en: 'these', ne: '', tags: ['general', 'A1'], level: 'A1' },
  { id: 'health-auge', de: 'Auge', en: 'eye', ne: '', tags: ['health', 'A1'], level: 'A1' },
  { id: 'home-mit', de: 'mit', en: 'to', ne: '', tags: ['home', 'A1'], level: 'A1' },
  { id: 'leisur-amüsieren', de: 'amüsieren', en: 'to', ne: '', tags: ['leisure', 'A1'], level: 'A1' },
  { id: 'travel-affe', de: 'Affe', en: 'monkey', ne: '', tags: ['travel', 'A1'], level: 'A1' },
];

/* ── Grammar drills (former src/data/grammar.ts) ────────────── */

export interface GrammarDrillSeed {
  prompt: string;
  options: string[];
  correct: string;
}

export const GRAMMAR_DRILLS: Record<string, GrammarDrillSeed[]> = {
  sein: [
    { prompt: 'Ich ___ Student.', options: ['bin', 'bist', 'ist'], correct: 'bin' },
    { prompt: 'Du ___ nett.', options: ['bin', 'bist', 'ist'], correct: 'bist' },
    { prompt: 'Er ___ müde.', options: ['bin', 'bist', 'ist'], correct: 'ist' },
    { prompt: 'Wir ___ hier.', options: ['sind', 'seid', 'ist'], correct: 'sind' },
    { prompt: 'Ihr ___ Freunde.', options: ['sind', 'seid', 'bin'], correct: 'seid' },
  ],
  haben: [
    { prompt: 'Ich ___ ein Buch.', options: ['habe', 'hast', 'hat'], correct: 'habe' },
    { prompt: 'Du ___ einen Stift.', options: ['habe', 'hast', 'hat'], correct: 'hast' },
    { prompt: 'Sie ___ eine Schwester.', options: ['habe', 'hast', 'hat'], correct: 'hat' },
    { prompt: 'Wir ___ Hunger.', options: ['haben', 'habt', 'hat'], correct: 'haben' },
    { prompt: 'Ihr ___ Zeit.', options: ['haben', 'habt', 'hast'], correct: 'habt' },
  ],
  weakVerb: [
    { prompt: 'Ich ___ Kaffee. (machen)', options: ['mache', 'machst', 'macht'], correct: 'mache' },
    { prompt: 'Du ___ die Arbeit. (machen)', options: ['mache', 'machst', 'macht'], correct: 'machst' },
    { prompt: 'Er ___ Sport. (machen)', options: ['mache', 'machst', 'macht'], correct: 'macht' },
    { prompt: 'Wir ___ Musik. (machen)', options: ['machen', 'macht', 'mache'], correct: 'machen' },
    { prompt: 'Ihr ___ Hausaufgaben. (machen)', options: ['machen', 'macht', 'mache'], correct: 'macht' },
  ],
  cases: [
    { prompt: 'Der Mann sieht ___ Frau. (who receives?)', options: ['den Mann', 'die Frau'], correct: 'die Frau' },
    { prompt: 'Ich habe ___ Bruder. (direct object)', options: ['einen', 'ein'], correct: 'einen' },
    { prompt: '___ Tisch ist groß. (subject)', options: ['Der', 'Den'], correct: 'Der' },
    { prompt: 'Wir kaufen ___ Buch. (direct object)', options: ['das', 'die'], correct: 'das' },
    { prompt: 'Sie liebt ___ Hund. (direct object)', options: ['einen', 'ein'], correct: 'einen' },
  ],
  // Stem-change drill (du/er singular vowel shifts — du/sie(She)/er/es only).
  stem: [
    { prompt: 'du ___ (lesen)', options: ['liest', 'lesst', 'lesest'], correct: 'liest' },
    { prompt: 'er ___ (sehen)', options: ['sieht', 'seht', 'sehet'], correct: 'sieht' },
    { prompt: 'du ___ (sprechen)', options: ['sprichst', 'sprechst', 'sprecht'], correct: 'sprichst' },
    { prompt: 'du ___ (fahren)', options: ['fährst', 'fahrst', 'fahrt'], correct: 'fährst' },
    { prompt: 'er ___ (essen)', options: ['isst', 'esst', 'essen'], correct: 'isst' },
    { prompt: 'du ___ (nehmen)', options: ['nimmst', 'nehmst', 'nimmt'], correct: 'nimmst' },
    { prompt: 'er ___ (schlafen)', options: ['schläft', 'schlaft', 'schlafst'], correct: 'schläft' },
    { prompt: 'du ___ (laufen)', options: ['läufst', 'lauft', 'laufst'], correct: 'läufst' },
  ],
  // Modal verbs (Band F bonus chip /grammar?tab=modals deep-link target).
  modals: [
    { prompt: 'Ich ___ gut schwimmen. (können)', options: ['kann', 'kannst', 'könne'], correct: 'kann' },
    { prompt: 'Du ___ heute Hausaufgaben machen. (müssen)', options: ['musst', 'müsst', 'müsse'], correct: 'musst' },
    { prompt: 'Er ___ ein Auto kaufen. (wollen)', options: ['will', 'willst', 'wollen'], correct: 'will' },
    { prompt: 'Wir ___ hier nicht rauchen. (dürfen)', options: ['dürfen', 'darft', 'dürft'], correct: 'dürfen' },
  ],
  // A1 Resource Pack U4 — separable vs inseparable prefix classifier.
  prefix: [
    { prompt: '___ (aufstehen) — trennbar oder untrennbar?', options: ['Separable', 'Inseparable'], correct: 'Separable' },
    { prompt: 'ver- (verstehen) — trennbar oder untrennbar?', options: ['Separable', 'Inseparable'], correct: 'Inseparable' },
    { prompt: 'ein- (einkaufen) — trennbar oder untrennbar?', options: ['Separable', 'Inseparable'], correct: 'Separable' },
    { prompt: 'be- (besuchen) — trennbar oder untrennbar?', options: ['Separable', 'Inseparable'], correct: 'Inseparable' },
    { prompt: 'an- (anrufen) — trennbar oder untrennbar?', options: ['Separable', 'Inseparable'], correct: 'Separable' },
    { prompt: 'ge- (gefallen) — trennbar oder untrennbar?', options: ['Separable', 'Inseparable'], correct: 'Inseparable' },
    { prompt: 'zer- (zerbrechen) — trennbar oder untrennbar?', options: ['Separable', 'Inseparable'], correct: 'Inseparable' },
    { prompt: 'mit- (mitkommen) — trennbar oder untrennbar?', options: ['Separable', 'Inseparable'], correct: 'Separable' },
  ],
};

/* ── Roleplay scenarios (former src/data/roleplay.ts) ───────── */

export interface RoleplayOptionSeed { text: string; ok: boolean; fb: string; }
export interface RoleplayStepSeed { npc: string; prompt: string; options: RoleplayOptionSeed[]; }
export interface RoleplayScenarioSeed { id: string; title: string; emoji: string; steps: RoleplayStepSeed[]; }

export const ROLEPLAY: RoleplayScenarioSeed[] = [
  {
    id: 'cafe', title: 'Im Café', emoji: '☕',
    steps: [
      { npc: 'Guten Tag! Was möchten Sie?', prompt: 'What do you order?', options: [
        { text: 'Ich hätte gern einen Kaffee, bitte.', ok: true, fb: 'Sehr gut!' },
        { text: 'Wo ist der Bahnhof?', ok: false, fb: 'That is directions, not an order.' },
        { text: 'Ich bin müde.', ok: false, fb: 'True, but you still need to order!' },
      ]},
      { npc: 'Möchten Sie auch etwas zu essen?', prompt: 'What do you answer?', options: [
        { text: 'Nein, danke. Nur den Kaffee.', ok: true, fb: 'Perfekt!' },
        { text: 'Ich heiße Anna.', ok: false, fb: 'That is your name, not about food.' },
      ]},
    ],
  },
  {
    id: 'intro', title: 'Vorstellung', emoji: '👋',
    steps: [
      { npc: 'Hallo! Wie heißt du?', prompt: 'Introduce yourself.', options: [
        { text: 'Ich heiße Pramod. Und du?', ok: true, fb: 'Sehr gut!' },
        { text: 'Ich bin aus Nepal.', ok: false, fb: 'That answers origin, not name.' },
      ]},
      { npc: 'Woher kommst du?', prompt: 'Answer where you are from.', options: [
        { text: 'Ich komme aus Nepal.', ok: true, fb: 'Perfekt!' },
        { text: 'Ich habe Hunger.', ok: false, fb: 'That is about hunger, not origin.' },
      ]},
    ],
  },
  {
    id: 'hotel', title: 'Hotel-Check-in', emoji: '🏨',
    steps: [
      { npc: 'Guten Abend. Haben Sie eine Reservierung?', prompt: 'Answer the hotel clerk.', options: [
        { text: 'Ja, ich habe eine Reservierung.', ok: true, fb: 'Sehr gut!' },
        { text: 'Ich brauche ein Taxi.', ok: false, fb: 'A taxi is not a reservation.' },
      ]},
      { npc: 'Ihr Zimmer ist Nummer 12. Hier ist der Schlüssel.', prompt: 'What do you say?', options: [
        { text: 'Vielen Dank!', ok: true, fb: 'Perfekt!' },
        { text: 'Auf Wiedersehen!', ok: false, fb: 'Thank the clerk first!' },
      ]},
    ],
  },
];

/* ── Dictation words (former src/data/dictation.ts) ─────────── */

export const DICTATION: { word: string }[] = [
  { word: 'Hallo' }, { word: 'Danke' }, { word: 'Bitte' }, { word: 'Haus' },
  { word: 'Buch' }, { word: 'Zug' }, { word: 'Name' }, { word: 'Wasser' },
  { word: 'Schule' }, { word: 'Freund' }, { word: 'Morgen' }, { word: 'Mutter' },
];

/* ── Stories (former src/data/stories.ts) ───────────────────── */

export interface StoryWordSeed { de: string; ne: string; en: string; }
export interface StorySentenceSeed { id: string; de: string; ne: string; en: string; words: StoryWordSeed[]; }
export interface MicroStorySeed {
  id: string;
  title: string;
  titleNe: string;
  titleEn: string;
  level: 'A1';
  sentences: StorySentenceSeed[];
}

export const STORIES: MicroStorySeed[] = [
  {
    id: 'story-1', title: 'Morgenroutine', titleNe: 'बिहानको दिनचर्या', titleEn: 'Morning Routine', level: 'A1',
    sentences: [
      { id: 's1-1', de: 'Guten Morgen!', ne: 'शुभ प्रभात!', en: 'Good morning!', words: [
        { de: 'Guten', ne: 'शुभ', en: 'Good' }, { de: 'Morgen', ne: 'बिहान', en: 'morning' },
      ]},
      { id: 's1-2', de: 'Heute ist Montag.', ne: 'आज सोमबार हो।', en: 'Today is Monday.', words: [
        { de: 'Heute', ne: 'आज', en: 'Today' }, { de: 'ist', ne: 'हो', en: 'is' }, { de: 'Montag', ne: 'सोमबार', en: 'Monday' },
      ]},
      { id: 's1-3', de: 'Es ist das Jahr 2026.', ne: 'यो २०२६ साल हो।', en: 'It is the year 2026.', words: [
        { de: 'Es', ne: 'यो', en: 'It' }, { de: 'ist', ne: 'हो', en: 'is' }, { de: 'das', ne: '', en: 'the' }, { de: 'Jahr', ne: 'वर्ष', en: 'year' },
      ]},
    ],
  },
  {
    id: 'story-2', title: 'Im Café', titleNe: 'क्याफेमा', titleEn: 'At the Café', level: 'A1',
    sentences: [
      { id: 's2-1', de: 'Hallo! Wie geht es dir?', ne: 'नमस्ते! तिमीलाई कस्तो छ?', en: 'Hello! How are you?', words: [
        { de: 'Hallo', ne: 'नमस्ते', en: 'Hello' }, { de: 'Wie', ne: 'कसरी', en: 'How' }, { de: 'geht', ne: 'जान्छ', en: 'goes' }, { de: 'es', ne: 'यो', en: 'it' }, { de: 'dir', ne: 'तिमीलाई', en: 'you' },
      ]},
      { id: 's2-2', de: 'Danke, gut!', ne: 'धन्यवाद, राम्रो!', en: 'Thank you, good!', words: [
        { de: 'Danke', ne: 'धन्यवाद', en: 'Thank you' }, { de: 'gut', ne: 'राम्रो', en: 'good' },
      ]},
      { id: 's2-3', de: 'Auf Wiedersehen!', ne: 'फेरी भेटौंला!', en: 'Goodbye!', words: [
        { de: 'Auf', ne: '', en: 'On/Until' }, { de: 'Wiedersehen', ne: 'फेरी भेट्ने', en: 'seeing again' },
      ]},
    ],
  },
  {
    id: 'story-3', title: 'Die Woche', titleNe: 'हप्ता', titleEn: 'The Week', level: 'A1',
    sentences: [
      { id: 's3-1', de: 'Montag, Dienstag, Mittwoch.', ne: 'सोमबार, मंगलबार, बुधबार।', en: 'Monday, Tuesday, Wednesday.', words: [
        { de: 'Montag', ne: 'सोमबार', en: 'Monday' }, { de: 'Dienstag', ne: 'मंगलबार', en: 'Tuesday' }, { de: 'Mittwoch', ne: 'बुधबार', en: 'Wednesday' },
      ]},
      { id: 's3-2', de: 'Ich lerne jeden Tag Deutsch.', ne: 'म हरेक दिन जर्मन सिक्छु।', en: 'I learn German every day.', words: [
        { de: 'Ich', ne: 'म', en: 'I' }, { de: 'lerne', ne: 'सिक्छु', en: 'learn' }, { de: 'jeden', ne: 'हरेक', en: 'every' }, { de: 'Tag', ne: 'दिन', en: 'day' }, { de: 'Deutsch', ne: 'जर्मन', en: 'German' },
      ]},
    ],
  },
];

/* ── Rapid-fire questions (former src/data/rapidFireSections.ts) ── */

export const RAPID_FIRE: Record<string, unknown[]> = {
  'vocabulary-translation': [
    { id: 'vocab-trans-1', type: 'vocabulary-translation', timeLimit: 5000, english: 'apple', german: 'apfel', options: ['apfel', 'haus', 'Auto'] },
    { id: 'vocab-trans-2', type: 'vocabulary-translation', timeLimit: 5000, english: 'water', german: 'wasser', options: ['Wasser', 'Brot', 'Hund'] },
    { id: 'vocab-trans-3', type: 'vocabulary-translation', timeLimit: 5000, english: 'friend', german: 'Freund', options: ['Freundin', 'Freund', 'Frei'] },
    { id: 'vocab-trans-4', type: 'vocabulary-translation', timeLimit: 5000, english: 'book', german: 'Buch', options: ['Buch', 'Baum', 'Bank'] },
  ],
  'audio-comprehension': [
    { id: 'audio-comp-1', type: 'audio-comprehension', timeLimit: 6000, word: 'Haus', meaning: 'house', options: ['house', 'home', 'yard'] },
    { id: 'audio-comp-2', type: 'audio-comprehension', timeLimit: 6000, word: 'Buch', meaning: 'book', options: ['book', 'table', 'chair'] },
    { id: 'audio-comp-3', type: 'audio-comprehension', timeLimit: 6000, word: 'Freund', meaning: 'friend', options: ['friend', 'teacher', 'doctor'] },
    { id: 'audio-comp-4', type: 'audio-comprehension', timeLimit: 6000, word: 'Wasser', meaning: 'water', options: ['water', 'milk', 'juice'] },
  ],
  'article-precision': [
    { id: 'article-1', type: 'article-precision', timeLimit: 4000, noun: 'Apfel', article: 'der' },
    { id: 'article-2', type: 'article-precision', timeLimit: 4000, noun: 'Tisch', article: 'der' },
    { id: 'article-3', type: 'article-precision', timeLimit: 4000, noun: 'Tür', article: 'die' },
    { id: 'article-4', type: 'article-precision', timeLimit: 4000, noun: 'Haus', article: 'das' },
  ],
  'number-conversion': [
    { id: 'number-1', type: 'number-conversion', timeLimit: 5000, number: 5, germanText: 'fünf', direction: 'digit-to-text', options: ['fünf', 'zehn', 'eins'] },
    { id: 'number-2', type: 'number-conversion', timeLimit: 5000, number: 12, germanText: 'zwölf', direction: 'text-to-digit', options: ['12', '21', '2'] },
    { id: 'number-3', type: 'number-conversion', timeLimit: 5000, number: 20, germanText: 'zwanzig', direction: 'digit-to-text', options: ['zwanzig', 'fünfzehn', 'dreißig'] },
    { id: 'number-4', type: 'number-conversion', timeLimit: 5000, number: 30, germanText: 'dreißig', direction: 'text-to-digit', options: ['30', '31', '20'] },
  ],
  'verb-conjugation': [
    { id: 'verb-1', type: 'verb-conjugation', timeLimit: 5000, pronoun: 'ich', verb: 'sein', conjugated: 'bin', options: ['bin', 'bist', 'ist'] },
    { id: 'verb-2', type: 'verb-conjugation', timeLimit: 5000, pronoun: 'du', verb: 'haben', conjugated: 'hast', options: ['habe', 'hast', 'hat'] },
    { id: 'verb-3', type: 'verb-conjugation', timeLimit: 5000, pronoun: 'er', verb: 'machen', conjugated: 'macht', options: ['mache', 'macht', 'machen'] },
    { id: 'verb-4', type: 'verb-conjugation', timeLimit: 5000, pronoun: 'wir', verb: 'gehen', conjugated: 'gehen', options: ['gehe', 'gehen', 'geht'] },
    // Stem-change drill items (du/er vowel shifts — e→i, e→ie, a→ä).
    { id: 'verb-5', type: 'verb-conjugation', timeLimit: 5000, pronoun: 'du', verb: 'lesen', conjugated: 'liest', options: ['liest', 'lesst', 'lesest'] },
    { id: 'verb-6', type: 'verb-conjugation', timeLimit: 5000, pronoun: 'du', verb: 'sprechen', conjugated: 'sprichst', options: ['sprichst', 'sprechst', 'sprecht'] },
    { id: 'verb-7', type: 'verb-conjugation', timeLimit: 5000, pronoun: 'er', verb: 'fahren', conjugated: 'fährt', options: ['fährt', 'fährst', 'fahrt'] },
    { id: 'verb-8', type: 'verb-conjugation', timeLimit: 5000, pronoun: 'du', verb: 'nehmen', conjugated: 'nimmst', options: ['nimmst', 'nehmst', 'nimmt'] },
    { id: 'verb-9', type: 'verb-conjugation', timeLimit: 5000, pronoun: 'er', verb: 'schlafen', conjugated: 'schläft', options: ['schläft', 'schlaft', 'schlafen'] },
    { id: 'verb-10', type: 'verb-conjugation', timeLimit: 5000, pronoun: 'du', verb: 'geben', conjugated: 'gibst', options: ['gibst', 'gebst', 'gebt'] },
  ],
  'pronunciation-reading': [
    { id: 'pron-1', type: 'pronunciation-reading', timeLimit: 7000, text: 'Haus', meaning: 'house', audio: 'Haus', options: ['Haus', 'Hase', 'Haut'] },
    { id: 'pron-2', type: 'pronunciation-reading', timeLimit: 7000, text: 'Buch', meaning: 'book', audio: 'Buch', options: ['Buch', 'Baden', 'Burg'] },
    { id: 'pron-3', type: 'pronunciation-reading', timeLimit: 7000, text: 'Freund', meaning: 'friend', audio: 'Freund', options: ['Freund', 'Früh', 'Frei'] },
    { id: 'pron-4', type: 'pronunciation-reading', timeLimit: 7000, text: 'Wasser', meaning: 'water', audio: 'Wasser', options: ['Wasser', 'Wald', 'Werk'] },
  ],
};

/* ── Spelling words (former src/data/spelling.ts) ───────────── */

export const SPELLING: Record<string, { word: string; meaning: string; letters: string[] }[]> = {
  easy: [
    { word: 'JA', meaning: 'Yes / हो', letters: ['J', 'A'] },
    { word: 'HAUS', meaning: 'House / घर', letters: ['H', 'A', 'U', 'S'] },
    { word: 'GUT', meaning: 'Good / राम्रो', letters: ['G', 'U', 'T'] },
    { word: 'TEE', meaning: 'Tea / चिया', letters: ['T', 'E', 'E'] },
    { word: 'UHR', meaning: 'Clock / घडी', letters: ['U', 'H', 'R'] },
    { word: 'NAME', meaning: 'Name / नाम', letters: ['N', 'A', 'M', 'E'] },
    { word: 'BUCH', meaning: 'Book / किताब', letters: ['B', 'U', 'C', 'H'] },
    { word: 'ZUG', meaning: 'Train / रेल', letters: ['Z', 'U', 'G'] },
    { word: 'AUTO', meaning: 'Car / गाडी', letters: ['A', 'U', 'T', 'O'] },
    { word: 'KIND', meaning: 'Child / बच्चा', letters: ['K', 'I', 'N', 'D'] },
  ],
  medium: [
    { word: 'WASSER', meaning: 'Water / पानी', letters: ['W', 'A', 'S', 'S', 'E', 'R'] },
    { word: 'VATER', meaning: 'Father / बुबा', letters: ['V', 'A', 'T', 'E', 'R'] },
    { word: 'MUTTER', meaning: 'Mother / आमा', letters: ['M', 'U', 'T', 'T', 'E', 'R'] },
    { word: 'SCHULE', meaning: 'School / स्कूल', letters: ['S', 'C', 'H', 'U', 'L', 'E'] },
    { word: 'FREUND', meaning: 'Friend / साथी', letters: ['F', 'R', 'E', 'U', 'N', 'D'] },
    { word: 'MORGEN', meaning: 'Morning / बिहान', letters: ['M', 'O', 'R', 'G', 'E', 'N'] },
    { word: 'NACHT', meaning: 'Night / रात', letters: ['N', 'A', 'C', 'H', 'T'] },
    { word: 'ARBEIT', meaning: 'Work / काम', letters: ['A', 'R', 'B', 'E', 'I', 'T'] },
  ],
};

/* ── Pronunciation tips (former src/data/pronunciationTips.ts) ── */

export const PRONUNCIATION_TIPS: Record<string, { en: string; ne: string }> = {
  Ae: { en: 'Like the "e" in "bed", but with lips spread wide. Say "eh" with a smile.', ne: 'अंग्रेजीको "bed" को "e" जस्तै, तर ओठ फराकिलो पारेर। "ए" भन्नुहोस्।' },
  Oe: { en: 'Round your lips like "o", then say "e". Like the French "eu".', ne: 'ओठलाई "ओ" जस्तै गोलो पारेर "ए" भन्नुहोस्। फ्रेन्च "eu" जस्तै।' },
  Ue: { en: 'Round your lips like "u", then say "ee". Like the French "u".', ne: 'ओठलाई "उ" जस्तै गोलो पारेर "ई" भन्नुहोस्। फ्रेन्च "u" जस्तै।' },
  Sz: { en: 'A sharp "s" sound, like "ss" in "hiss". Never a "z" sound.', ne: 'तीखो "स" ध्वनि, अंग्रेजीको "hiss" को "ss" जस्तै। कहिल्यै "ज" जस्तो होइन।' },
  R: { en: 'A soft rolled "r" at the back of the throat, or a light tap like Spanish "r".', ne: 'घाँटीको पछाडिबाट हल्का गड्गडाउने "र", वा स्पेनिस "r" जस्तै हल्का ट्याप।' },
  Z: { en: 'Say "ts" together, like "ts" in "cats". Not a "z" sound.', ne: '"ts" सँगै भन्नुहोस्, अंग्रेजीको "cats" को "ts" जस्तै। "ज" ध्वनि होइन।' },
  C: { en: 'Before e/i: "ts". Otherwise like "k".', ne: '"e" वा "i" अघि: "ts"। अन्यथा "k" जस्तै।' },
  V: { en: 'Usually pronounced like "f" in German words.', ne: 'जर्मन शब्दहरूमा प्रायः "f" जस्तै उच्चारण हुन्छ।' },
  W: { en: 'Like English "v" — lips touch the teeth.', ne: 'अंग्रेजीको "v" जस्तै — ओठ दाँतमा छुन्छन्।' },
  J: { en: 'Like English "y" in "yes".', ne: 'अंग्रेजीको "yes" को "y" जस्तै।' },
  S: { en: 'Before a vowel: like "z". Otherwise: like "s".', ne: 'स्वर अघि: "z" जस्तै। अन्यथा: "s" जस्तै।' },
  H: { en: 'A breathy "h", like English "h" in "hat".', ne: 'सास फेर्ने "h", अंग्रेजीको "hat" को "h" जस्तै।' },
};
