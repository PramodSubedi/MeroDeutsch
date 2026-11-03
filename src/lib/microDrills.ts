/** src/lib/microDrills.ts - Deterministic in-chat mini drills. */

/** Drill types. */
export type DrillType = "articles" | "meaning" | "word_order" | "fix_mistake";

/** Create drill items for articles type. */
export function createArticleDrills(
  difficulty: "A1.1" | "A1.2" = "A1.1"
): DrillItem[] {
  const nounsA11 = [
    { word: "Haus", article: "der", gender: "m" },
    { word: "Tisch", article: "der", gender: "m" },
    { word: "Stuhl", article: "der", gender: "m" },
    { word: "Frau", article: "die", gender: "f" },
    { word: "Mann", article: "der", gender: "m" },
    { word: "Kind", article: "das", gender: "n" },
  ];
  const nounsA12 = [
    { word: "Buch", article: "das", gender: "n" },
    { word: "Stift", article: "der", gender: "m" },
    { word: "Radiergummi", article: "der", gender: "m" },
    { word: "Mappe", article: "die", gender: "f" },
    { word: "Brille", article: "die", gender: "f" },
    { word: "Uhr", article: "die", gender: "f" },
  ];

  const nouns = difficulty === "A1.1" ? nounsA11 : nounsA12;
  return nouns.map((n) => ({
    id: `art-${n.word}-${Math.random().toString(36).slice(2, 9)}`,
    prompt: `Welcher Artikel passt zu "${n.word}"?`,
    correct: n.article!,
    distractors: ["der", "die", "das"].filter((a) => a !== n.article!).slice(0, 2),
  }));
}

/** Create drill items for meaning match type. */
export function createMeaningDrills(count: number = 5): DrillItem[] {
  const vocab = [
    { lemma: "Haus", translation: "house" },
    { lemma: "Tisch", translation: "table" },
    { lemma: "Apfel", translation: "apple" },
    { lemma: "Buch", translation: "book" },
    { lemma: "Lampe", translation: "lamp" },
    { lemma: "Stuhl", translation: "chair" },
    { lemma: "Tür", translation: "door" },
    { lemma: "Fenster", translation: "window" },
  ];

  const selected = vocab.slice(0, count);
  return selected.map((v) => ({
    id: `vocab-${v.lemma}-${Math.random().toString(36).slice(2, 9)}`,
    prompt: `Was bedeutet "${v.lemma}"?`,
    correct: v.translation,
    distractors: [
      ...vocab
        .slice(0, count + 3)
        .filter((v2) => v2.translation !== v.translation)
        .map((v2) => v2.translation),
    ].slice(0, 3),
  }));
}

/** Create drill items for word-order scramble type. */
export function createWordOrderDrills(count: number = 5): DrillItem[] {
  const sentences = [
    { de: "Ich bin Anna.", words: ["Ich", "bin", "Anna"] },
    { de: "Das ist ein Haus.", words: ["Das", "ist", "ein", "Haus"] },
    { de: "Ich habe ein Buch.", words: ["Ich", "habe", "ein", "Buch"] },
  ];

  const selected = sentences.slice(0, count);
  return selected.map((s) => ({
    id: `wo-${s.de}-${Math.random().toString(36).slice(2, 9)}`,
    prompt: `Stelle die Wörter in die richtige Reihenfolge:`,
    correct: s.de,
    distractors: [],
  }));
}

/** Create drill items for fix-the-mistake type. */
export function createFixMistakeDrills(count: number = 5): DrillItem[] {
  const mistakes = [
    { prompt: "Ich bin Anna. Sie __ ein Student.", correct: "ist" },
    { prompt: "Er __ jeden Tag arbeiten.", correct: "arbeitet" },
    { prompt: "Wir __ heute in Berlin.", correct: "sind" },
    { prompt: "Ich __ gerne Deutsch.", correct: "lerne" },
    { prompt: "Das ist mein Hund. Er __ schwarz.", correct: "ist" },
  ];

  return mistakes.slice(0, count).map((m) => ({
    id: `mistake-${m.prompt}-${Math.random().toString(36).slice(2, 9)}`,
    prompt: m.prompt,
    correct: m.correct,
    distractors: ["ist", "arbeit", "lerne", "sind"].filter((d) => d !== m.correct),
  }));
}

/** Get drill items by type. */
export function getDrillItems(
  type: DrillType,
  difficulty: "A1.1" | "A1.2" = "A1.1",
  count: number = 5
): DrillItem[] {
  switch (type) {
    case "articles":
      return createArticleDrills(difficulty).slice(0, count);
    case "meaning":
      return createMeaningDrills(count);
    case "word_order":
      return createWordOrderDrills(count);
    case "fix_mistake":
      return createFixMistakeDrills(count);
    default:
      return [];
  }
}