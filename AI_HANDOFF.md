# CURRENT AI HANDOFF

Date: 2026-08-12
Last Agent: Cline
Current Phase: Phase 1 + Phase A Complete — awaiting Phase 2
Current Task: Phase A — Homepage + Learning Hub (/learn route)

## Current Status

Build: ✅ PASS — `tsc -b && vite build` exit 0 (87 modules, ~500ms)
TypeScript: ✅ PASS — `npx tsc --noEmit` exit 0
Lint: ✅ PASS — `npx oxlint` 0 errors, 7 pre-existing warnings (none from modified files)
Runtime: ✅ PASS — all 15 routes return HTTP 200 on dev server (incl. /learn)

## Phase 1 — COMPLETE

Phase 1 (Data Architecture Migration) is complete. All page-level curriculum
data has been migrated to `curriculumService`. The following pages now load data
through the service layer:

1. **CalendarPage** — `curriculumService.getCalendar()` (replaced direct `calendarData` import)
2. **AlphabetPage** — `curriculumService.getAlphabet()` (replaced direct `alphabetData` import; module-level `letterOfDay()` converted to `useMemo` with null guard)
3. **RoleplayPage** — `curriculumService.getRoleplayScenarios()` (migrated in Phase 1A)
4. **DictationPage** — `curriculumService.getDictationWords()` (migrated in Phase 1B)
5. **NumbersPage** — `curriculumService.getNumbers()` (stabilization baseline)
6. **GreetingsPage** — `curriculumService.getGreetings()` (stabilization baseline)
7. **ArticlesPage** — `curriculumService.getArticles()` (already service-backed)
8. **GrammarPage** — `curriculumService.getGrammarDrills()` (already service-backed)
9. **PronunciationPage** — `curriculumService.getVocabulary()` (already service-backed)

## Currently Working

- Application builds and runs successfully
- All 13 routes load without errors (/, /auth, /alphabet, /numbers, /calendar, /articles, /greetings, /glossary, /grammar, /pronunciation, /roleplay, /dictation, /dashboard)
- CalendarPage loads calendar data via `curriculumService.getCalendar()` and renders days/months tabs correctly
- AlphabetPage loads alphabet data via `curriculumService.getAlphabet()` and renders Letter of the Day + letter grid correctly
- RoleplayPage loads scenarios via `curriculumService.getRoleplayScenarios()` and renders correctly
- DictationPage loads words via `curriculumService.getDictationWords()` and renders correctly
- HomePage renders single PracticeToolsGrid (duplicate inline cards removed) for authenticated users
- Service layer (curriculumService → LocalCurriculumService → data files) functioning correctly
- PWA service worker generates correctly
- ArticlesPage speech recognition system intact (not modified)
- Authentication system intact (not modified)


## Recently Completed

5. **CalendarPage.tsx** — Migrated from direct `calendarData` import to `curriculumService.getCalendar()`:
   - Replaced `import { calendarData, sharedTextDatabase }` with `import { sharedTextDatabase }` + `import { curriculumService }` + `import type { CalendarItem }`
   - Added `useEffect` + `useState<CalendarItem[]>` async loading pattern
   - Changed `calendarData.slice(...)` to `calendar.slice(...)` (state variable)
   - No loading guard needed (empty array renders empty list gracefully, matching GreetingsPage pattern)
   - Days/months tab functionality fully preserved
   - UI, tab switching, FlipCard rendering all preserved

6. **AlphabetPage.tsx** — Migrated from direct `alphabetData` import to `curriculumService.getAlphabet()`:
   - Replaced `import { alphabetData, sharedTextDatabase }` with `import { sharedTextDatabase }` + `import { curriculumService }` + `import type { AlphabetItem }`
   - Added `useEffect` + `useState<AlphabetItem[]>` async loading pattern
   - Removed module-level `letterOfDay()` function; converted to inline `useMemo` with `[alphabet]` deps and `if (!alphabet.length) return null` guard
   - Added `alphabet` to `filtered` useMemo dependency array
   - Added optional chaining `lotd?.exampleFull?.match(...)` for `meaning` computation
   - Added `lotd &&` guard in JSX: `{sub === 'learn' && lotd && (...)`
   - Days/months tab functionality fully preserved
   - UI, Letter of the Day, letter grid, quiz, spelling all preserved

7. **HomePage.tsx** — Removed duplicate homepage feature-card rendering:
   - Removed 70-line inline `practiceTools` variable (5 cards: Glossary, Dictation, Grammar, Role-play, Pronunciation)
   - Removed `{practiceTools}` reference from `authenticatedLayout`
   - Retained `<PracticeToolsGrid />` component (same 5 tools, same destinations)
   - No behavioral change — authenticated users see the same 5 practice tool cards via the component
   - No import changes needed (PracticeToolsGrid already imported)

4. **RoleplayPage.tsx** — Migrated from local `SCENARIOS` constant to `curriculumService.getRoleplayScenarios()`:
   - Removed 42-line local `SCENARIOS` dataset, local `Opt`/`Step`/`Scenario` types
   - Added `useEffect` + `useState<RoleplayScenario[]>` async loading pattern
   - Uses canonical `RoleplayScenario`/`RoleplayOption` types from `src/types/curriculum.ts`
   - Added `if (!scenario) return null` loading guard
   - UI, scenario navigation, answer selection, scoring, and speech all preserved

2. **DictationPage.tsx** — Migrated from local `DICTATION_WORDS` constant to `curriculumService.getDictationWords()`:
   - Removed 12-item local `DICTATION_WORDS` dataset and local `DictationWord` interface
   - Added `useEffect` + `useState<DictationWord[]>` async loading pattern
   - Uses canonical `DictationWord` type from `src/types/curriculum.ts`
   - Changed `word` state to `DictationWord | null` with post-load initialization
   - Added `if (!word) return null` loading guard
   - UI, answer checking, pronunciation, and randomization all preserved

3. **ARCHITECTURE.md** — Updated to reflect Phase 1 completion:
   - Routes table: Roleplay + Dictation now marked "Yes" (service-backed)
   - Migration State: both moved to "Fully Service-Backed" section
   - Known Duplications: both marked "Resolved in Phase 1"
   - Data Location: updated roleplay.ts and dictation.ts descriptions; page descriptions updated to "service-backed"
   - Architectural Rule 2: updated (no page-level data remains)

4. **Stabilization baseline** (completed before Phase 1):
   - GreetingsPage: fixed to use `getGreetings()` instead of `getCalendar()`
   - NumbersPage: removed dead code (unused imports, `allNumbers()`, module-level `getItemsByRange`)
   - GrammarPage: removed unused imports and constants
   - sharedContent.ts: numbersData now derived from numbers.ts via `Object.values().flat()`

## Known Issues

- 7 pre-existing lint warnings (useSpeechRecognition, useAuth, LanguageContext, NumbersPage, ArticlesPage) — not introduced by Phase 1
- Unused service methods: `getSpellingWords()`, `getGrammarConjugations()` — defined but never called by any page
- Orphaned data files: `src/data/calendar.ts`, `src/data/greetings.ts` — not imported anywhere (data exists inline in `sharedContent.ts`)
- `getVocabulary()` returns `Promise<any[]>` — weak typing (pre-existing)
- Minor type duplication: `DictationWord` interface in both `types/curriculum.ts` and `data/dictation.ts`
- `dictation.ts` has its own local `DictationWord` interface instead of importing from `types/curriculum.ts`

## Phase A — COMPLETE (Homepage + Learning Hub)

Phase A created a dedicated `/learn` Learning Hub and restructured the homepage
to eliminate WOTD + A1 Learning Path duplication between guest and authenticated
views.

**New files:**
- `src/components/learning/LearningPath.tsx` — extracted A1 Learning Path (5-module
  quick-link bar + card grid) from HomePage into a standalone reusable component.
- `src/pages/ContinueLearningPage.tsx` — `/learn` route: reuses DailyChallenge (WOTD),
  LearningPath, and PracticeToolsGrid. Includes Back-to-Home + "Last Module" CTA.

**Modified files:**
- `src/App.tsx` — added `/learn` route + ContinueLearningPage import.
- `src/pages/HomePage.tsx` — authenticated layout: Continue Learning → `/learn`
  (was last-module path); removed duplicated DailyChallenge + LearningPath.
  Guest layout: added DailyChallenge (WOTD) — previously authenticated-only;
  replaced inline `{isLearningActive && learningPath}` with extracted `<LearningPath />`.

**Status:** ✅ Build PASS, ✅ Type PASS, ✅ Lint 0 errors (7 pre-existing warnings), ✅
All 15 routes return HTTP 200 (was 13, now +2: /learn).

## Protected Areas

- `src/pages/ArticlesPage.tsx` — speech recognition + MediaRecorder + audio visualization (DO NOT MODIFY)
- `src/hooks/useSpeechRecognition.ts` (DO NOT MODIFY)
- `src/hooks/useAuth.tsx` (DO NOT MODIFY)

## Next Recommended Action

Phase 1 is COMPLETE. Phase A (homepage + learning hub) is COMPLETE. The remaining
next steps are:

- **Phase 2** (from TASKS.md): Standardize content types and stable IDs across all
  data files. Replace array-index-based keys with stable string IDs.
- **Optional cleanup**: Route remaining direct imports (GlossaryPage, DailyChallenge)
  through service methods where applicable.
- **Phase B** (planned): Continue Learning readiness — see below. The `/learn` route
  is now live and reuses existing infrastructure.

## Continue Learning Readiness

The Continue Learning feature (`/learn` route) is now **IMPLEMENTED** in Phase A:

**What was built:**
- `src/components/learning/LearningPath.tsx` — extracted A1 Learning Path component
- `src/pages/ContinueLearningPage.tsx` — `/learn` route hub reusing DailyChallenge
  (WOTD), LearningPath, and PracticeToolsGrid. Includes Back-to-Home link + Last Module CTA.
- `App.tsx` — `<Route path="learn" element={<ContinueLearningPage />} />` added.

**Reuse confirmed:**
- `useLastModule.ts` — `getLastModule()` provides the "continue where you left off"
  Last Module path on the `/learn` page header.
- `HomePage` authenticated "Continue Learning" button → `/learn` (was last-module path).
- `DailyChallenge.tsx` — reused verbatim as the Word of the Day on `/learn` and
  the guest homepage.
- `PracticeToolsGrid` — reused on `/learn` for quick access to tools.

**Decision: IMPLEMENTED in Phase A.** The dedicated `/learn` hub is live. Authenticated
users navigate from the homepage "Continue Learning" button to `/learn` instead of
directly to the last module. Guest users also have access to `/learn` (no auth gate).
The `ContinueLearningPage` is accessible to both guest and authenticated users.

## Important Decisions

1. Data integrity verified: all page-level datasets (SCENARIOS, DICTATION_WORDS, calendarData,
   alphabetData) were byte-for-byte identical to canonical data files before migration — no content lost.
2. Async loading pattern follows existing codebase convention (GreetingsPage, NumbersPage) —
   `useState<T[]>([])` + `useEffect` with `.then(setState)`.
3. Loading guards added where needed: RoleplayPage (`if (!scenario) return null`),
   DictationPage (`if (!word) return null`), AlphabetPage (`lotd` null guard via
   `useMemo` returning null + `lotd &&` JSX guard + optional chaining on `meaning`).
   CalendarPage needs no guard (empty array renders empty list gracefully).
4. `import type` used for all type-only imports per `verbatimModuleSyntax: true`.
5. No UI changes made — only data loading mechanism changed (CalendarPage, AlphabetPage,
   HomePage duplicate removal). Homepage duplicate removal is behavioral-neutral since
   both the inline `practiceTools` and `<PracticeToolsGrid />` rendered the same 5 tools
   to the same destinations.
