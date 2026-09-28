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

/**
 * GREETINGS.
 *
 * Pool size matters: this feeds the `greeting-translation` checkpoint source
 * (Module 1 draws 6) and the `/greetings` matching drill. At 8 items the deck
 * had almost no room to vary. Keep this list in step with the German actually
 * taught in Module 1 — courtesy register (du/Sie) plus everyday reactions.
 */
export const GREETINGS: GreetingItemSeed[] = [
  { de: 'Hallo', engPh: 'hah-lo', nepPh: 'हालो', en: 'Hello', ne: 'नमस्ते' },
  { de: 'Guten Morgen', engPh: 'goo-ten mor-gen', nepPh: 'गुटेन मोर्गेन', en: 'Good Morning', ne: 'शुभ प्रभात' },
  { de: 'Guten Tag', engPh: 'goo-ten tahk', nepPh: 'गुटेन टाक', en: 'Good Day', ne: 'नमस्कार' },
  { de: 'Guten Abend', engPh: 'goo-ten ah-bent', nepPh: 'गुटेन आबेन्ट', en: 'Good Evening', ne: 'शुभ साँझ' },
  { de: 'Gute Nacht', engPh: 'goo-tuh nakht', nepPh: 'गुटे नख्त', en: 'Good night', ne: 'शुभ रात्री' },
  { de: 'Auf Wiedersehen', engPh: 'owf vee-der-zayn', nepPh: 'आउफ विडरजेन', en: 'Goodbye', ne: 'फेरि भेटौंला' },
  { de: 'Bis später', engPh: 'bis shpue-ter', nepPh: 'बिस श्प्युटर', en: 'See you later', ne: 'पछि भेटौंला' },
  { de: 'Danke', engPh: 'dahn-kuh', nepPh: 'डानके', en: 'Thank you', ne: 'धन्यवाद' },
  { de: 'Bitte', engPh: 'bih-tuh', nepPh: 'बिट्टे', en: 'Please / You are welcome', ne: 'कृपया / स्वागत छ' },
  { de: 'Entschuldigung', engPh: 'ent-shul-di-gung', nepPh: 'एन्टशुल्डिगुङ', en: 'Excuse me / Sorry', ne: 'माफ गर्नुहोस्' },
  { de: 'Gut gemacht', engPh: 'gut ma-khart', nepPh: 'गुट मखार्ट', en: 'Well done', ne: 'बहुत राम्रो' },
  { de: 'Kein Problem', engPh: 'kayn pro-blem', nepPh: 'केन प्रोब्लेम', en: 'No problem', ne: 'कुनै समस्या छैन' },
  { de: 'Natürlich', engPh: 'na-tuer-likh', nepPh: 'नाटर्लिख', en: 'Of course', ne: 'अवश्य' },
  { de: 'Wie geht es Ihnen?', engPh: 'vee gayt es EE-nen', nepPh: 'वी गेट एस ईनन', en: 'How are you? (formal)', ne: 'तपाईं कस्तो हुनुहुन्छ?' },
  { de: 'Viel Spaß', engPh: 'feel shpash', nepPh: 'फिल श्पाश', en: 'Have fun', ne: 'रमाइलो गर्नुहोस्' },
  { de: 'Gute Reise', engPh: 'goo-tuh rye-ze', nepPh: 'गुटे राइजे', en: 'Have a good trip', ne: 'राम्रो यात्रा होस्' },
  { de: 'Schönen Tag', engPh: 'shoo-nen taak', nepPh: 'शूनन ताक', en: 'Have a nice day', ne: 'राम्रो दिन होस्' },
  { de: 'Herzlich willkommen', engPh: 'herts-leekh vil-kom-men', nepPh: 'हर्जिल्क विलकमेन', en: 'A warm welcome', ne: 'हार्दिक स्वागत छ' },
  { de: 'Willkommen', engPh: 'vil-kom-men', nepPh: 'विलकमेन', en: 'Welcome', ne: 'स्वागत छ' },
  { de: 'Freundliche Grüße', engPh: 'froyn-tli-khe grue-se', nepPh: 'फ्रायन्टलिखे ग्रुसे', en: 'Kind regards', ne: 'शुभकामना' },
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
  // Grown 4 -> 10: Module 13 draws 6 items without replacement, so a 4-item
  // pool forced the deck to cycle and show repeats inside one sitting. Every
  // modal is now drilled in more than one person so the verb slot is drilled
  // too (the real beginner error is the ending, not the modal).
  modals: [
    { prompt: 'Ich ___ gut schwimmen. (können)', options: ['kann', 'kannst', 'könne'], correct: 'kann' },
    { prompt: 'Du ___ heute Hausaufgaben machen. (müssen)', options: ['musst', 'müsst', 'müsse'], correct: 'musst' },
    { prompt: 'Er ___ ein Auto kaufen. (wollen)', options: ['will', 'willst', 'wollen'], correct: 'will' },
    { prompt: 'Wir ___ hier nicht rauchen. (dürfen)', options: ['dürfen', 'darft', 'dürft'], correct: 'dürfen' },
    { prompt: 'Ihr ___ jetzt gehen. (müssen)', options: ['müsst', 'musst', 'müssen'], correct: 'müsst' },
    { prompt: 'Sie ___ gut sprechen. (können)', options: ['können', 'könnt', 'kann'], correct: 'können' },
    { prompt: 'Ich ___ nicht kommen. (wollen)', options: ['will', 'wollen', 'willst'], correct: 'will' },
    { prompt: 'Du ___ das machen. (sollen)', options: ['sollst', 'soll', 'sollen'], correct: 'sollst' },
    { prompt: 'Er ___ ein Gespräch führen. (können)', options: ['kann', 'könnt', 'können'], correct: 'kann' },
    { prompt: 'Wir ___ hier bleiben. (müssen)', options: ['müssen', 'müsst', 'muss'], correct: 'müssen' },
  ],
  // Verb-Second inversion (Module 8). The unit teaches "the verb is always
  // second, so an opener in position 1 pushes the subject to position 3" —
  // that rule had no drill at all before, so it was taught and never checked.
  // Each prompt shows the opener and leaves only the verb.
  v2: [
    { prompt: 'Heute ___ ich Deutsch. (lernen)', options: ['lerne', 'lernst', 'lernt'], correct: 'lerne' },
    { prompt: 'In der Nacht ___ ich. (schlafen)', options: ['schlafe', 'schläft', 'schlafen'], correct: 'schlafe' },
    { prompt: 'Morgen ___ wir nach Berlin. (fahren)', options: ['fahren', 'fahrt', 'fährt'], correct: 'fahren' },
    { prompt: '___ ist Montag. (today)', options: ['Heute', 'Ich', 'Montag'], correct: 'Heute' },
    { prompt: '___ trinke ich Kaffee. (tomorrow)', options: ['Morgen', 'Ich', 'Kaffee'], correct: 'Morgen' },
    { prompt: 'Am Montag ___ er zur Schule. (gehen)', options: ['geht', 'gehe', 'gehst'], correct: 'geht' },
  ],
  // ACCUSATIVE as its own pool (Module 10). Deliberately separate from `cases`:
  // Module 4 used to draw the same five `cases` items Module 10 drew, so passing
  // Module 4 previewed Module 10's quiz. Distinct ids, distinct items.
  accusative: [
    { prompt: 'Ich schreibe ___ Brief.', options: ['einen', 'ein', 'keinen'], correct: 'einen' },
    { prompt: 'Ich trinke ___ Kaffee.', options: ['einen', 'ein', 'der'], correct: 'einen' },
    { prompt: 'Ich kaufe ___ Apfel.', options: ['einen', 'ein', 'keine'], correct: 'einen' },
    { prompt: 'Ich habe ___ Hund.', options: ['keinen', 'kein', 'eine'], correct: 'keinen' },
    { prompt: 'Ich lese ___ Buch.', options: ['ein', 'einen', 'keine'], correct: 'ein' },
    { prompt: 'Ich trinke ___ Wasser.', options: ['kein', 'einen', 'eine'], correct: 'kein' },
    { prompt: 'Ich schreibe ___ E-Mail.', options: ['eine', 'einen', 'ein'], correct: 'eine' },
    { prompt: 'Ich mag ___ Salat.', options: ['einen', 'ein', 'kein'], correct: 'einen' },
  ],
  // NEGATION (Module 5). `kein` stands where a noun with no article stands;
  // `nicht` negates the verb, the adjective or a whole clause. The two are
  // swapped by beginners constantly, so each is drilled in the other's slot.
  kein: [
    { prompt: 'Ich habe ___ Tisch.', options: ['keinen', 'kein', 'nicht'], correct: 'keinen' },
    { prompt: 'Ich habe ___ Zeit.', options: ['keine', 'kein', 'nicht'], correct: 'keine' },
    { prompt: 'Ich habe ___ Geld.', options: ['kein', 'keine', 'nicht'], correct: 'kein' },
    { prompt: 'Das ist ___ Apfel.', options: ['kein', 'keinen', 'nicht'], correct: 'kein' },
    { prompt: 'Der Tisch ist ___ groß.', options: ['nicht', 'kein', 'keine'], correct: 'nicht' },
    { prompt: 'Ich ___ nicht Auto fahren. (können)', options: ['kann', 'kein', 'keine'], correct: 'kann' },
  ],
  // Possessive determiners (Module 4). -e on feminine AND plural, and the
  // capitalised Ihr for formal "your" — the thing a learner copies in lower case.
  possessive: [
    { prompt: '___ Vater heißt Hari.', options: ['Mein', 'Meine', 'Meins'], correct: 'Mein' },
    { prompt: '___ Mutter kocht gut.', options: ['Meine', 'Mein', 'Meins'], correct: 'Meine' },
    { prompt: '___ Kinder spielen im Garten.', options: ['Meine', 'Mein', 'Meinen'], correct: 'Meine' },
    { prompt: '___ Bruder ist Lehrer.', options: ['Mein', 'Meine', 'Meinen'], correct: 'Mein' },
    { prompt: 'Wie heißt ___ Name?', options: ['Ihr', 'Ihre', 'ihr'], correct: 'Ihr' },
    { prompt: '___ Hund heißt Bello.', options: ['Mein', 'Meine', 'Meinen'], correct: 'Mein' },
  ],
  // Demonstrative determiners (Module 11). dieser / diese / dieses in the
  // nominative, plus the -en accusative plural that shop sentences need.
  demonstrative: [
    { prompt: '___ Pullover ist blau.', options: ['Dieser', 'Diese', 'Dieses'], correct: 'Dieser' },
    { prompt: '___ Jacke ist schön.', options: ['Diese', 'Dieser', 'Dieses'], correct: 'Diese' },
    { prompt: '___ Hemd ist weiß.', options: ['Dieses', 'Dieser', 'Diese'], correct: 'Dieses' },
    { prompt: 'Ich nehme ___ Saal.', options: ['diesen', 'dieser', 'diese'], correct: 'diesen' },
    { prompt: '___ Schuhe sind neu.', options: ['Diese', 'Dieser', 'Dieses'], correct: 'Diese' },
    { prompt: '___ Buch ist interessant.', options: ['Dieses', 'Diese', 'Dieser'], correct: 'Dieses' },
  ],
  // WHOLE-SENTENCE WORD ORDER. Every option is a complete sentence; only one
  // obeys Verb-Second. The `v2` drills above test a single missing word, which
  // a learner can often solve by recognising the verb; here the whole
  // arrangement has to be judged, which is the actual V2 skill. Distractors are
  // built from the two ways beginners actually get it wrong — leaving the
  // subject in position 1, or putting the verb last.
  wordOrder: [
    {
      prompt: 'Which sentence is correct?',
      options: ['Heute lerne ich Deutsch.', 'Ich lerne heute Deutsch.', 'Heute ich lerne Deutsch.'],
      correct: 'Heute lerne ich Deutsch.',
    },
    {
      prompt: 'Which sentence is correct?',
      options: ['Morgen fahren wir nach Berlin.', 'Morgen wir fahren nach Berlin.', 'Fahren wir morgen nach Berlin.'],
      correct: 'Morgen fahren wir nach Berlin.',
    },
    {
      prompt: 'Which sentence is correct?',
      options: ['In der Nacht schlafe ich.', 'In der Nacht ich schlafe.', 'Ich schlafe in der Nacht.'],
      correct: 'In der Nacht schlafe ich.',
    },
    {
      prompt: 'Which sentence is correct?',
      options: ['Am Montag geht er zur Schule.', 'Am Montag er geht zur Schule.', 'Geht er am Montag zur Schule.'],
      correct: 'Am Montag geht er zur Schule.',
    },
    {
      prompt: 'Which sentence is correct?',
      options: ['Heute trinke ich Kaffee.', 'Heute ich trinke Kaffee.', 'Ich trinke heute Kaffee.'],
      correct: 'Heute trinke ich Kaffee.',
    },
    {
      prompt: 'Which sentence is correct?',
      options: ['Im Sommer fahren wir ans Meer.', 'Im Sommer wir fahren ans Meer.', 'Fahren wir im Sommer ans Meer.'],
      correct: 'Im Sommer fahren wir ans Meer.',
    },
  ],
  // DATIVE (Module 12 — "mit dem Bus"). Dative was used from Module 7 onward
  // (am Montag, im Januar, zur Arbeit are all an+dem / in+dem / zu+dem) but was
  // never taught and never checked — the largest hole in the course. Every
  // option here is the FULL phrase so the contraction itself is drilled, not
  // just the case ending.
  dative: [
    { prompt: 'Ich fahre ___ Bus. (mit)', options: ['mit dem', 'mit der', 'mit den'], correct: 'mit dem' },
    { prompt: 'Wir treffen uns ___ Bahnhof. (an)', options: ['am', 'an dem', 'auf dem'], correct: 'am' },
    { prompt: 'Sie arbeitet ___ Computer. (an)', options: ['am', 'an der', 'im'], correct: 'am' },
    { prompt: 'Das Kind spielt ___ Garten. (in)', options: ['im', 'in dem', 'in den'], correct: 'im' },
    { prompt: 'Ich gehe ___ Arbeit. (zu)', options: ['zur', 'zu der', 'zum'], correct: 'zur' },
    { prompt: 'Er geht ___ Strand. (zu)', options: ['zum', 'zur', 'zu dem'], correct: 'zum' },
    { prompt: 'Die Kinder gehen ___ Schule. (zu)', options: ['zur', 'zum', 'zu den'], correct: 'zur' },
    { prompt: 'Wie geht es ___? (to me)', options: ['dir', 'Sie', 'ihnen'], correct: 'dir' },
    { prompt: 'Ich gebe ___ Bruder das Buch.', options: ['meinem', 'mein', 'meine'], correct: 'meinem' },
    { prompt: 'Wir trinken ___ Tee. (mit)', options: ['mit dem', 'mit der', 'mit das'], correct: 'mit dem' },
  ],
  // Two-way prepositions (Wechselpräpositionen) + the standard contractions.
  // in/an take the ACCUSATIVE for movement toward a destination and the DATIVE
  // for a fixed location — the most-missed A1 structure there is, and the one
  // the A2 "and the reasons behind it" note on the level grid promises is next.
  prepositions: [
    { prompt: 'Ich gehe ___ Park. (in — movement)', options: ['in den', 'im', 'in dem'], correct: 'in den' },
    { prompt: 'Ich bin ___ Park. (in — location)', options: ['im', 'in den', 'in das'], correct: 'im' },
    { prompt: 'Die Flasche steht ___ Tisch. (an — location)', options: ['auf dem', 'auf den', 'in dem'], correct: 'auf dem' },
    { prompt: 'Er stellt die Flasche ___ Tisch. (an — movement)', options: ['auf den', 'auf dem', 'im'], correct: 'auf den' },
    { prompt: 'in + das =', options: ['im', 'am', 'zum'], correct: 'im' },
    { prompt: 'zu + das =', options: ['zum', 'zur', 'im'], correct: 'zum' },
    { prompt: 'zu + die =', options: ['zur', 'zum', 'am'], correct: 'zur' },
    { prompt: 'an + dem =', options: ['am', 'im', 'ans'], correct: 'am' },
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
  // Das Perfekt (Module 15) — the spoken past tense. Two-part frame: the
  // auxiliary (haben/sein) sits in position 2, the Partizip II goes last.
  // These drill the AUXILIARY choice and the participle form, which are the two
  // things a beginner actually gets wrong (sein vs. haben; ge-…-en vs. ge-…-t).
  perfekt: [
    { prompt: 'Die Sonne hat gestern ___ (scheinen).', options: ['geschienen', 'gescheint', 'geschehnen'], correct: 'geschienen' },
    { prompt: 'Ich ___ nach Hause gegangen. (sein or haben?)', options: ['bin', 'habe'], correct: 'bin' },
    { prompt: 'Wir ___ Fußball gespielt. (sein or haben?)', options: ['haben', 'sind'], correct: 'haben' },
    { prompt: 'Er hat ein Buch ___ (lesen).', options: ['gelesen', 'liest', 'gelesent'], correct: 'gelesen' },
    { prompt: 'Sie ist zum Bahnhof ___ (gehen).', options: ['gegangen', 'gegeht', 'gegangt'], correct: 'gegangen' },
    { prompt: 'Ich ___ heute gearbeitet. (sein or haben?)', options: ['habe', 'bin'], correct: 'habe' },
    { prompt: 'haben + ___ (machen)', options: ['gemacht', 'gemachet', 'gemahct'], correct: 'gemacht' },
    { prompt: 'Du bist spät ___ (kommen).', options: ['gekommen', 'gekomt', 'gekommt'], correct: 'gekommen' },
    { prompt: 'Hat es heute ___ (regnen)?', options: ['geregnet', 'regent', 'geregent'], correct: 'geregnet' },
    { prompt: 'Ich habe dich gestern ___ (sehen).', options: ['gesehen', 'sah', 'gesehent'], correct: 'gesehen' },
    { prompt: 'Sie ___ mit dem Zug gefahren. (sein or haben?)', options: ['ist', 'hat'], correct: 'ist' },
    { prompt: 'haben + ___ (spielen)', options: ['gespielt', 'gespieltet', 'gespilen'], correct: 'gespielt' },
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
    { id: 'vocab-trans-5', type: 'vocabulary-translation', timeLimit: 5000, english: 'cat', german: 'Katze', options: ['Katze', 'Hund', 'Baum'] },
    { id: 'vocab-trans-6', type: 'vocabulary-translation', timeLimit: 5000, english: 'table', german: 'Tisch', options: ['Tisch', 'Stuhl', 'Fenster'] },
    { id: 'vocab-trans-7', type: 'vocabulary-translation', timeLimit: 5000, english: 'street', german: 'Straße', options: ['Straße', 'Zug', 'Berg'] },
    { id: 'vocab-trans-8', type: 'vocabulary-translation', timeLimit: 5000, english: 'child', german: 'Kind', options: ['Kind', 'Name', 'Tag'] },
    { id: 'vocab-trans-9', type: 'vocabulary-translation', timeLimit: 5000, english: 'bread', german: 'Brot', options: ['Brot', 'Wasser', 'Milch'] },
    { id: 'vocab-trans-10', type: 'vocabulary-translation', timeLimit: 5000, english: 'doctor', german: 'Arzt', options: ['Arzt', 'Bäcker', 'Polizist'] },
    { id: 'vocab-trans-11', type: 'vocabulary-translation', timeLimit: 5000, english: 'morning', german: 'Morgen', options: ['Morgen', 'Abend', 'Nacht'] },
    { id: 'vocab-trans-12', type: 'vocabulary-translation', timeLimit: 5000, english: 'city', german: 'Stadt', options: ['Stadt', 'Land', 'Haus'] },
  ],
  'audio-comprehension': [
    { id: 'audio-comp-1', type: 'audio-comprehension', timeLimit: 6000, word: 'Haus', meaning: 'house', options: ['house', 'home', 'yard'] },
    { id: 'audio-comp-2', type: 'audio-comprehension', timeLimit: 6000, word: 'Buch', meaning: 'book', options: ['book', 'table', 'chair'] },
    { id: 'audio-comp-3', type: 'audio-comprehension', timeLimit: 6000, word: 'Freund', meaning: 'friend', options: ['friend', 'teacher', 'doctor'] },
    { id: 'audio-comp-4', type: 'audio-comprehension', timeLimit: 6000, word: 'Wasser', meaning: 'water', options: ['water', 'milk', 'juice'] },
    { id: 'audio-comp-5', type: 'audio-comprehension', timeLimit: 6000, word: 'Katze', meaning: 'cat', options: ['cat', 'dog', 'bird'] },
    { id: 'audio-comp-6', type: 'audio-comprehension', timeLimit: 6000, word: 'Tisch', meaning: 'table', options: ['table', 'chair', 'door'] },
    { id: 'audio-comp-7', type: 'audio-comprehension', timeLimit: 6000, word: 'Schule', meaning: 'school', options: ['school', 'church', 'hotel'] },
    { id: 'audio-comp-8', type: 'audio-comprehension', timeLimit: 6000, word: 'Brot', meaning: 'bread', options: ['bread', 'butter', 'cheese'] },
    { id: 'audio-comp-9', type: 'audio-comprehension', timeLimit: 6000, word: 'Zug', meaning: 'train', options: ['train', 'bus', 'bike'] },
    { id: 'audio-comp-10', type: 'audio-comprehension', timeLimit: 6000, word: 'Stadt', meaning: 'city', options: ['city', 'village', 'country'] },
    { id: 'audio-comp-11', type: 'audio-comprehension', timeLimit: 6000, word: 'Arzt', meaning: 'doctor', options: ['doctor', 'teacher', 'driver'] },
    { id: 'audio-comp-12', type: 'audio-comprehension', timeLimit: 6000, word: 'Kind', meaning: 'child', options: ['child', 'friend', 'neighbour'] },
  ],
  'article-precision': [
    { id: 'article-1', type: 'article-precision', timeLimit: 4000, noun: 'Apfel', article: 'der' },
    { id: 'article-2', type: 'article-precision', timeLimit: 4000, noun: 'Tisch', article: 'der' },
    { id: 'article-3', type: 'article-precision', timeLimit: 4000, noun: 'Tür', article: 'die' },
    { id: 'article-4', type: 'article-precision', timeLimit: 4000, noun: 'Haus', article: 'das' },
    { id: 'article-5', type: 'article-precision', timeLimit: 4000, noun: 'Katze', article: 'die' },
    { id: 'article-6', type: 'article-precision', timeLimit: 4000, noun: 'Stuhl', article: 'der' },
    { id: 'article-7', type: 'article-precision', timeLimit: 4000, noun: 'Fenster', article: 'das' },
    { id: 'article-8', type: 'article-precision', timeLimit: 4000, noun: 'Brot', article: 'das' },
    { id: 'article-9', type: 'article-precision', timeLimit: 4000, noun: 'Schule', article: 'die' },
    { id: 'article-10', type: 'article-precision', timeLimit: 4000, noun: 'Zug', article: 'der' },
    { id: 'article-11', type: 'article-precision', timeLimit: 4000, noun: 'Arzt', article: 'der' },
    { id: 'article-12', type: 'article-precision', timeLimit: 4000, noun: 'Kind', article: 'das' },
  ],
  'number-conversion': [
    { id: 'number-1', type: 'number-conversion', timeLimit: 5000, number: 5, germanText: 'fünf', direction: 'digit-to-text', options: ['fünf', 'zehn', 'eins'] },
    { id: 'number-2', type: 'number-conversion', timeLimit: 5000, number: 12, germanText: 'zwölf', direction: 'text-to-digit', options: ['12', '21', '2'] },
    { id: 'number-3', type: 'number-conversion', timeLimit: 5000, number: 20, germanText: 'zwanzig', direction: 'digit-to-text', options: ['zwanzig', 'fünfzehn', 'dreißig'] },
    { id: 'number-4', type: 'number-conversion', timeLimit: 5000, number: 30, germanText: 'dreißig', direction: 'text-to-digit', options: ['30', '31', '20'] },
    { id: 'number-5', type: 'number-conversion', timeLimit: 5000, number: 7, germanText: 'sieben', direction: 'digit-to-text', options: ['sieben', 'acht', 'neun'] },
    { id: 'number-6', type: 'number-conversion', timeLimit: 5000, number: 14, germanText: 'vierzehn', direction: 'text-to-digit', options: ['14', '41', '4'] },
    { id: 'number-7', type: 'number-conversion', timeLimit: 5000, number: 40, germanText: 'vierzig', direction: 'digit-to-text', options: ['vierzig', 'vierzehn', 'fünfzig'] },
    { id: 'number-8', type: 'number-conversion', timeLimit: 5000, number: 17, germanText: 'siebzehn', direction: 'text-to-digit', options: ['17', '71', '7'] },
    { id: 'number-9', type: 'number-conversion', timeLimit: 5000, number: 9, germanText: 'neun', direction: 'digit-to-text', options: ['neun', 'sieben', 'zehn'] },
    { id: 'number-10', type: 'number-conversion', timeLimit: 5000, number: 25, germanText: 'fünfundzwanzig', direction: 'text-to-digit', options: ['25', '52', '2'] },
    { id: 'number-11', type: 'number-conversion', timeLimit: 5000, number: 16, germanText: 'sechzehn', direction: 'digit-to-text', options: ['sechzehn', 'sechszehn', 'siebzehn'] },
    { id: 'number-12', type: 'number-conversion', timeLimit: 5000, number: 11, germanText: 'elf', direction: 'text-to-digit', options: ['11', '1', '111'] },
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
    { id: 'pron-5', type: 'pronunciation-reading', timeLimit: 7000, text: 'Katze', meaning: 'cat', audio: 'Katze', options: ['Katze', 'Karte', 'Kasse'] },
    { id: 'pron-6', type: 'pronunciation-reading', timeLimit: 7000, text: 'Tisch', meaning: 'table', audio: 'Tisch', options: ['Tisch', 'Tasche', 'Fisch'] },
    { id: 'pron-7', type: 'pronunciation-reading', timeLimit: 7000, text: 'Schule', meaning: 'school', audio: 'Schule', options: ['Schule', 'Schlüssel', 'Schuhe'] },
    { id: 'pron-8', type: 'pronunciation-reading', timeLimit: 7000, text: 'Brot', meaning: 'bread', audio: 'Brot', options: ['Brot', 'Bord', 'Brett'] },
    { id: 'pron-9', type: 'pronunciation-reading', timeLimit: 7000, text: 'Zug', meaning: 'train', audio: 'Zug', options: ['Zug', 'Zuck', 'Buck'] },
    { id: 'pron-10', type: 'pronunciation-reading', timeLimit: 7000, text: 'Stadt', meaning: 'city', audio: 'Stadt', options: ['Stadt', 'Stark', 'Stack'] },
    { id: 'pron-11', type: 'pronunciation-reading', timeLimit: 7000, text: 'Arzt', meaning: 'doctor', audio: 'Arzt', options: ['Arzt', 'Art', 'Erde'] },
    { id: 'pron-12', type: 'pronunciation-reading', timeLimit: 7000, text: 'Kind', meaning: 'child', audio: 'Kind', options: ['Kind', 'Kino', 'Kiste'] },
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
