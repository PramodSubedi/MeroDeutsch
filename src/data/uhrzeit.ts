/**
 * src/data/uhrzeit.ts
 *
 * Telling-time phrase pool backing the Calendar "Uhrzeit" drill.
 * This is client-side UI data (same role as `a1Verbs.ts`) and is NOT a
 * database seed — time-vocabulary seeding belongs to Kilo's content pipeline.
 */
export interface UhrzeitItem {
  de: string;
  en: string;
  ne: string;
}

export const TIME_PHRASES: UhrzeitItem[] = [
  { de: 'Es ist ein Uhr', en: "It's one o'clock", ne: 'एक बजेको छ' },
  { de: 'Es ist zwei Uhr', en: "It's two o'clock", ne: 'दुई बजेको छ' },
  { de: 'Es ist drei Uhr', en: "It's three o'clock", ne: 'तीन बजेको छ' },
  { de: 'Es ist vier Uhr', en: "It's four o'clock", ne: 'चार बजेको छ' },
  { de: 'Es ist fünf Uhr', en: "It's five o'clock", ne: 'पाँच बजेको छ' },
  { de: 'Es ist sechs Uhr', en: "It's six o'clock", ne: 'छह बजेको छ' },
  { de: 'Es ist sieben Uhr', en: "It's seven o'clock", ne: 'सात बजेको छ' },
  { de: 'Es ist acht Uhr', en: "It's eight o'clock", ne: 'आठ बजेको छ' },
  { de: 'Es ist neun Uhr', en: "It's nine o'clock", ne: 'नौ बजेको छ' },
  { de: 'Es ist zehn Uhr', en: "It's ten o'clock", ne: 'दस बजेको छ' },
  { de: 'Es ist elf Uhr', en: "It's eleven o'clock", ne: 'एघार बजेको छ' },
  { de: 'Es ist zwölf Uhr', en: "It's twelve o'clock", ne: 'बाह्र बजेको छ' },
  { de: 'Es ist halb eins', en: "It's half past twelve", ne: 'साढे बाह्र बजेको छ' },
  { de: 'Es ist halb drei', en: "It's half past two", ne: 'साढे दुई बजेको छ' },
  { de: 'Es ist halb vier', en: "It's half past three", ne: 'साढे तीन बजेको छ' },
  { de: 'Es ist Viertel nach drei', en: "It's quarter past three", ne: 'सवा तीन बजेको छ' },
  { de: 'Es ist Viertel vor vier', en: "It's quarter to four", ne: 'पौने चार बजेको छ' },
  { de: 'Es ist fünf nach halb fünf', en: "It's five past half past four", ne: 'साढे चार बजेर पाँच मिनेट' },
  { de: 'Es ist zehn vor elf', en: "It's ten to eleven", ne: 'एघार बजन दस मिनेट' },
  { de: 'Es ist Mittag', en: "It's noon", ne: 'मध्याहन भयो' },
  { de: 'Es ist Mitternacht', en: "It's midnight", ne: 'मध्यरात भयो' },
];