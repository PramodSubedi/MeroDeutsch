/**
 * src/data/emailTemplates.ts
 *
 * Goethe A1 "Schreiben" email-builder data (NotebookLM workbook mechanic).
 *
 * Four guided writing tasks — Einladung, Zusage, Absage, Termin verschieben
 * ("später kommen") — each with:
 *   - an informal vs formal register (the recipient decides the greeting)
 *   - 3 mandatory content points (each = pick the correct Redemittel chip)
 *   - closings that must match the register
 *   - a full model answer + Redemittel glossary for the review step
 *
 * Client-side UI data (same role as a1Verbs.ts / uhrzeit.ts) — NOT a DB seed.
 * Exactly one chip per point carries `correct: true`; greetings/closings carry
 * a `formal` flag used for teaching (the correct pick is marked directly).
 */

export interface EmailChoice {
  de: string;
  en: string;
  ne?: string;
  /** The right pick for this step (one or two acceptable picks). */
  correct?: boolean;
  /** Register tag for greetings/closings (teaching only). */
  formal?: boolean;
}

export interface EmailPoint {
  id: string;
  label: { en: string; de: string };
  choices: EmailChoice[];
}

export type EmailTaskType = 'einladung' | 'zusage' | 'absage' | 'termin';

export interface EmailTask {
  id: string;
  type: EmailTaskType;
  title: { en: string; de: string };
  prompt: { de: string; en: string; ne: string };
  recipient: { name: string; formal: boolean };
  greetingOptions: EmailChoice[];
  closingOptions: EmailChoice[];
  points: EmailPoint[];
  /** Full model email assembled from the correct picks. */
  model: string;
  /** Redemittel glossary shown with the model. */
  vocabulary: { de: string; en: string; ne: string }[];
}

export const EMAIL_TASKS: EmailTask[] = [
  {
    id: 'einladung-lena',
    type: 'einladung',
    title: { en: 'Invitation (informal)', de: 'Einladung (informell)' },
    prompt: {
      de: 'Schreibe Lena eine E-Mail. Lade sie zu deiner Geburtstagsparty ein. Schreibe: Warum schreibst du? Wann und wo ist die Party? Bitte sie um Antwort.',
      en: 'Write an email to Lena. Invite her to your birthday party. Include: why you are writing, when and where the party is, and ask her to reply.',
      ne: 'लेनालाई ईमेल लेख्नुहोस्। तिमी जन्मदिन पार्टीमा निमन्त्रणा दिनुहोस्: किन लेख्दैछौ, पार्टी कहिले र कहाँ छ, र जवाफ माग्नुहोस्।',
    },
    recipient: { name: 'Lena', formal: false },
    greetingOptions: [
      { de: 'Liebe Lena,', en: 'Dear Lena (female, informal)', ne: 'प्रिय लेना', correct: true, formal: false },
      { de: 'Lieber Lena,', en: 'Dear Lena — wrong gender form (Lena is female → Liebe)', ne: 'लिङ्ग गलत', formal: false },
      { de: 'Sehr geehrte Frau Lena,', en: 'Dear Ms Lena — far too formal for a friend', ne: 'अत्यन्त औपचारिक', formal: true },
      { de: 'Hallo Chef,', en: 'Hi boss — wrong recipient', formal: false },
    ],
    closingOptions: [
      { de: 'Liebe Grüße', en: 'Warm regards (informal)', ne: 'मायाले', correct: true, formal: false },
      { de: 'Viele Grüße', en: 'Best wishes (informal)', ne: 'धेरै शुभकामना', correct: true, formal: false },
      { de: 'Mit freundlichen Grüßen', en: 'Yours sincerely (formal — too stiff for a friend)', ne: 'औपचारिक', formal: true },
      { de: 'Hochachtungsvoll', en: 'Respectfully (very formal, outdated)', ne: 'अति औपचारिक', formal: true },
    ],
    points: [
      {
        id: 'was',
        label: { en: 'Why are you writing?', de: 'Warum schreibst du?' },
        choices: [
          { de: 'Ich feiere am Samstag meinen Geburtstag.', en: "I'm celebrating my birthday on Saturday.", ne: 'म शनिबार मेरो जन्मदिन मनाउँदै छु।', correct: true },
          { de: 'Ich habe am Samstag leider keine Zeit.', en: 'Unfortunately I have no time on Saturday.', ne: 'शनिबार मसँग समय छैन।' },
          { de: 'Ich wohne seit drei Jahren in Bonn.', en: 'I have lived in Bonn for three years.', ne: 'म तीन वर्षदेखि बोनमा बस्छु।' },
        ],
      },
      {
        id: 'wann-wo',
        label: { en: 'When and where is the party?', de: 'Wann und wo ist die Party?' },
        choices: [
          { de: 'Die Party ist um 18 Uhr bei mir zu Hause.', en: 'The party is at 6 pm at my place.', ne: 'पार्टी साँझ ६ बजे मेरो घरमा हुन्छ।', correct: true },
          { de: 'Ich stehe jeden Tag um sechs Uhr auf.', en: 'I get up at six every day.', ne: 'म हरेक दिन छ बजे उठ्छु।' },
          { de: 'Der Zug kommt um acht Uhr an.', en: 'The train arrives at eight.', ne: 'रेल आठ बजे आउँछ।' },
        ],
      },
      {
        id: 'bitte',
        label: { en: 'Ask her to reply', de: 'Bitte um Antwort' },
        choices: [
          { de: 'Schreib mir bitte, ob du kommst.', en: 'Please write and tell me if you are coming.', ne: 'कृपया आउँछौ कि आउँदैनौ भनेर लेख।', correct: true },
          { de: 'Mach bitte das Fenster zu.', en: 'Please close the window.', ne: 'कृपया झ्याल बन्द गर।' },
          { de: 'Bezahl bitte die Rechnung.', en: 'Please pay the bill.', ne: 'कृपया बिल तिर।' },
        ],
      },
    ],
    model: 'Liebe Lena,\n\nich feiere am Samstag meinen Geburtstag. Die Party ist um 18 Uhr bei mir zu Hause.\n\nSchreib mir bitte, ob du kommst.\n\nLiebe Grüße',
    vocabulary: [
      { de: 'eine Party feiern', en: 'to celebrate a party', ne: 'पार्टी मनाउनु' },
      { de: 'bei mir zu Hause', en: 'at my place', ne: 'मेरो घरमा' },
      { de: 'Schreib mir bitte, ob …', en: 'Please write whether …', ne: 'कृपया लेख कि …' },
    ],
  },
  {
    id: 'zusage-mayer',
    type: 'zusage',
    title: { en: 'Accept an invitation (formal)', de: 'Zusage (formell)' },
    prompt: {
      de: 'Frau Mayer, Ihre Lehrerin, hat Sie zum Schulfest eingeladen. Schreiben Sie: Danken Sie ihr. Sagen Sie, dass Sie kommen. Fragen Sie nach der genauen Zeit.',
      en: 'Ms Mayer, your teacher, invited you to the school festival. Write: thank her, say you are coming, and ask for the exact time.',
      ne: 'तपाईंकी शिक्षिका फ्राउ मायरले विद्यालय महोत्सवमा निमोठाउनुभयो। लेख्नुहोस्: धन्यवाद दिनुहोस्, आउनुहुन्छ भन्नुहोस्, र सही समय सोध्नुहोस्।',
    },
    recipient: { name: 'Frau Mayer', formal: true },
    greetingOptions: [
      { de: 'Sehr geehrte Frau Mayer,', en: 'Dear Ms Mayer (formal — correct here)', ne: 'आदरणीय फ्राउ मायर', correct: true, formal: true },
      { de: 'Liebe Frau Mayer,', en: 'Dear Ms Mayer (too personal for this exam task)', ne: 'अलि व्यक्तिगत', formal: false },
      { de: 'Hallo Mayer,', en: 'Hi Mayer — far too casual', ne: 'धेरै अनौपचारिक', formal: false },
      { de: 'Lieber Herr Mayer,', en: 'Dear Mr Mayer — wrong person AND wrong form', ne: 'गलत व्यक्ति', formal: false },
    ],
    closingOptions: [
      { de: 'Mit freundlichen Grüßen', en: 'Yours sincerely (formal — correct here)', ne: 'सादर', correct: true, formal: true },
      { de: 'Liebe Grüße', en: 'Warm regards (informal — too personal)', ne: 'अनौपचारिक', formal: false },
      { de: 'Bis bald!', en: 'See you soon! (no closing formula in a formal email)', ne: 'औपचारिक बन्द छैन', formal: false },
      { de: 'Tschüss!', en: 'Bye! (informal)', ne: 'अनौपचारिक', formal: false },
    ],
    points: [
      {
        id: 'danken',
        label: { en: 'Thank her for the invitation', de: 'Für die Einladung danken' },
        choices: [
          { de: 'Vielen Dank für die Einladung zum Schulfest.', en: 'Many thanks for the invitation to the school festival.', ne: 'विद्यालय महोत्सवको निमन्त्रणाका लागि धन्यवाद।', correct: true },
          { de: 'Ich kann leider nicht kommen.', en: "Unfortunately I can't come.", ne: 'म आउन सक्दिनँ।' },
          { de: 'Wie geht es Ihnen?', en: 'How are you?', ne: 'तपाईंलाई कस्तो छ?' },
        ],
      },
      {
        id: 'zusagen',
        label: { en: 'Say that you are coming', de: 'Zusagen' },
        choices: [
          { de: 'Ich komme sehr gern zum Schulfest.', en: "I'd be very glad to come to the school festival.", ne: 'म खुसीसाथ आउँछु।', correct: true },
          { de: 'Ich habe an diesem Tag keine Zeit.', en: 'I have no time on that day.', ne: 'त्यो दिन मसँग समय छैन।' },
          { de: 'Das Fest gefällt mir nicht.', en: "I don't like the festival.", ne: 'महोत्सव मनपर्दैन।' },
        ],
      },
      {
        id: 'zeit',
        label: { en: 'Ask for the exact time', de: 'Nach der genauen Zeit fragen' },
        choices: [
          { de: 'Um wie viel Uhr beginnt das Fest?', en: 'What time does the festival start?', ne: 'महोत्सव कति बजे सुरु हुन्छ?', correct: true },
          { de: 'Wo ist der Bahnhof?', en: 'Where is the train station?', ne: 'स्टेशन कहाँ छ?' },
          { de: 'Wie viel kostet ein Kaffee?', en: 'How much is a coffee?', ne: 'कफीको कति?' },
        ],
      },
    ],
    model: 'Sehr geehrte Frau Mayer,\n\nvielen Dank für die Einladung zum Schulfest. Ich komme sehr gern.\n\nUm wie viel Uhr beginnt das Fest?\n\nMit freundlichen Grüßen',
    vocabulary: [
      { de: 'vielen Dank für', en: 'many thanks for', ne: '…का लागि धन्यवाद' },
      { de: 'Ich komme gern.', en: "I'd be glad to come.", ne: 'म खुसीसाथ आउँछु।' },
      { de: 'Um wie viel Uhr …?', en: 'At what time …?', ne: 'कति बजे …?' },
    ],
  },
  {
    id: 'absage-max',
    type: 'absage',
    title: { en: 'Decline an invitation (informal)', de: 'Absage (informell)' },
    prompt: {
      de: 'Max hat dich zum Fußballspielen am Sonntag eingeladen. Du kannst nicht. Schreibe: Dank für die Einladung. Sag, dass du nicht kannst. Gib einen Grund.',
      en: 'Max invited you to play football on Sunday. You cannot go. Write: thanks for the invitation, say you cannot come, give a reason.',
      ne: 'म्याक्सले तिमीलाई आइतबार फुटबल खेल्न बोलायो। तिमी जान सक्दैनौ। लेख्नुहोस्: धन्यवाद, जान नसकिने कुरा, र कारण।',
    },
    recipient: { name: 'Max', formal: false },
    greetingOptions: [
      { de: 'Lieber Max,', en: 'Dear Max (male, informal)', ne: 'प्रिय म्याक्स', correct: true, formal: false },
      { de: 'Liebe Max,', en: 'Dear Max — wrong gender form (Max is male → Lieber)', ne: 'लिङ्ग गलत', formal: false },
      { de: 'Sehr geehrter Herr Max,', en: 'Dear Mr Max — too formal between friends', ne: 'धेरै औपचारिक', formal: true },
      { de: 'Hallo Frau Max,', en: 'Hi Ms Max — wrong person', ne: 'गलत व्यक्ति', formal: false },
    ],
    closingOptions: [
      { de: 'Viele Grüße', en: 'Best wishes (informal)', ne: 'धेरै शुभकामना', correct: true, formal: false },
      { de: 'Liebe Grüße', en: 'Warm regards (informal)', ne: 'मायाले', correct: true, formal: false },
      { de: 'Mit freundlichen Grüßen', en: 'Yours sincerely (formal — too stiff here)', ne: 'औपचारिक', formal: true },
      { de: 'Hochachtungsvoll', en: 'Respectfully (very formal)', ne: 'अति औपचारिक', formal: true },
    ],
    points: [
      {
        id: 'danken',
        label: { en: 'Thank him for the invitation', de: 'Für die Einladung danken' },
        choices: [
          { de: 'Danke für die Einladung zum Fußballspielen!', en: 'Thanks for inviting me to play football!', ne: 'फुटबल खेल्न बोलाउनुभएकोमा धन्यवाद!', correct: true },
          { de: 'Ich habe dich leider vergessen.', en: 'Unfortunately I forgot about you.', ne: 'मैले तिमीलाई बिर्सें।' },
          { de: 'Wie heißt deine Schwester?', en: "What's your sister's name?", ne: 'तिम्रो दिदीको नाम के हो?' },
        ],
      },
      {
        id: 'absagen',
        label: { en: 'Say that you cannot come', de: 'Absagen' },
        choices: [
          { de: 'Ich kann leider am Sonntag nicht kommen.', en: "Unfortunately I can't come on Sunday.", ne: 'आइतबार म आउन सक्दिनँ।', correct: true },
          { de: 'Ich komme sehr gern mit.', en: "I'd love to come along.", ne: 'म खुसीसाथ आउँछु।' },
          { de: 'Wir treffen uns um drei Uhr.', en: "We'll meet at three.", ne: 'हामी तीन बजे भेट्छौं।' },
        ],
      },
      {
        id: 'grund',
        label: { en: 'Give a reason', de: 'Einen Grund geben' },
        choices: [
          { de: 'Ich muss am Wochenende arbeiten.', en: 'I have to work at the weekend.', ne: 'सप्ताहन्तमा मैले काम गर्नुपर्छ।', correct: true },
          { de: 'Das Wetter ist heute schön.', en: 'The weather is nice today.', ne: 'आज मौसम राम्रो छ।' },
          { de: 'Ich spiele sehr gern Fußball.', en: 'I really like playing football.', ne: 'मलाई फुटबल खेल्न मनपर्छ।' },
        ],
      },
    ],
    model: 'Lieber Max,\n\ndanke für die Einladung zum Fußballspielen! Ich kann leider am Sonntag nicht kommen. Ich muss am Wochenende arbeiten.\n\nViele Grüße',
    vocabulary: [
      { de: 'leider … nicht können', en: "unfortunately can't …", ne: 'दुःखले … गर्न सक्दिनँ' },
      { de: 'Ich muss arbeiten.', en: 'I have to work.', ne: 'मैले काम गर्नुपर्छ।' },
      { de: 'Ein anderes Mal!', en: 'Another time!', ne: 'अर्को पटक!' },
    ],
  },
  {
    id: 'termin-schulz',
    type: 'termin',
    title: { en: 'Postpone an appointment (formal)', de: 'Termin verschieben (formell)' },
    prompt: {
      de: 'Sie haben heute einen Termin bei Dr. Schulz, aber Sie kommen später. Schreiben Sie: Sie können heute nicht kommen. Nennen Sie einen Grund. Fragen Sie nach einem neuen Termin.',
      en: "You have an appointment with Dr. Schulz today, but you cannot make it. Write: you cannot come today, give a reason, ask for a new appointment.",
      ne: 'आज डा. शुल्जसँग भेटघाट छ, तर तपाईं आउन सक्नुहुन्न। लेख्नुहोस्: आज आउन नसकिने, कारण, र नयाँ मिति सोध्नुहोस्।',
    },
    recipient: { name: 'Herr Dr. Schulz', formal: true },
    greetingOptions: [
      { de: 'Sehr geehrter Herr Dr. Schulz,', en: 'Dear Dr. Schulz (male, formal — correct)', ne: 'आदरणीय डा. शुल्ज', correct: true, formal: true },
      { de: 'Sehr geehrte Frau Dr. Schulz,', en: 'Dear Dr. Schulz — wrong gender form', ne: 'लिङ्ग गलत', formal: true },
      { de: 'Lieber Schulz,', en: 'Dear Schulz — too informal for the doctor', ne: 'धेरै अनौपचारिक', formal: false },
      { de: 'Hallo Doktor,', en: 'Hi doc — too casual', ne: 'अनौपचारिक', formal: false },
    ],
    closingOptions: [
      { de: 'Mit freundlichen Grüßen', en: 'Yours sincerely (formal — correct here)', ne: 'सादर', correct: true, formal: true },
      { de: 'Liebe Grüße', en: 'Warm regards (informal)', ne: 'अनौपचारिक', formal: false },
      { de: 'Bis dann!', en: 'See you! (no closing formula in a formal email)', ne: 'औपचारिक बन्द छैन', formal: false },
      { de: 'Ciao!', en: 'Ciao! (informal)', ne: 'अनौपचारिक', formal: false },
    ],
    points: [
      {
        id: 'heute',
        label: { en: "Say you can't come today", de: 'Sagen, dass Sie heute nicht kommen' },
        choices: [
          { de: 'Ich kann leider heute nicht in die Praxis kommen.', en: "Unfortunately I can't come to the practice today.", ne: 'आज म आउन सक्दिनँ।', correct: true },
          { de: 'Ich komme jeden Tag in die Praxis.', en: 'I come to the practice every day.', ne: 'म हरेक दिन आउँछु।' },
          { de: 'Die Praxis ist sehr schön.', en: 'The practice is very nice.', ne: 'क्लिनिक धेरै राम्रो छ।' },
        ],
      },
      {
        id: 'grund',
        label: { en: 'Give a reason', de: 'Einen Grund nennen' },
        choices: [
          { de: 'Ich bin krank und muss im Bett bleiben.', en: "I'm sick and have to stay in bed.", ne: 'म बिरामी छु, ओछ्यानमा बस्नुपर्छ।', correct: true },
          { de: 'Ich spiele gern Fußball.', en: 'I like playing football.', ne: 'मलाई फुटबल मनपर्छ।' },
          { de: 'Das Wetter ist schlecht.', en: 'The weather is bad.', ne: 'मौसम खराब छ।' },
        ],
      },
      {
        id: 'neuer-termin',
        label: { en: 'Ask for a new appointment', de: 'Nach einem neuen Termin fragen' },
        choices: [
          { de: 'Können wir einen neuen Termin finden?', en: 'Could we find a new appointment?', ne: 'नयाँ मिति मिलाउन सकिन्छ?', correct: true },
          { de: 'Wo ist der nächste Supermarkt?', en: 'Where is the next supermarket?', ne: 'नजिकैको सुपरमार्केट कहाँ छ?' },
          { de: 'Wie viel kostet das Medikament?', en: 'How much is the medicine?', ne: 'औषधिको कति?' },
        ],
      },
    ],
    model: 'Sehr geehrter Herr Dr. Schulz,\n\nich kann leider heute nicht in die Praxis kommen. Ich bin krank und muss im Bett bleiben.\n\nKönnen wir einen neuen Termin finden?\n\nMit freundlichen Grüßen',
    vocabulary: [
      { de: 'einen Termin verschieben', en: 'to postpone an appointment', ne: 'भेटघाट सार्नु' },
      { de: 'krank sein', en: 'to be sick', ne: 'बिरामी हुनु' },
      { de: 'einen neuen Termin finden', en: 'find a new appointment', ne: 'नयाँ मिति खोज्नु' },
    ],
  },
];

/** Find one task by id (unknown/null falls back to the first task). */
export function getEmailTask(id: string | null): EmailTask {
  return EMAIL_TASKS.find((t) => t.id === id) ?? EMAIL_TASKS[0];
}

/* ── Point Evaluator (Goethe A1 Schreiben — "grade a sample email") ────────
 * Phase D mechanics: the learner acts as the examiner. Each round shows a
 * flawed sample student email + 4 line-item judges (greeting register,
 * comma/lowercase rule, all 3 mandatory points, closing register). The learner
 * decides "met" vs "not met" per rule; wrong judgments are queued to SRS
 * (module 'email-evaluator' → errorTag 'spelling'). All samples are
 * hand-verified so every `satisfied` flag is unambiguous.
 */

export interface EvaluationRule {
  id: string;
  label: { en: string; de: string };
  /** True when the sample email satisfies this rule. */
  satisfied: boolean;
  /** Teaching hint (EN + NE; hidden in Nur DE). */
  hint: { en: string; de: string; ne?: string };
}

export interface EvaluationRound {
  id: string;
  title: { en: string; de: string };
  taskPrompt: { en: string; de: string; ne?: string };
  /** The register the exam task demanded (what we grade against). */
  expectedRegister: 'formal' | 'informal';
  /** The flawed student submission under review. */
  studentEmail: string;
  rules: EvaluationRule[];
}

export const EVALUATION_ROUNDS: EvaluationRound[] = [
  {
    id: 'grade-einladung-lena',
    title: { en: 'Invitation (informal)', de: 'Einladung (informell)' },
    taskPrompt: {
      en: 'Invite your friend Lena to your birthday party: why you are writing, when and where the party is, and ask her to reply.',
      de: 'Lade deine Freundin Lena zu deiner Geburtstagsparty ein: Warum du schreibst, wann und wo die Party ist, und bitte um Antwort.',
      ne: 'साथी लेनालाई जन्मदिन पार्टीमा बोलाउनुहोस्: किन, कहिले/कहाँ, र जवाफ माग्नुहोस्।',
    },
    expectedRegister: 'informal',
    studentEmail:
      'Sehr geehrte Frau Lena,\n\nWir feiern am Samstag meinen Geburtstag. Die Party ist um 18 Uhr bei mir zu Hause.\n\nLiebe Grüße\nMax',
    rules: [
      {
        id: 'greeting',
        label: { en: 'Greeting uses the right register (informal friend → Liebe Lena,)', de: 'Anrede im richtigen Register (Freundin → Liebe Lena,)' },
        satisfied: false,
        hint: {
          en: 'Lena is a friend — use "Liebe Lena,". "Sehr geehrte Frau Lena," is far too formal.',
          de: 'Lena ist eine Freundin — nimm "Liebe Lena,". "Sehr geehrte Frau Lena," ist viel zu formell.',
          ne: 'लेना साथी हुन् — "Liebe Lena," लेख्नुपर्छ।',
        },
      },
      {
        id: 'lowercase',
        label: { en: 'Lowercase after the greeting comma', de: 'Nach dem Anrede-Komma klein weiterschreiben' },
        satisfied: false,
        hint: {
          en: 'After the greeting comma you continue lowercase: "Liebe Lena,\n\nwir feiern…". "Wir" is wrong here.',
          de: 'Nach dem Komma der Anrede schreibt man klein weiter: "Liebe Lena,\n\nwir feiern…".',
          ne: 'अभिवादनपछि सानो अक्षरबाट सुरु गर्नुपर्छ।',
        },
      },
      {
        id: 'points',
        label: { en: 'All 3 mandatory points present (reason, when/where, ask to reply)', de: 'Alle 3 Pflichtpunkte (Grund, wann/wo, Antwort-Bitte)' },
        satisfied: false,
        hint: {
          en: 'Two points are there, but the reply request ("Schreib mir bitte, ob du kommst.") is missing.',
          de: 'Zwei Punkte sind da, aber die Bitte um Antwort fehlt.',
          ne: 'जवाफ माग्ने बुँदा छुटेको छ।',
        },
      },
      {
        id: 'closing',
        label: { en: 'Closing fits the register', de: 'Grußformel passt zum Register' },
        satisfied: true,
        hint: {
          en: '"Liebe Grüße" is a correct informal closing.',
          de: '"Liebe Grüße" ist ein passender informeller Schluss.',
          ne: '"Liebe Grüße" अनौपचारिक बन्दका लागि ठिक छ।',
        },
      },
    ],
  },
{
    id: 'grade-zusage-mayer',
    title: { en: 'Acceptance (formal)', de: 'Zusage (formell)' },
    taskPrompt: {
      en: 'Ms Mayer, your teacher, invited you to the school festival: thank her, say you are coming, and ask for the exact time.',
      de: 'Frau Mayer hat dich zum Schulfest eingeladen: Danke sagen, zusagen, nach der Zeit fragen.',
      ne: 'शिक्षिकालाई धन्यवाद, आउने भन्ने, र समय सोध्ने।',
    },
    expectedRegister: 'formal',
    studentEmail:
      'Liebe Frau Mayer,\n\nvielen Dank für die Einladung zum Schulfest. Ich komme sehr gern.\n\nMit freundlichen Grüßen\nAnna',
    rules: [
      {
        id: 'greeting',
        label: { en: 'Greeting uses the right register (teacher → Sehr geehrte Frau Mayer,)', de: 'Anrede im richtigen Register (Lehrerin → Sehr geehrte Frau Mayer,)' },
        satisfied: false,
        hint: {
          en: 'The teacher needs the formal greeting "Sehr geehrte Frau Mayer," — "Liebe Frau Mayer," is too personal here.',
          de: 'Für die Lehrerin nimmt man "Sehr geehrte Frau Mayer," – "Liebe Frau Mayer," ist zu persönlich.',
          ne: 'शिक्षिकाका लागि औपचारिक अभिवादन चाहिन्छ।',
        },
      },
      {
        id: 'lowercase',
        label: { en: 'Lowercase after the greeting comma', de: 'Nach dem Anrede-Komma klein weiterschreiben' },
        satisfied: true,
        hint: {
          en: '"vielen Dank" correctly starts lowercase after the comma.',
          de: '"vielen Dank" beginnt nach dem Komma korrekt klein.',
          ne: 'अभिवादनपछि सानो अक्षर सही छ।',
        },
      },
      {
        id: 'points',
        label: { en: 'All 3 mandatory points present (thanks, accept, ask time)', de: 'Alle 3 Pflichtpunkte (Dank, Zusage, Zeit-Frage)' },
        satisfied: false,
        hint: {
          en: 'Thanks and acceptance are there — the time question ("Um wie viel Uhr beginnt das Fest?") is missing.',
          de: 'Dank und Zusage sind da — die Frage nach der Zeit fehlt.',
          ne: 'समय सोध्ने प्रश्न छुटेको छ।',
        },
      },
      {
        id: 'closing',
        label: { en: 'Closing fits the register', de: 'Grußformel passt zum Register' },
        satisfied: true,
        hint: {
          en: '"Mit freundlichen Grüßen" is the correct formal closing.',
          de: '"Mit freundlichen Grüßen" ist der richtige formelle Schluss.',
          ne: '"Mit freundlichen Grüßen" औपचारिकको लागि सही छ।',
        },
      },
    ],
  },
  {
    id: 'grade-absage-max',
    title: { en: 'Decline (informal)', de: 'Absage (informell)' },
    taskPrompt: {
      en: 'Max invited you to play football on Sunday. Decline: thank him, say you cannot come, give a reason.',
      de: 'Max hat dich zum Fußballspielen eingeladen. Schreib ab: Danke, Absage, Grund.',
      ne: 'म्याक्सको निमन्त्रणा अस्वीकार गर्ने: धन्यवाद, नसकिने, कारण।',
    },
    expectedRegister: 'informal',
    studentEmail:
      'Lieber Max,\n\nvielen Dank für die Einladung. Leider kann ich nicht kommen. Ich habe am Sonntag keine Zeit.\n\nMit freundlichen Grüßen\nTom',
    rules: [
      {
        id: 'greeting',
        label: { en: 'Greeting uses the right register (friend → Lieber Max,)', de: 'Anrede im richtigen Register (Freund → Lieber Max,)' },
        satisfied: true,
        hint: {
          en: '"Lieber Max," correctly matches the informal register.',
          de: '"Lieber Max," passt korrekt zum informellen Register.',
          ne: '"Lieber Max," सही छ।',
        },
      },
      {
        id: 'points',
        label: { en: 'All mandatory points present (thanks, decline, reason)', de: 'Alle Pflichtpunkte (Dank, Absage, Grund)' },
        satisfied: false,
        hint: {
          en: 'Thanks and decline are there, but no reason is given (e.g. "Ich muss arbeiten.").',
          de: 'Dank und Absage sind da, aber ein Grund fehlt (z. B. "Ich muss arbeiten.").',
          ne: 'कारण दिइएको छैन।',
        },
      },
      {
        id: 'closing',
        label: { en: 'Closing fits the register', de: 'Grußformel passt zum Register' },
        satisfied: false,
        hint: {
          en: '"Mit freundlichen Grüßen" is formal — a friend gets "Viele Grüße" or "Bis bald!"',
          de: '"Mit freundlichen Grüßen" ist formell — einem Freund schreibt man "Viele Grüße" oder "Bis bald!".',
          ne: 'साथीलाई अनौपचारिक बन्द चाहिन्छ।',
        },
      },
    ],
  },
{
    id: 'grade-termin-schulz',
    title: { en: 'Postpone an appointment (formal)', de: 'Termin verschieben (formell)' },
    taskPrompt: {
      en: 'You have an appointment with Dr. Schulz today but cannot make it: say you cannot come, give a reason, ask for a new appointment.',
      de: 'Sie haben heute einen Termin bei Dr. Schulz, können aber nicht: Absage, Grund, neuer Termin.',
      ne: 'आज आउन नसकिने, कारण, र नयाँ मितिको अनुरोध।',
    },
    expectedRegister: 'formal',
    studentEmail:
      'Sehr geehrter Herr Dr. Schulz,\n\nich kann leider heute nicht in die Praxis kommen. ich bin krank und muss im Bett bleiben.\n\nMit freundlichen Grüßen\nAnna',
    rules: [
      {
        id: 'greeting',
        label: { en: 'Greeting uses the right register (doctor → Sehr geehrter Herr Dr. Schulz,)', de: 'Anrede im richtigen Register (Arzt → Sehr geehrter Herr Dr. Schulz,)' },
        satisfied: true,
        hint: {
          en: '"Sehr geehrter Herr Dr. Schulz," is the correct formal greeting.',
          de: '"Sehr geehrter Herr Dr. Schulz," ist die richtige formelle Anrede.',
          ne: 'औपचारिक अभिवादन सही छ।',
        },
      },
      {
        id: 'capital',
        label: { en: 'New sentences start with a capital letter', de: 'Satzanfänge groß schreiben' },
        satisfied: false,
        hint: {
          en: '"…kommen. ich bin krank." — after a full stop the next word is capitalized: "Ich bin krank."',
          de: '"…kommen. ich bin krank." — nach dem Punkt groß: "Ich bin krank."',
          ne: 'पूर्णविरामपछि ठूलो अक्षर हुनुपर्छ।',
        },
      },
      {
        id: 'points',
        label: { en: 'All mandatory points present (apologize/decline, reason, new appointment)', de: 'Alle Pflichtpunkte (Absage, Grund, neuer Termin)' },
        satisfied: false,
        hint: {
          en: 'The request for a new appointment ("Können wir einen neuen Termin finden?") is missing.',
          de: 'Die Bitte um einen neuen Termin fehlt.',
          ne: 'नयाँ मितिको अनुरोध छुटेको छ।',
        },
      },
      {
        id: 'closing',
        label: { en: 'Closing fits the register', de: 'Grußformel passt zum Register' },
        satisfied: true,
        hint: {
          en: '"Mit freundlichen Grüßen" is the correct formal closing.',
          de: '"Mit freundlichen Grüßen" ist der richtige formelle Schluss.',
          ne: 'औपचारिक बन्द सही छ।',
        },
      },
    ],
  },
  {
    id: 'grade-einladung-weber',
    title: { en: 'Invitation (formal)', de: 'Einladung (formell)' },
    taskPrompt: {
      en: 'Invite your class teacher Mrs Weber to the school festival: why, when and where, and ask her to reply.',
      de: 'Lade deine Klassenlehrerin Frau Weber zum Schulfest ein: Grund, wann/wo, Bitte um Antwort.',
      ne: 'शिक्षिकालाई महोत्सवमा बोलाउनुहोस्: किन, कहिले/कहाँ, जवाफ।',
    },
    expectedRegister: 'formal',
    studentEmail:
      'Liebe Frau Weber,\n\nWir organisieren ein Schulfest und möchten Sie herzlich einladen. Das Fest ist am Freitag um 15 Uhr in der Aula.\n\nViele Grüße\nAnna',
    rules: [
      {
        id: 'greeting',
        label: { en: 'Greeting uses the right register (teacher → Sehr geehrte Frau Weber,)', de: 'Anrede im richtigen Register (Lehrerin → Sehr geehrte Frau Weber,)' },
        satisfied: false,
        hint: {
          en: 'The teacher requires the formal "Sehr geehrte Frau Weber," — "Liebe Frau Weber," is too personal.',
          de: 'Die Lehrerin verlangt "Sehr geehrte Frau Weber," – "Liebe Frau Weber," ist zu persönlich.',
          ne: 'शिक्षिकाका लागि औपचारिक अभिवादन चाहिन्छ।',
        },
      },
      {
        id: 'lowercase',
        label: { en: 'Lowercase after the greeting comma', de: 'Nach dem Anrede-Komma klein weiterschreiben' },
        satisfied: false,
        hint: {
          en: 'After "Liebe Frau Weber,\n\n" the next word must be lowercase: "wir organisieren…".',
          de: 'Nach "Liebe Frau Weber,\n\n" schreibt man klein weiter: "wir organisieren…".',
          ne: 'अभिवादनपछि सानो अक्षर हुनुपर्छ।',
        },
      },
      {
        id: 'points',
        label: { en: 'All mandatory points present (invitation, when/where, reply)', de: 'Alle Pflichtpunkte (Einladung, wann/wo, Antwort)' },
        satisfied: false,
        hint: {
          en: 'The reply request is missing ("Bitte antworten Sie mir, ob Sie kommen können.").',
          de: 'Die Bitte um Antwort fehlt.',
          ne: 'जवाफ माग्ने बुँदा छैन।',
        },
      },
      {
        id: 'closing',
        label: { en: 'Closing fits the register', de: 'Grußformel passt zum Register' },
        satisfied: false,
        hint: {
          en: '"Viele Grüße" is too casual for the teacher — use "Mit freundlichen Grüßen".',
          de: '"Viele Grüße" ist zu leger für die Lehrerin — nimm "Mit freundlichen Grüßen".',
          ne: '"Viele Grüße" पर्याप्त औपचारिक छैन।',
        },
      },
    ],
  },
];