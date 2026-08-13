/**
 * A1-level German micro-stories incorporating learned vocabulary
 * from Numbers, Calendar, Greetings, and basic phrases.
 */

export interface StoryWord {
  de: string;
  ne: string;
  en: string;
}

export interface StorySentence {
  id: string;
  de: string;
  ne: string;
  en: string;
  words: StoryWord[];
}

export interface MicroStory {
  id: string;
  title: string;
  titleNe: string;
  titleEn: string;
  level: 'A1';
  sentences: StorySentence[];
}

export const microStories: MicroStory[] = [
  {
    id: 'story-1',
    title: 'Morgenroutine',
    titleNe: 'बिहानको दिनचर्या',
    titleEn: 'Morning Routine',
    level: 'A1',
    sentences: [
      {
        id: 's1-1',
        de: 'Guten Morgen!',
        ne: 'शुभ प्रभात!',
        en: 'Good morning!',
        words: [
          { de: 'Guten', ne: 'शुभ', en: 'Good' },
          { de: 'Morgen', ne: 'बिहान', en: 'morning' },
        ],
      },
      {
        id: 's1-2',
        de: 'Heute ist Montag.',
        ne: 'आज सोमबार हो।',
        en: 'Today is Monday.',
        words: [
          { de: 'Heute', ne: 'आज', en: 'Today' },
          { de: 'ist', ne: 'हो', en: 'is' },
          { de: 'Montag', ne: 'सोमबार', en: 'Monday' },
        ],
      },
      {
        id: 's1-3',
        de: 'Es ist das Jahr 2026.',
        ne: 'यो २०२६ साल हो।',
        en: 'It is the year 2026.',
        words: [
          { de: 'Es', ne: 'यो', en: 'It' },
          { de: 'ist', ne: 'हो', en: 'is' },
          { de: 'das', ne: '', en: 'the' },
          { de: 'Jahr', ne: 'वर्ष', en: 'year' },
        ],
      },
    ],
  },
  {
    id: 'story-2',
    title: 'Im Café',
    titleNe: 'क्याफेमा',
    titleEn: 'At the Café',
    level: 'A1',
    sentences: [
      {
        id: 's2-1',
        de: 'Hallo! Wie geht es dir?',
        ne: 'नमस्ते! तिमीलाई कस्तो छ?',
        en: 'Hello! How are you?',
        words: [
          { de: 'Hallo', ne: 'नमस्ते', en: 'Hello' },
          { de: 'Wie', ne: 'कसरी', en: 'How' },
          { de: 'geht', ne: 'जान्छ', en: 'goes' },
          { de: 'es', ne: 'यो', en: 'it' },
          { de: 'dir', ne: 'तिमीलाई', en: 'you' },
        ],
      },
      {
        id: 's2-2',
        de: 'Danke, gut!',
        ne: 'धन्यवाद, राम्रो!',
        en: 'Thank you, good!',
        words: [
          { de: 'Danke', ne: 'धन्यवाद', en: 'Thank you' },
          { de: 'gut', ne: 'राम्रो', en: 'good' },
        ],
      },
      {
        id: 's2-3',
        de: 'Auf Wiedersehen!',
        ne: 'फेरी भेटौंला!',
        en: 'Goodbye!',
        words: [
          { de: 'Auf', ne: '', en: 'On/Until' },
          { de: 'Wiedersehen', ne: 'फेरी भेट्ने', en: 'seeing again' },
        ],
      },
    ],
  },
  {
    id: 'story-3',
    title: 'Die Woche',
    titleNe: 'हप्ता',
    titleEn: 'The Week',
    level: 'A1',
    sentences: [
      {
        id: 's3-1',
        de: 'Montag, Dienstag, Mittwoch.',
        ne: 'सोमबार, मंगलबार, बुधबार।',
        en: 'Monday, Tuesday, Wednesday.',
        words: [
          { de: 'Montag', ne: 'सोमबार', en: 'Monday' },
          { de: 'Dienstag', ne: 'मंगलबार', en: 'Tuesday' },
          { de: 'Mittwoch', ne: 'बुधबार', en: 'Wednesday' },
        ],
      },
      {
        id: 's3-2',
        de: 'Ich lerne jeden Tag Deutsch.',
        ne: 'म हरेक दिन जर्मन सिक्छु।',
        en: 'I learn German every day.',
        words: [
          { de: 'Ich', ne: 'म', en: 'I' },
          { de: 'lerne', ne: 'सिक्छु', en: 'learn' },
          { de: 'jeden', ne: 'हरेक', en: 'every' },
          { de: 'Tag', ne: 'दिन', en: 'day' },
          { de: 'Deutsch', ne: 'जर्मन', en: 'German' },
        ],
      },
    ],
  },
];
