import { LocalCurriculumService } from './localCurriculumService';
import type { CurriculumService } from '../types/curriculum';

export const curriculumService: CurriculumService = new LocalCurriculumService();
