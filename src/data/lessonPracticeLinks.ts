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
  0: [
    { toolId: 'roleplay', why: { en: 'Practise greeting someone and replying politely', de: 'Begrüße jemanden und antworte höflich' } },
    { toolId: 'pronunciation', why: { en: 'Hear du vs. Sie stressed the way a German says it', de: 'Höre du vs. Sie so betont, wie ein Deutscher es sagt' } },
    { toolId: 'dictation', why: { en: 'Type what you hear in short introductions', de: 'Tippe, was du bei kurzen Vorstellungen hörst' } },
  ],
  1: [
    { toolId: 'numbers', why: { en: 'Rules for reading prices and quantities aloud', de: 'Regeln zum laut Lesen von Preisen und Mengen' } },
    { toolId: 'rapid', why: { en: 'Fast number-conversion reps', de: 'Schnelle Übungen zur Zahlumwandlung' } },
    { toolId: 'vocab-trainer', why: { en: 'Lock in counting words and currency', de: 'Zahlwörter und Währung festigen' } },
  ],
  2: [
    { toolId: 'alphabet', why: { en: 'The full letter set, including umlauts and ß', de: 'Das ganze Alphabet inklusive Umlauten und ß' } },
    { toolId: 'pronunciation', why: { en: 'Sound shifts that change how letters are said', de: 'Lautwandel, der Buchstaben anders klingen lässt' } },
    { toolId: 'dictation', why: { en: 'Spell what you hear, letter by letter', de: 'Buchstabiere, was du hörst' } },
  ],
  3: [
    { toolId: 'vocab-trainer', why: { en: 'Family words with their articles and genders', de: 'Familienwörter mit Artikel und Genus' } },
    { toolId: 'stories', why: { en: 'Read a family story for context', de: 'Lese eine Familiengeschichte zum Kontext' } },
    { toolId: 'roleplay', why: { en: 'Talk about your own family out loud', de: 'Spreche laut über deine eigene Familie' } },
  ],
  7: [
    { toolId: 'grammar', why: { en: 'Verb tables and the V2 slot', de: 'Verbtabellen und die V2-Stelle' } },
    { toolId: 'sentence-builder', why: { en: 'Build V2 sentences until the order is automatic', de: 'Bilde V2-Sätze, bis die Stellung sitzt' } },
    { toolId: 'article-sprint', why: { en: 'Fast drills on this grammar pattern', de: 'Schnellübungen zu diesem Muster' } },
  ],
  8: [
    { toolId: 'sentence-builder', why: { en: 'Put the prefix back at the end of the clause', de: 'Setze das trennbare Verb ans Satzende' } },
    { toolId: 'grammar', why: { en: 'The common separable prefixes', de: 'Die häufigsten trennbaren Vorsilben' } },
    { toolId: 'dictation', why: { en: 'Hear routine sentences and place the verb', de: 'Höre Alltagssätze und setze das Verb' } },
  ],
  9: [
    { toolId: 'roleplay', why: { en: 'Order food and drink in a café', de: 'Bestelle Essen und Trinken im Café' } },
    { toolId: 'sentence-builder', why: { en: 'Move the direct object into the accusative', de: 'Setze das Akkusativ-Objekt richtig' } },
    { toolId: 'article-sprint', why: { en: 'Short case drills on nouns you meet here', de: 'Kurzübungen zu den Nomen dieser Lektion' } },
  ],
  10: [
    { toolId: 'vocab-trainer', why: { en: 'Clothes, colours and demonstratives', de: 'Kleidung, Farben und Demonstrativa' } },
    { toolId: 'roleplay', why: { en: 'Ask for a size and try something on', de: 'Frage nach einer Größe und probiere an' } },
    { toolId: 'rapid', why: { en: 'Quick recall of shopping vocabulary', de: 'Schnelles Abrufen von Einkaufsvokabeln' } },
  ],
  11: [
    { toolId: 'roleplay', why: { en: 'Ask a stranger for directions', de: 'Frage einen Fremden nach dem Weg' } },
    { toolId: 'dictation', why: { en: 'Hear station and street names and spell them', de: 'Höre Bahnhofs- und Straßennamen und schreibe sie' } },
    { toolId: 'vocab-trainer', why: { en: 'Places and transport nouns', de: 'Orte und Verkehrsmittel' } },
  ],
  12: [
    { toolId: 'grammar', why: { en: 'Modal verb tables and the bracket', de: 'Modalverbtable und der Satzklammer' } },
    { toolId: 'sentence-builder', why: { en: 'Put modal and verb in the right order', de: 'Setze Modalverb und Verb richtig' } },
    { toolId: 'games', why: { en: 'Play your way through modal sentences', de: 'Spiele dich durch Modalverb-Sätze' } },
  ],
  13: [
    { toolId: 'vocab-trainer', why: { en: 'Body parts and symptoms', de: 'Körperteile und Beschwerden' } },
    { toolId: 'roleplay', why: { en: 'Describe symptoms at an appointment', de: 'Beschreibe Beschwerden beim Termin' } },
    { toolId: 'dictation', why: { en: 'Hear a complaint and write it down', de: 'Höre eine Beschwerde und schreibe sie' } },
  ],
  14: [
    { toolId: 'stories', why: { en: 'Narrative text in the perfect tense', de: 'Erzähltext im Perfekt' } },
    { toolId: 'grammar', why: { en: 'Past participles and word order', de: 'Partizip Perfekt und Satzstellung' } },
    { toolId: 'rapid', why: { en: 'Fast recall of past-tense forms', de: 'Schnelles Abrufen der Vergangenheitsformen' } },
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
