import { SupabaseCurriculumService } from './supabaseCurriculumService';
import type { CurriculumService } from '../types/curriculum';

/**
 * Hybrid curriculum service: fetches dynamic content from Supabase (with local fallback).
 * Static content always uses local JSON data.
 */
export const curriculumService: CurriculumService = new SupabaseCurriculumService();
