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

/* ────────────────────────────────────────────────────────────────────────────
 * Pure time-phrase generators (Clock Drill — CalendarPage "Uhr" tab).
 *
 * Same role as TIME_PHRASES above: client-side data/logic, NOT a DB seed.
 * The generators back the dual time-telling drill (NotebookLM workbook
 * mechanic): official 24-hour time vs casual 12-hour spoken time, plus the
 * Nepali bridge — which, like German, counts toward the NEXT hour
 * (halb eins = साढे बाह्र = 12:30; English "half past" is the odd one out).
 * ────────────────────────────────────────────────────────────────────────── */

/** German number words 0–100 (A1 set, hand-verified). */
const DE_NUMBERS: Record<number, string> = {
  0: 'null', 1: 'eins', 2: 'zwei', 3: 'drei', 4: 'vier', 5: 'fünf', 6: 'sechs',
  7: 'sieben', 8: 'acht', 9: 'neun', 10: 'zehn', 11: 'elf', 12: 'zwölf',
  13: 'dreizehn', 14: 'vierzehn', 15: 'fünfzehn', 16: 'sechzehn', 17: 'siebzehn',
  18: 'achtzehn', 19: 'neunzehn', 20: 'zwanzig', 30: 'dreißig', 40: 'vierzig',
  50: 'fünfzig', 60: 'sechzig', 70: 'siebzig', 80: 'achtzig', 90: 'neunzig',
  100: 'hundert',
};

/** Spell a number 0–100 in German words (e.g. 23 → "dreiundzwanzig"). */
export function numberToGermanWords(n: number): string {
  const v = Math.max(0, Math.min(100, Math.round(n)));
  const direct = DE_NUMBERS[v];
  if (direct) return direct;
  const ones = v % 10;
  const tens = v - ones;
  const onesWord = ones === 1 ? 'ein' : DE_NUMBERS[ones];
  return `${onesWord}und${DE_NUMBERS[tens]}`;
}

/** Nepali number words 1–12 (matches the TIME_PHRASES glosses above). */
const NE_HOURS: Record<number, string> = {
  1: 'एक', 2: 'दुई', 3: 'तीन', 4: 'चार', 5: 'पाँच', 6: 'छ',
  7: 'सात', 8: 'आठ', 9: 'नौ', 10: 'दस', 11: 'एघार', 12: 'बाह्र',
};

/** Minute steps the drill generates (multiples of five, the A1 standard). */
export const CLOCK_MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

/** ASCII digits → Devanagari digits ("25" → "२५"). */
function nepaliDigits(n: number): string {
  return String(n)
    .split('')
    .map((d) => '०१२३४५६७८९'[Number(d)] ?? d)
    .join('');
}

/**
 * Casual spoken German time (12-hour logic).
 * 9:50 → "Es ist zehn vor zehn". "halb X" = half TO the NEXT hour (the trap).
 */
export function spokenTimeWords(hour24: number, minute: number): string {
  const h = ((hour24 % 24) + 24) % 24;
  const next = (h % 12) + 1; // halb/viertel-vor reference hour (1–12)
  const cur = h % 12 === 0 ? 12 : h % 12;
  switch (minute) {
    case 0:
      return `Es ist ${numberToGermanWords(cur)} Uhr`;
    case 15:
      return `Es ist Viertel nach ${numberToGermanWords(cur)}`;
    case 30:
      return `Es ist halb ${numberToGermanWords(next)}`;
    case 45:
      return `Es ist Viertel vor ${numberToGermanWords(next)}`;
    default: {
      const m = Math.round(minute / 5) * 5;
      if (m < 30) return `Es ist ${numberToGermanWords(m)} nach ${numberToGermanWords(cur)}`;
      if (m === 25) return `Es ist fünf vor halb ${numberToGermanWords(next)}`;
      if (m === 35) return `Es ist fünf nach halb ${numberToGermanWords(next)}`;
      return `Es ist ${numberToGermanWords(60 - m)} vor ${numberToGermanWords(next)}`;
    }
  }
}

/** Official 24-hour time (timetables/appointments). 23:50 → "Es ist dreiundzwanzig Uhr fünfzig". */
export function officialTimeWords(hour24: number, minute: number): string {
  const h = ((hour24 % 24) + 24) % 24;
  const m = Math.max(0, Math.min(59, Math.round(minute / 5) * 5));
  return m === 0
    ? `Es ist ${numberToGermanWords(h)} Uhr`
    : `Es ist ${numberToGermanWords(h)} Uhr ${numberToGermanWords(m)}`;
}

/**
 * Nepali spoken time — the trilingual bridge. Like German, Nepali counts
 * toward the next hour: साढे बाह्र = 12:30, सवा तीन = 3:15, पौने चार = 3:45.
 */
export function nepaliTimeWords(hour24: number, minute: number): string {
  const h = ((hour24 % 24) + 24) % 24;
  const cur = h % 12 === 0 ? 12 : h % 12;
  const nextH = cur === 12 ? 1 : cur + 1;
  switch (minute) {
    case 0:
      return `${NE_HOURS[cur]} बजेको छ`;
    case 15:
      return `सवा ${NE_HOURS[cur]} बजेको छ`;
    case 30:
      return `साढे ${NE_HOURS[cur]} बजेको छ`;
    case 45:
      return `पौने ${NE_HOURS[nextH]} बजेको छ`;
    default: {
      const m = Math.round(minute / 5) * 5;
      return `${NE_HOURS[cur]} बजेर ${nepaliDigits(m)} मिनेट`;
    }
  }
}

/** Digital 24-hour clock face label ("23:50"). */
export function digitalTimeLabel(hour24: number, minute: number): string {
  const h = ((hour24 % 24) + 24) % 24;
  const m = Math.max(0, Math.min(59, Math.round(minute / 5) * 5));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}