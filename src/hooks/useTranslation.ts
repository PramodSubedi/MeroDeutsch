import { sharedTextDatabase, sharedTranslations } from '../data/sharedContent';
import type { LangMode } from '../types';

export type LocalizedText = { german: string; normal: string };

export function useTranslation(langMode: LangMode) {
  const isDE = langMode === 'german';

  const t = (source: LocalizedText) => source[langMode];

  return {
    isDE,
    t,
    sharedTextDatabase,
    sharedTranslations,
  };
}
