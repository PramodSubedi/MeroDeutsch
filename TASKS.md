# TASKS — MeroDeutsch Project Roadmap

## NOW

- **Glossary cleanup** — `GlossaryPage.tsx` imports 5 datasets from `sharedContent` directly. Consider routing through service methods.
- **Daily Challenge cleanup** — `DailyChallenge.tsx` component imports `alphabetData`, `numbersData` from `sharedContent`. Consider service usage.

## NEXT

- **Phase 2** — Standardize content types and stable IDs across all data files. Replace array-index-based keys with stable string IDs (e.g., `"a1-articles-tisch"`).
- **Phase 3** — Introduce curriculum metadata hierarchy (Level → Module → Lesson → Content).
- **Orphaned data files** — Remove `src/data/calendar.ts` and `src/data/greetings.ts` OR wire them in. `sharedContent.ts` currently defines inline duplicates of both.
- **Unused service methods** — `getSpellingWords()` and `getGrammarConjugations()` are defined but never called. Wire them to pages or remove if unnecessary.
- **Type cleanup** — `getVocabulary()` returns `Promise<any[]>`; define a proper `VocabularyItem` type. `DictationWord` interface duplicated in `data/dictation.ts` and `types/curriculum.ts`.

## LATER

- **Phase 4** — Local caching/offline curriculum architecture for data files.
- **Phase 5** — Replace `LocalCurriculumService` with API/Supabase/PostgreSQL implementation behind the same `CurriculumService` interface.
- **Phase 6** — Admin/content management capabilities.
- **Homepage redesign** — Guest and authenticated states (see AI_CONTEXT.md §19).
- **ContinueLearningPage enhancements** — Add progress summary + quick-access links to recent modules inside `/learn` (Phase B). The basic `/learn` route is already live.

## COMPLETED

### Per-User Progress Isolation + Guest UX Cleanup (2026-08-13)

- ✅ **Per-user localStorage scoping** — Created `src/utils/userStorage.ts` with `scopedKey(base, userId)` helper; modified `useProgress.ts`, `useReviewQueue.ts`, `useStreak.ts`, `useAchievements.ts` to scope all localStorage keys by user ID (`:userId` for auth, `:guest` for guests)
- ✅ **Supabase sync for user data** — Added cloud sync to 4 hooks: `user_progress`, `review_queue`, `user_streaks`, `user_achievements` tables; merge strategy (union for arrays, max for counters); authenticated users only
- ✅ **State reset on user change** — Added `useEffect` with scoped key dependency to reset state when user logs in/out/switches accounts
- ✅ **Guest homepage UX cleanup** — Removed floating Sign in button (max 2 entry points); hid streak chip for guests (`isAuthenticated && streakCount > 0` condition)
- ✅ **WOTD improvements** — Redesigned DailyChallenge header with prominent German word (`text-2xl font-bold`); improved collapse button text ("Hide/Show Word of the Day")
- ✅ **Accessibility compliance** — Added keyboard focus indicators to LearningPath module cards (`focus-visible:ring-2 focus-visible:ring-blue-500`) for WCAG 2.1 Level AA
- ✅ Verification: tsc PASS, build PASS (87 modules), lint 0 errors (7 pre-existing warnings), user isolation working correctly

### Phase A — Homepage + Learning Hub (2026-08-12)

- ✅ **LearningPath component** — Extracted A1 Learning Path from `HomePage.tsx` into `src/components/learning/LearningPath.tsx` (reusable, uses `useLang` + `sharedTextDatabase`)
- ✅ **ContinueLearningPage** — Created `src/pages/ContinueLearningPage.tsx` at `/learn` route; reuses `DailyChallenge` (WOTD), `LearningPath`, `PracticeToolsGrid`; includes Back-to-Home + Last Module CTA
- ✅ **Routing** — Added `/learn` route in `App.tsx` + `ContinueLearningPage` import
- ✅ **HomePage restructure** — Authenticated layout: Continue Learning → `/learn`; removed duplicated DailyChallenge + LearningPath. Guest layout: added DailyChallenge (WOTD) + extracted LearningPath (always visible)
- ✅ Verification: tsc PASS, build PASS (87 modules), lint 0 errors (7 pre-existing warnings), all 15 routes HTTP 200

### Phase 1 — Data Architecture Migration (2026-08-12)

- ✅ **Calendar** — `CalendarPage.tsx` migrated to `curriculumService.getCalendar()`; removed direct `calendarData` import; added async loading pattern
- ✅ **Alphabet** — `AlphabetPage.tsx` migrated to `curriculumService.getAlphabet()`; removed direct `alphabetData` import; module-level `letterOfDay()` converted to `useMemo` with null guard; added `lotd &&` JSX guard
- ✅ **Roleplay** — `RoleplayPage.tsx` migrated to `curriculumService.getRoleplayScenarios()`; local `SCENARIOS` constant removed
- ✅ **Dictation** — `DictationPage.tsx` migrated to `curriculumService.getDictationWords()`; local `DICTATION_WORDS` constant removed
- ✅ **Homepage duplicate removal** — Removed inline `practiceTools` variable (70 lines, 5 cards) from `HomePage.tsx`; retained `<PracticeToolsGrid />` component as single source of truth
- ✅ **Numbers** — Stabilization: `numbersData` in `sharedContent.ts` now derived from `numbers.ts` via `Object.values().flat()`; dead code removed from `NumbersPage.tsx`
- ✅ **Greetings** — Stabilization: `GreetingsPage.tsx` fixed to use `getGreetings()` instead of `getCalendar()`; calendar tabs removed
- ✅ **Grammar** — Stabilization: dead code removed from `GrammarPage.tsx`; page uses `curriculumService.getGrammarDrills()`

### Stabilization Baseline (2026-08-12)

- ✅ TypeScript: PASS (`npx tsc --noEmit`)
- ✅ Build: PASS (`npm run build`)
- ✅ Lint: PASS (`npx oxlint` — 0 errors, 7 pre-existing warnings)
- ✅ Runtime: PASS — all 13 routes return HTTP 200 on dev server (port 5173)
