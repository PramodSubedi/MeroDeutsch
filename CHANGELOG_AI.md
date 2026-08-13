# AI Changelog

## 2026-08-13 — Agent: Cline — Per-User Progress Isolation + Guest UX Cleanup

### Task 1: Per-User Progress Isolation

Fix localStorage scoping bug where different user accounts were sharing progress/streak/review/achievements data on the same browser. Requirement: scope all personalized data by authenticated user ID; reset state on login/logout/user-change; guest mode should never show another user's stats.

### Files Changed (Task 1)

1. `src/utils/userStorage.ts` — **NEW.** Shared helper for scoping localStorage keys by user ID.
2. `src/hooks/useProgress.ts` — **MODIFIED.** Added user-scoped keys + Supabase sync to `user_progress` table + state reset on user change.
3. `src/hooks/useReviewQueue.ts` — **MODIFIED.** Added user-scoped keys + Supabase sync to `review_queue` table (row-per-item schema) + state reset.
4. `src/hooks/useStreak.ts` — **MODIFIED.** Added user-scoped keys + Supabase sync to `user_streaks` table + state reset.
5. `src/hooks/useAchievements.ts` — **MODIFIED.** Added user-scoped keys + Supabase sync to `user_achievements` table + state reset.

### Changes (Task 1)

**userStorage.ts (new):**
```typescript
export function scopedKey(base: string, userId: string | null): string {
  return userId ? `${base}:${userId}` : `${base}:guest`;
}
```
- Centralized helper function to ensure consistent user scoping across all hooks
- Guest users get `:guest` suffix; authenticated users get `:userId` suffix
- Prevents localStorage key collisions between different users on same browser

**useProgress.ts:**
- Added `import { scopedKey } from '../utils/userStorage'`
- Changed `BASE_KEY` usage to `scopedKey(BASE_KEY, userId)` throughout
- Added `useEffect` with dependency on scoped key: resets `completedModules`, `totalPoints`, `xp` to zero on user change
- Added Supabase sync: fetches from `user_progress` table on mount (authenticated users only)
- Merge strategy: union for `completedModules` array, max for `totalPoints`/`xp` counters
- Saves to Supabase on every progress update via `upsert` (authenticated users only)

**useReviewQueue.ts:**
- Added `import { scopedKey } from '../utils/userStorage'`
- Changed `BASE_KEY` usage to `scopedKey(BASE_KEY, userId)` throughout
- Added `useEffect` with dependency on scoped key: resets `queue` to empty array on user change
- Added Supabase sync: fetches from `review_queue` table on mount (row-per-item schema)
- Mapper functions: `itemToRow` (ReviewItem → DB row), `rowToItem` (DB row → ReviewItem)
- Delete-then-insert sync pattern: deletes all user rows, inserts current queue items
- Default values for optional fields: `ease: 2.5`, `intervalDays: 1`, `nextReviewDate: new Date()`

**useStreak.ts:**
- Added `import { scopedKey } from '../utils/userStorage'`
- Changed `BASE_KEY` usage to `scopedKey(BASE_KEY, userId)` throughout
- Added `useEffect` with dependency on scoped key: resets `currentStreak`, `longestStreak`, `lastCheckin` on user change
- Added Supabase sync: fetches from `user_streaks` table on mount (authenticated users only)
- Hoisted `longestStreak` variable to fix scoping bug (was referenced outside definition block)
- Saves to Supabase via `upsert` on `checkIn()` (authenticated users only)

**useAchievements.ts:**
- Added `import { scopedKey } from '../utils/userStorage'`
- Changed `BASE_KEY` usage to `scopedKey(BASE_KEY, userId)` throughout
- Added `useEffect` with dependency on scoped key: resets `unlockedBadges` to empty array on user change
- Added Supabase sync: fetches from `user_achievements` table on mount (authenticated users only)
- Saves to Supabase via `insert` on `unlockBadge()` (authenticated users only)

### Task 2: Guest Home UX Cleanup

Reduce sign-in clutter on guest homepage; fix card accessibility; improve Word of the Day visibility. Requirements: max 2 sign-in entry points above fold; hide streak chip for guests; enable daily challenge for guests; add focus-visible styles to cards; clarify WOTD German word display.

### Files Changed (Task 2)

1. `src/pages/HomePage.tsx` — **MODIFIED.** Removed floating Sign in button; hid streak chip for guests.
2. `src/components/DailyChallenge.tsx` — **MODIFIED.** Redesigned WOTD header with prominent German word; improved collapse button text.
3. `src/components/learning/LearningPath.tsx` — **MODIFIED.** Added keyboard focus indicators (WCAG compliance) to module cards.

### Changes (Task 2)

**HomePage.tsx:**
- Deleted floating Sign in button (lines 249-252) from guest hero section — reduced clutter (now max 2 sign-in entry points: header + hero CTA)
- Modified streak chip condition: changed `{streakCount > 0 && (` to `{isAuthenticated && streakCount > 0 && (` — guests no longer see "0 day streak" chip

**DailyChallenge.tsx:**
- Redesigned WOTD header layout:
  - German word now `text-2xl font-bold text-blue-600 dark:text-blue-400` (was small gray subtitle)
  - Translations moved below German word in smaller `text-sm` gray text
  - "Word of the Day" label unchanged (still prominent headline)
- Changed collapse button text: "Hide Word of the Day" / "Show Word of the Day" (was "Hide" / "Show")
- Improved visual hierarchy: German word is now the focal point, translations are supporting context

**LearningPath.tsx:**
- Added keyboard focus styles to `Link` components (5 module cards):
  - `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2`
  - `dark:focus-visible:ring-offset-slate-950` for dark mode compatibility
- WCAG 2.1 compliant: visible focus indicators for keyboard navigation users
- No visual change for mouse users (focus-visible only triggers on keyboard focus, not clicks)

### Preserved (Both Tasks)

- All UI rendering and component behavior preserved (state reset logic is transparent to user)
- Guest users can still use all features (progress stored under `:guest` key)
- Authenticated users' local + cloud data merged correctly (union for arrays, max for counters)
- All existing hooks, components, theme, routing, authentication, PWA infrastructure unchanged
- ArticlesPage.tsx speech recognition system intact (not modified)
- All 15 routes functional (no routing changes)

### Verification (Both Tasks)

- TypeScript: ✅ `npx tsc --noEmit` — exit 0
- Build: ✅ `npm run build` — exit 0 (87 modules, ~500ms)
- Lint: ✅ `npx oxlint` — 0 errors, 7 pre-existing warnings (none from modified files)
- Runtime: ✅ Dev server boots; all routes functional; user switching triggers state reset correctly

### Problems Encountered

**Task 1:**
- Type error in `useReviewQueue`: `itemToRow` had optional fields (`ease?`, `intervalDays?`) but `ReviewRow` required them — fixed by adding default values (ease: 2.5, intervalDays: 1)
- Scoping bug in `useStreak`: `longestStreak` variable referenced outside its definition block — hoisted variable declaration

**Task 2:**
- None — all changes applied cleanly; verified theme toggles already had sufficient contrast (white on blue variants)

### Important Notes For Next Agent

1. **Per-user scoping pattern established:** All personalized hooks now use `scopedKey(BASE_KEY, userId)` pattern from `userStorage.ts`. Any new user-specific hooks should follow this pattern.
2. **State reset pattern:** `useEffect(() => { setState(initialValue); }, [scopedKey(...)])` ensures state resets when user changes (login/logout/account-switch).
3. **Supabase sync pattern:** Fetch on mount (merge with local), save on mutation (upsert/insert), authenticated-only (skip for guests).
4. **Guest UX guidelines:** Max 2 sign-in entry points above fold; hide personalized stats (streak, achievements) for guests; enable non-personalized features (WOTD, learning path) for guests.
5. **Accessibility compliance:** All interactive cards/links should have `focus-visible` ring styles for WCAG 2.1 Level AA keyboard navigation compliance.

## 2026-08-12 — Agent: Cline — Phase A

### Task

Phase A — Homepage architecture + dedicated Learning Hub (`/learn` route).
Extract WOTD and A1 Learning Path into reusable components; create a dedicated
Continue Learning page; restructure the homepage to avoid duplication; keep
guests and authenticated users both served. No authentication backend changes.

### Files Changed

1. `src/components/learning/LearningPath.tsx` — **NEW.** Extracted A1 Learning
   Path from `HomePage.tsx` into a standalone, reusable component. Renders the
   5-module quick-link bar + module-card grid. Uses `useLang` +
   `sharedTextDatabase` internally; no new data or types.
2. `src/pages/ContinueLearningPage.tsx` — **NEW.** `/learn` route — the dedicated
   Learning Hub. Reuses `DailyChallenge` (WOTD), `LearningPath` (A1 path), and
   `PracticeToolsGrid`. Includes a Back-to-Home link and a "Last Module" CTA
   (via `getLastModule()`). Accessible to both guests and authenticated users.
3. `src/App.tsx` — added `import { ContinueLearningPage }` and `<Route path="learn">`.
4. `src/pages/HomePage.tsx` — restructured:
   - **Authenticated layout:** hero (Continue Learning → `/learn`), at-a-glance
     stats, achievements, PracticeToolsGrid. Removed full `DailyChallenge` and
     `LearningPath` (now on `/learn` to avoid duplication).
   - **Guest layout:** hero, `DailyChallenge` (WOTD — added, was previously
     authenticated-only), `LearningPath` (replaced inline toggle version),
     guest pitch.
   - Removed `isLearningActive` state, `sections`/`learningPath` inline consts,
     `useLastModule` import (no longer needed on Home), `sharedTextDatabase`
     import, and `useState` import (only `isLearningActive` used it).
5. `CHANGELOG_AI.md` — this entry.
6. `AIHANDOFF.md` — Phase A status update.
7. `TASKS.md` — Phase A marked complete.
8. `ARCHITECTURE.md` — `/learn` route added to routes table; `LearningPath`
   component added to data-location tree; migration state updated.

### Changes

**App.tsx:**
- Added `import { ContinueLearningPage } from './pages/ContinueLearningPage';`
- Added `<Route path="learn" element={<ContinueLearningPage />} />` after the
  dashboard route.

**HomePage.tsx:**
- Removed `useState` import (only `isLearningActive` used it; now deleted).
- Removed `sharedTextDatabase` import (now handled inside `LearningPath`).
- Removed `useLastModule` import (Continue Learning now → `/learn`, not last-module path).
- Added `import { LearningPath } from '../components/learning/LearningPath';`.
- Changed authenticated "Continue Learning" button: `to={continuePath}` →
  `to="/learn"`; removed `onClick` that set `isLearningActive` + scrollIntoView.
- Authenticated layout: removed `<DailyChallenge />` and
  `{isLearningActive && learningPath}` (both now on `/learn`).
- Guest layout: added `<DailyChallenge />` (WOTD) and
  replaced `{isLearningActive && learningPath}` with `<LearningPath />`.
- Deleted `sections` const (moved into `LearningPath`).
- Deleted `learningPath` const (moved into `LearningPath`).
- Deleted `isLearningActive` state + `setIsLearningActive`.

**LearningPath.tsx (new):**
- Pure extraction of HomePage's `sections` + learning-path JSX.
- Uses `useLang` for labels, `sharedTextDatabase[section.key]?.description`
  for card descriptions, `Link` from react-router-dom for navigation.

**ContinueLearningPage.tsx (new):**
- Header: Back-to-Home link + "Last Module" CTA (`getLastModule()`).
- `<DailyChallenge />` — reuses existing WOTD system verbatim.
- `<LearningPath />` — reuses extracted component verbatim.
- `<PracticeToolsGrid />` — reuses existing tools grid.

### Preserved
- All existing UI rendering (hero, at-a-glance stats, achievements, guest pitch)
- Authentication system (`useAuth.tsx`) — NOT modified
- Speech recognition (`useSpeechRecognition.ts`) — NOT modified
- ArticlesPage.tsx — NOT modified
- All existing hooks, theme, routing pattern (BrowserRouter + Routes + Layout)
- PWA service worker configuration
- All 15 existing routes (unchanged; +1 new /learn route)

### Verification
- TypeScript: ✅ `npx tsc --noEmit` — exit 0
- Build: ✅ `npm run build` — exit 0 (87 modules, 508ms)
- Lint: ✅ `npx oxlint` — 0 errors, 7 pre-existing warnings (none from modified files)
- Runtime: ✅ Dev server boots (no compile errors); all 15 routes return HTTP 200 incl. /learn

### Problems Encountered
- `read_file` tool silently rejected all calls; worked around with `execute_command` (Windows `type`) + `search_files`.
- `write_to_file` with Unix-style `/d:/...` path caused `EINVAL: mkdir 'd:\d:'`; retried with Windows-style backslash absolute path (`d:\Project\german-learner\...`).
- `replace_in_file` on App.tsx produced stray `>>>>>>` markers from diff parsing; rewrote file cleanly with `write_to_file`.
- `head` and `grep` not available on Windows; used `type` and `search_files` instead.

## 2026-08-12 — Agent: Cline
>>>>>>>



### Task

Phase 1 curriculum data architecture migration: migrate Roleplay and Dictation page-level data constants to the CurriculumService. Plus Phase 1 remaining: CalendarPage, AlphabetPage migrations, and HomePage duplicate removal.

### Files Changed

1. `src/pages/CalendarPage.tsx` — migrated from direct `calendarData` import to service
2. `src/pages/AlphabetPage.tsx` — migrated from direct `alphabetData` import to service
3. `src/pages/HomePage.tsx` — removed duplicate inline practice tools cards
4. `src/pages/RoleplayPage.tsx` — migrated from local `SCENARIOS` to service
5. `src/pages/DictationPage.tsx` — migrated from local `DICTATION_WORDS` to service
6. `ARCHITECTURE.md` — updated migration status, routes table, data location, architectural rules
7. `AI_HANDOFF.md` — updated status, completed items, known issues, Continue Learning readiness
8. `TASKS.md` — updated task status

### Changes

**RoleplayPage.tsx:**
- Removed local `SCENARIOS` constant (42 lines, 3 scenarios: cafe, intro, hotel)
- Removed local `Opt`, `Step`, `Scenario` type aliases
- Added `import { useEffect, useState }` (was `useState` only)
- Added `import { curriculumService } from '../services'`
- Added `import type { RoleplayScenario, RoleplayOption } from '../types/curriculum'` (replaces local types)
- Added `useState<RoleplayScenario[]>([])` + `useEffect` to load via `curriculumService.getRoleplayScenarios()`
- Added `if (!scenario) return null` loading guard
- Replaced all `SCENARIOS` references with `scenarios` state variable
- Changed `choose` param type from `Opt` to `RoleplayOption`
- Normalized indentation on `space-y-2` div (was over-indented in original)

**DictationPage.tsx:**
- Removed local `DICTATION_WORDS` constant (12 words)
- Removed local `DictationWord` interface (now uses canonical type from `types/curriculum.ts`)
- Added `import { useEffect }` to React imports
- Added `import { curriculumService } from '../services'`
- Added `import type { DictationWord } from '../types/curriculum'`
- Changed `useState<DictationWord>` (lazy init from `DICTATION_WORDS`) to `useState<DictationWord | null>(null)`
- Added `useState<DictationWord[]>([])` for `dictationWords` state
- Added `useEffect` to load via `curriculumService.getDictationWords()` and initialize `word`
- Added `if (!word) return null` loading guard
- Replaced `DICTATION_WORDS` references with `dictationWords` state variable

**ARCHITECTURE.md:**
- Routes table: Alphabet + Calendar rows updated to show service methods, "Yes" for service-backed
- Routes table: Roleplay + Dictation rows updated to show service methods, "Yes" for service-backed
- Migration State: Moved Alphabet + Calendar from "Partially Service-Backed" to "Fully Service-Backed"
- Migration State: Added Roleplay + Dictation to "Fully Service-Backed" section
- Known Duplications table: Roleplay + Dictation rows updated to "Resolved in Phase 1"
- Data Location: Updated `alphabet.ts`, `AlphabetPage.tsx`, `CalendarPage.tsx` descriptions to "service-backed"
- Data Location: Updated `roleplay.ts`, `dictation.ts` descriptions
- Page-Level Curriculum Data: Updated to mention all four migrated pages

**CalendarPage.tsx:**
- Replaced `import { calendarData, sharedTextDatabase }` with `import { sharedTextDatabase }`
- Added `import { curriculumService } from '../services'`
- Added `import type { CalendarItem } from '../types'`
- Replaced direct `calendarData` reference with `useState<CalendarItem[]>` state + `useEffect` loading via `curriculumService.getCalendar()`
- Changed `calendarData.slice(0, 7)` / `calendarData.slice(7)` to `calendar.slice(0, 7)` / `calendar.slice(7)` (state variable)
- No loading guard needed (empty array renders empty FlipCard list gracefully)
- Days/months tab functionality fully preserved (same `tab` state, same FlipCard rendering)

**AlphabetPage.tsx:**
- Replaced `import { alphabetData, sharedTextDatabase }` with `import { sharedTextDatabase }`
- Added `import { curriculumService } from '../services'`
- Added `useEffect` to React imports (was `useMemo, useState` only)
- Added `useState<AlphabetItem[]>` + `useEffect` loading via `curriculumService.getAlphabet()`
- Removed module-level `letterOfDay()` function; converted to inline `useMemo` with `[alphabet]` deps
- Added null guard `if (!alphabet.length) return null` in the `useMemo`
- Added `alphabet` to `filtered` useMemo dependency array (was `[filter, search]`)
- Added optional chaining: `lotd?.exampleFull?.match(...)` for `meaning` computation
- Added `lotd &&` guard in JSX: `{sub === 'learn' && lotd && (` for Letter of the Day section
- Letter grid, quiz, and spelling components unchanged

**HomePage.tsx:**
- Removed 70-line inline `practiceTools` variable (5 cards: Glossary, Dictation, Grammar, Role-play, Pronunciation)
- Removed `{practiceTools}` reference from `authenticatedLayout` render block
- Retained `<PracticeToolsGrid />` component in its place (same 5 tools, same route destinations)
- No import changes needed (`PracticeToolsGrid` was already imported)
- No behavioral change — both implementations rendered identical 5-tool grid for authenticated users

### Preserved

- All UI rendering (identical JSX preserved across all pages)
- Scenario navigation, answer selection, scoring, feedback (Roleplay)
- Answer checking, pronunciation, randomization (Dictation)
- Days/months tab switching, FlipCard rendering (Calendar)
- Letter of the Day, letter grid, quiz, spelling (Alphabet)
- All protected areas: ArticlesPage.tsx, useSpeechRecognition.ts, useAuth.tsx — NOT modified
- GreetingsPage.tsx — uses `curriculumService.getGreetings()` only (no calendar data)
- NumbersPage.tsx — `numbersData` derived from canonical `numbers.ts` via `Object.values().flat()`
- HomePage.tsx — all hero, stats, achievements, daily challenge, guest pitch sections preserved
- All existing hooks, components, theme, routing, authentication, PWA infrastructure

### Verification

- TypeScript: ✅ `npx tsc --noEmit` — exit 0
- Build: ✅ `npm run build` — exit 0 (85 modules, ~300ms)
- Lint: ✅ `npx oxlint` — 0 errors, 7 pre-existing warnings (none from modified files)
- Runtime: ✅ Dev server on port 5173; all 13 routes return HTTP 200
- HMR: ✅ Modified pages hot-reload cleanly (no compile errors)

### Problems Encountered

- No build, type, or runtime errors during migration
- Windows `cmd` shell lacked `cat` and `sleep` (used `type` and pre-running dev server instead)

### Remaining Issues

- Unused service methods: `getSpellingWords()`, `getGrammarConjugations()` — defined in LocalCurriculumService but never called by any page
- Orphaned data files: `src/data/calendar.ts`, `src/data/greetings.ts` — not imported anywhere
- `getVocabulary()` returns `Promise<any[]>` — weak typing
- `DictationWord` interface duplicated in `data/dictation.ts` and `types/curriculum.ts` (structurally identical)
- NumbersPage `getItemsByRange` and `numberRules` are local to the page component (not in data layer)

### Important Notes For Next Agent

1. The migration pattern for Roleplay, Dictation, Calendar, and Alphabet is complete and stable. All four pages follow the established `useState([])` + `useEffect(.then(setState))` pattern from GreetingsPage and NumbersPage.
2. Phase 1 is COMPLETE — all page-level curriculum data has been migrated to `curriculumService`.
3. Continue Learning (`/learn`) feature is ready to implement — see AI_HANDOFF.md "Continue Learning Readiness" section. Do NOT implement until Phase 2 begins.
4. The `if (!data) return null` loading guard pattern should be used when migrating any page with state-dependent rendering (not simple list maps like GreetingsPage). AlphabetPage's `lotd` null guard is the pattern to follow for pages with complex computed state.
5. When migrating pages with lazy initial state (like Dictation), change `useState<T>(lazyInit)` to `useState<T | null>(null)` + post-load initialization in `useEffect`.
