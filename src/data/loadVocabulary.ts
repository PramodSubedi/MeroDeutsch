import coreA1 from './vocab/core-a1.json';
import food from './vocab/food.json';
import travel from './vocab/travel.json';

export interface VocabEntry {
  id: string;
  de: string;
  en: string;
  ne: string;
  tags: string[];
  level: 'A1';
  exampleDe?: string;
  audioId?: string;
}

const RAW: VocabEntry[] = [...coreA1, ...food, ...travel] as VocabEntry[];

/** Merge all JSON vocab files and dedupe by id (first occurrence wins). */
export function loadVocabulary(): VocabEntry[] {
  const seen = new Set<string>();
  const result: VocabEntry[] = [];
  for (const entry of RAW) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    result.push(entry);
  }
  return result;
}

export const vocabularyData = loadVocabulary();