import type { ArticleItem } from '../types';
import nouns from './nouns.json';

/**
 * Article nouns dataset — extracted to `src/data/nouns.json` for expandability.
 * Re-exported as `articlesData` to preserve existing consumers
 * (sharedContent.ts, localCurriculumService.ts, GlossaryPage.tsx).
 */
export const articlesData: ArticleItem[] = nouns as ArticleItem[];