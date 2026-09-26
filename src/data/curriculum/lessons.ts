/**
 * src/data/curriculum/lessons.ts — lazy access to a unit's lesson material
 *
 * WHY THIS FILE EXISTS
 * Lesson content (the imported document material: 40-row lexicons, grammar deep
 * dives, traps, culture notes, dialogues, 25-question banks) is ~300 KB across the
 * 15 units. It used to sit inside the spine unit files, which meant it shipped in
 * the MAIN bundle to every visitor even though only /lesson/:index ever reads it.
 *
 * `import.meta.glob` with a LAZY glob (no `eager`) gives Vite a static map of
 * one loader function per file, and each file becomes its own async chunk — so
 * opening Lesson 4 downloads only Lesson 4. Nothing is fetched until a lesson is
 * actually opened, which is what keeps the offline-first promise intact: the
 * spine (the only thing the shell needs) is fully bundled.
 *
 * This module is APP-ONLY on purpose: `import.meta.glob` is a Vite transform and
 * would not survive under `tsx`, which is why the curriculum scripts keep working
 * with the spine files alone and read lesson files from disk.
 */
import type { UnitLessonContent } from './schema';

/** `./lessons/m04.json` → `() => Promise<{ default: UnitLessonContent }>` */
const LESSON_LOADERS = import.meta.glob<{ default: UnitLessonContent }>('./lessons/*.json');

/**
 * Load one unit's lesson. Resolves to `undefined` when the unit has no lesson
 * file — a normal state, not an error, so callers render an empty state rather
 * than treating it as a failure.
 */
export async function loadLesson(unitId: string): Promise<UnitLessonContent | undefined> {
  const load = LESSON_LOADERS[`./lessons/${unitId}.json`];
  if (!load) return undefined;
  const mod = await load();
  return mod.default;
}
