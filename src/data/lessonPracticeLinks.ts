/**
 * src/data/lessonPracticeLinks.ts — which practice tools reinforce which lesson
 *
 * WHAT THIS IS FOR
 * The lesson page (`/lesson/:n`) is now where the actual STUDY happens: the
 * objectives, trilingual lexicon, grammar, traps, culture, dialogue and practice
 * bank imported from the curriculum documents. The standalone practice tools
 * (/greetings, /dictation, /roleplay, …) are NOT part of that lesson — they are
 * optional reinforcement you reach for afterwards. This file is the map that
 * lets the lesson page say "these three tools drill what you just read", in the
 * context rail, instead of burying the tools inside the roadmap.
 *
 * WHY THE TOOL ITSELF ISN'T DUPLICATED HERE
 * Only the tool `id` and a sentence explaining the REASON are stored. The path,
 * icon, skill and minute estimate are resolved at render time from
 * `config/modules.ts` + `config/routeLabels.ts`, which are the single sources of
 * truth for those. A tool that is renamed or retimed updates here for free; a
 * tool that is deleted simply stops resolving and is skipped.
 *
 * WHY THREE PER LESSON
 * Enough to cover the lesson's three skills (usually: recognise it, produce it,
 * hear it) without turning the rail into the /practice grid, which already
 * exists one click away.
 */
import { MODULES } from '../config/modules';

export interface LessonPracticeLink {
  /** Key into `config/modules.ts` → MODULES[].id */
  toolId: string;
  /** Why this tool suits THIS lesson. Localised; shown under the tool name. */
  why: { en: string; de: string };
}

/** A link after its tool has been resolved against the live module registry. */
export interface ResolvedLessonTool {
  toolId: string;
  path: string;
  Icon: (typeof MODULES)[number]['icon'];
  why: { en: string; de: string };
}

/**
 * Keyed by unit index (0-based, matching `A1_UNITS[].index` and the `:unitIndex`
 * route param). A unit with no entry simply shows no suggestions.
 *
 * The unit's own `nodes` in `units/mNN.json` already declare one `learn` and one
 * `practice` node. Those are deliberately NOT reused here: they were written when
 * the roadmap card was the lesson, and they point at the old "learn" destinations
 * rather than at reinforcement for material the learner has now read in full.
 */
export const LESSON_PRACTICE_LINKS: Readonly<Record<number, readonly LessonPracticeLink[]>> = {
  // 0 — M01 Greetings & Introductions
  0: [
    { toolId: 'roleplay', why: { en: 'Practise greeting someone and replying politely', de: 'Begrüße jemanden und antworte höflich' } },
    { toolId: 'pronunciation', why: { en: 'Hear du vs. Sie stressed the way a German says it', de: 'Höre du vs. Sie so betont, wie ein Deutscher es sagt' } },
    { toolId: 'dictation', why: { en: 'Type what you hear in short introductions', de: 'Tippe, was du bei kurzen Vorstellungen hörst' } },
  ],
  // 1 — M02 Numbers & Currency
  1: [
    { toolId: 'numbers', why: { en: 'Rules for reading prices and quantities aloud', de: 'Regeln zum laut Lesen von Preisen und Mengen' } },
    { toolId: 'rapid', why: { en: 'Fast number-conversion reps', de: 'Schnelle Übungen zur Zahlumwandlung' } },
    { toolId: 'vocab-trainer', why: { en: 'Lock in counting words and currency', de: 'Zahlwörter und Währung festigen' } },
  ],
  // 2 — M03 Alphabet & Personal Details
  2: [
    { toolId: 'alphabet', why: { en: 'The full letter set, including umlauts and ß', de: 'Das ganze Alphabet inklusive Umlauten und ß' } },
    { toolId: 'pronunciation', why: { en: 'Sound shifts that change how letters are said', de: 'Lautwandel, der Buchstaben anders klingen lässt' } },
    { toolId: 'dictation', why: { en: 'Spell what you hear, letter by letter', de: 'Buchstabiere, was du hörst' } },
  ],
  // 3 — M04 Family & Relationships
  3: [
    { toolId: 'vocab-trainer', why: { en: 'Family words with their articles and genders', de: 'Familienwörter mit Artikel und Genus' } },
    { toolId: 'stories', why: { en: 'Read a family story for context', de: 'Lese eine Familiengeschichte zum Kontext' } },
    { toolId: 'roleplay', why: { en: 'Talk about your own family out loud', de: 'Spreche laut über deine eigene Familie' } },
  ],
  // 4 — M05 Housing & Negation
  4: [
    { toolId: 'vocab-trainer', why: { en: 'Household nouns with der/die/das and kein', de: 'Haushaltswörter mit der/die/das und kein' } },
    { toolId: 'articles', why: { en: 'Nominative articles and kein- negation', de: 'Nominativartikel und kein-Negation' } },
    { toolId: 'roleplay', why: { en: 'Describe your flat and say what you do not have', de: 'Beschreibe deine Wohnung und sage, was du nicht hast' } },
  ],
  // 5 — M06 Present Tense Verb Conjugation
  5: [
    { toolId: 'grammar', why: { en: 'Conjugation tables and the personal endings', de: 'Konjugationstabellen und die Personalendungen' } },
    { toolId: 'vocab-trainer', why: { en: 'Verbs with their infinitive and stem', de: 'Verben mit Infinitiv und Stamm' } },
    { toolId: 'dictation', why: { en: 'Hear a verb and type its conjugated form', de: 'Höre ein Verb und tippe seine konjugierte Form' } },
  ],
  // 7 — M07 V2 Word Order & Sentence Topology
  6: [
    { toolId: 'grammar', why: { en: 'Verb tables and the V2 slot', de: 'Verbtabellen und die V2-Stelle' } },
    { toolId: 'sentence-builder', why: { en: 'Build V2 sentences until the order is automatic', de: 'Bilde V2-Sätze, bis die Stellung sitzt' } },
    { toolId: 'article-sprint', why: { en: 'Fast drills on this grammar pattern', de: 'Schnellübungen zu diesem Muster' } },
  ],
  // 8 — M08 Accusative Case & Direct Objects
  7: [
    { toolId: 'article-sprint', why: { en: 'Shift der → den and ein → einen on the object', de: 'Wandle der → den und ein → einen am Objekt' } },
    { toolId: 'articles', why: { en: 'The full nominative/accusative article table', de: 'Die komplette Tabelle Nominativ/Akkusativ' } },
    { toolId: 'sentence-builder', why: { en: 'Build direct objects into the accusative', de: 'Bilde Direktobjekte in den Akkusativ' } },
  ],
  // 9 — M09 Separable Verbs & Daily Routines
  8: [
    { toolId: 'sentence-builder', why: { en: 'Put the prefix back at the end of the clause', de: 'Setze das trennbare Verb ans Satzende' } },
    { toolId: 'grammar', why: { en: 'The common separable prefixes', de: 'Die häufigsten trennbaren Vorsilben' } },
    { toolId: 'dictation', why: { en: 'Hear routine sentences and place the verb', de: 'Höre Alltagssätze und setze das Verb' } },
  ],
  // 10 — M10 Restaurant, Food & Ordering
  9: [
    { toolId: 'roleplay', why: { en: 'Order food and drink in a café', de: 'Bestelle Essen und Trinken im Café' } },
    { toolId: 'vocab-trainer', why: { en: 'Food, drink and table nouns', de: 'Essen, Trinken und Tischwörter' } },
    { toolId: 'dictation', why: { en: 'Hear a polite order and write it back', de: 'Höre eine höfliche Bestellung und schreibe sie auf' } },
  ],
  // 11 — M11 Time, Calendar & Clock Inversion
  10: [
    { toolId: 'calendar', why: { en: 'Read the week, dates and appointments in German', de: 'Woche, Daten und Termine auf Deutsch lesen' } },
    { toolId: 'vocab-trainer', why: { en: 'Weekdays, months, seasons and clock words', de: 'Wochentage, Monate, Jahreszeiten und Uhrzeitwörter' } },
    { toolId: 'rapid', why: { en: 'Fast recall of halb / viertel clock forms', de: 'Schnelles Abrufen der halb-/viertel-Uhrzeitformen' } },
  ],
  // 12 — M12 Professions, Work & Modal Verbs
  11: [
    { toolId: 'grammar', why: { en: 'Modal verb tables and the bracket', de: 'Modalverbtable und der Satzklammer' } },
    { toolId: 'vocab-trainer', why: { en: 'Job titles and the feminine -in ending', de: 'Berufsbezeichnungen und die weibliche Endung -in' } },
    { toolId: 'sentence-builder', why: { en: 'Put modal and infinitive in the right order', de: 'Setze Modalverb und Infinitiv richtig' } },
  ],
  // 13 — M13 Shopping, Clothes & Demonstratives
  12: [
    { toolId: 'vocab-trainer', why: { en: 'Clothes, colours and demonstratives', de: 'Kleidung, Farben und Demonstrativa' } },
    { toolId: 'roleplay', why: { en: 'Ask for a size and try something on', de: 'Frage nach einer Größe und probiere an' } },
    { toolId: 'article-sprint', why: { en: 'Drill dieser/diese/dieses against der/die/das', de: 'Übe dieser/diese/dieses gegen der/die/das' } },
  ],
  // 14 — M14 City Navigation, Transport & Dative Prepositions
  13: [
    { toolId: 'roleplay', why: { en: 'Ask a stranger for directions', de: 'Frage einen Fremden nach dem Weg' } },
    { toolId: 'vocab-trainer', why: { en: 'Places, transport and dative prepositions', de: 'Orte, Verkehrsmittel und Dativpräpositionen' } },
    { toolId: 'article-sprint', why: { en: 'Fast drills on der → dem and die → der', de: 'Schnellübungen zu der → dem und die → der' } },
  ],
  // 15 — M15 Health, Hobbies, Weather & Past Tense (Perfekt)
  14: [
    { toolId: 'stories', why: { en: 'Narrative text in the perfect tense', de: 'Erzähltext im Perfekt' } },
    { toolId: 'grammar', why: { en: 'Past participles, haben/sein and word order', de: 'Partizip Perfekt, haben/sein und Satzstellung' } },
    { toolId: 'vocab-trainer', why: { en: 'Body parts, hobbies, weather and participles', de: 'Körperteile, Hobbys, Wetter und Partizipien' } },
  ],
  // 15 — M16 Comprehensive Practice & Final Review
  15: [
    { toolId: 'rapid', why: { en: 'Run the five integrated review exercises end to end', de: 'Die fünf integrierten Wiederholungsübungen durchlaufen' } },
    { toolId: 'grammar', why: { en: 'Revisit any rule table you scored below 80% on', de: 'Jede Regeltabelle erneut ansehen, bei der du unter 80 % lagst' } },
    { toolId: 'vocab-trainer', why: { en: 'Sweep the grammar vocab pools behind all 15 units', de: 'Die Grammatik-Vokabelpools aller 15 Einheiten durchgehen' } },
  ],
};

/** The tools for a lesson, or an empty list when it has none mapped. */
export function lessonPracticeLinks(unitIndex: number): readonly LessonPracticeLink[] {
  return LESSON_PRACTICE_LINKS[unitIndex] ?? [];
}

/**
 * A lesson's tools resolved against the live module registry.
 *
 * Kept here rather than in the component so the component file exports only
 * components. Unresolvable ids are DROPPED rather than returned as broken
 * links, so deleting a tool from `config/modules.ts` degrades the lesson page
 * gracefully instead of rendering a dead link.
 */
export function resolveLessonTools(unitIndex: number): ResolvedLessonTool[] {
  return lessonPracticeLinks(unitIndex).flatMap((link) => {
    const mod = MODULES.find((m) => m.id === link.toolId);
    if (!mod) return [];
    return [{ toolId: link.toolId, path: mod.path, Icon: mod.icon, why: link.why }];
  });
}
