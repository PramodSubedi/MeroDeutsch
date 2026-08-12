import type { NumberItem, NumberRange } from '../types';

export const numbersData: Record<NumberRange, NumberItem[]> = {
  '0-12': [
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
  ],
  '13-19': [
    { n: 13, de: 'dreizehn', engPh: 'dry-tsayn', nepPh: 'द्राई-त्सेन्', en: 'thirteen', ne: 'तेरह', note: 'drei + zehn' },
    { n: 14, de: 'vierzehn', engPh: 'feer-tsayn', nepPh: 'फीअर-त्सेन्', en: 'fourteen', ne: 'चौध' , note: 'vier + zehn' },
    { n: 15, de: 'fünfzehn', engPh: 'fuenf-tsayn', nepPh: 'फ्युन्फ्-त्सेन्', en: 'fifteen', ne: 'पन्ध्र' , note: 'fünf + zehn' },
    { n: 16, de: 'sechzehn', engPh: 'zex-tsayn', nepPh: 'ज़ेक्स-त्सेन्', en: 'sixteen', ne: 'सोह्र' , note: 'sechs + zehn' },
    { n: 17, de: 'siebzehn', engPh: 'zeep-tsayn', nepPh: 'ज़ीब्-त्सेन्', en: 'seventeen', ne: 'सत्र' , note: 'sieben + zehn' },
    { n: 18, de: 'achtzehn', engPh: 'ahkt-tsayn', nepPh: 'आख्त्-त्सेन्', en: 'eighteen', ne: 'अठार' , note: 'acht + zehn' },
    { n: 19, de: 'neunzehn', engPh: 'noin-tsayn', nepPh: 'नोइन्-त्सेन्', en: 'nineteen', ne: 'उन्नाइस' , note: 'neun + zehn' },
  ],
  '20-99': [
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
  ],
  '100plus': [
    { n: 100, de: 'hundert', engPh: 'hoon-dert', nepPh: 'हुन्डर्त्', en: 'one hundred', ne: 'एक सय', note: '100 = hundert' },
    { n: 101, de: 'hunderteins', engPh: 'hoon-dert-ine-ss', nepPh: 'हुन्डर्त्-आइन्स्', en: 'one hundred one', ne: 'एक सय एक', note: 'hundert + eins' },
    { n: 200, de: 'zweihundert', engPh: 'tsvy-hoon-dert', nepPh: 'त्स्वाइ-हुन्डर्त्', en: 'two hundred', ne: 'दुई सय', note: 'zwei + hundert' },
    { n: 1000, de: 'tausend', engPh: 'tow-zent', nepPh: 'ताउज़ेन्ट्', en: 'one thousand', ne: 'एक हजार', note: '1000 = tausend' },
    { n: 2000, de: 'zweitausend', engPh: 'tsvy-tow-zent', nepPh: 'त्स्वाइ-ताउज़ेन्ट्', en: 'two thousand', ne: 'दुई हजार', note: 'zwei + tausend' },
    { n: 1000000, de: 'eine Million', engPh: 'ine-eh mil-yohn', nepPh: 'आइने मिल्योन्', en: 'one million', ne: 'एक लाख', note: '1,000,000 = eine Million' },
  ],
};

export const numberRules: Record<NumberRange, string> = {
  '0-12': '',
  '13-19':
    '<strong>Regel 13–19:</strong> Einer + <em>zehn</em>. Beispiel: drei + zehn → <strong>dreizehn</strong>',
  '20-99':
    '<strong>Regel 21–99:</strong> Einer + <strong>und</strong> + Zehner. Beispiel: fünf + und + vierzig → <strong>fünfundvierzig</strong>',
  '100plus':
    '<strong>100</strong> = hundert · <strong>1000</strong> = tausend · <strong>1 000 000</strong> = eine Million',
};
