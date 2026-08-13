# TASKS — MeroDeutsch Project Roadmap

## NOW

- **Phase 2** — Standardize content types and stable IDs across all data files (already using stable string IDs; verify consistency).
- **Phase 3** — Introduce curriculum metadata hierarchy (Level → Module → Lesson → Content).

## NEXT

## LATER

- **Phase 4** — Local caching/offline curriculum architecture for data files.
- **Phase 5** — Replace `LocalCurriculumService` with API/Supabase/PostgreSQL implementation behind the same `CurriculumService` interface.
- **Phase 6** — Admin/content management capabilities.
- **Homepage redesign** — Guest and authenticated states (see AI_CONTEXT.md §19).
- **ContinueLearningPage enhancements** — Add progress summary + quick-access links to recent modules inside `/learn` (Phase B). The basic `/learn` route is already live.

## COMPLETED

### Visibility Bugs, Orphan Wiring, Duplicate Cleanup (2026-08-14)

- ✅ **NumbersPage quiz visibility** — Removed `mode === 'learn'` gate so the Quick Number Quiz shows in both Learn and Listen modes; Listen & Type section still gated to listen mode
- ✅ **PronunciationPage Check button** — Wired dead `onClick={() => {}}` to `handleResult(typed)` (same path as Enter key); input now controlled via `typed` state
- ✅ **Layout → UserMenu** — Replaced inline profile dropdown markup/state with existing `UserMenu` component; removed `profileOpen`, `handleSignOut`, `useNavigate`; sign out/auth preserved
- ✅ **App Suspense → SkeletonLoader** — Replaced plain "Loading..." fallback with `SkeletonLoader`
- ✅ **BadgeShowcase deleted** — Orphan (0 imports); `BadgeData` type incompatible with `useAchievements`'s `Badge` type
- ✅ **useKeyboardShortcuts wired** — Into AlphabetQuiz (Space/1-4/Enter) + NumbersPage quiz (Space/1-4/Enter)
- ✅ **MasteryIndicator wired** — Rendered as Leitner box-level dots in Dashboard review queue items
- ✅ Verification: tsc PASS, build PASS (740 modules), lint 0 errors (4 pre-existing warnings)

### Review Queue Integration + Navigation Cleanup (2026-08-14)

- ✅ **SpellingPractice → review queue** — Wired `useReviewQueue().addWrongAnswer()` into the wrong-answer branch of `check()` (moduleType: 'spelling', correctAnswer uses `gerPhonetic || id` fallback)
- ✅ **AlphabetQuiz → review queue** — Verified already wired via `addWrongAnswer()` (moduleType: 'alphabet')
- ✅ **Module registry** — `src/config/modules.ts` is the single source of truth; Layout uses `getModuleRoutes()`, ModuleSwitcher uses `getNavigationModules()`
- ✅ **ModuleSwitcher dark mode** — Uses `theme.button.toggleActive`/`toggleInactive` tokens with `dark:` variants (verified)
- ✅ **ActivityHeatmap fake data** — Component is unused in the codebase and defaults to empty `activities` array; no fake data rendered
- ✅ **Footer path sanity** — Converted `<a href>` to `<Link>` for SPA client-side navigation
- ✅ **Footer fake status removed** — Removed fake "Speech API Active" animated pulse badge
- ✅ Verification: tsc PASS, build PASS (736 modules), lint 0 errors (4 pre-existing warnings)

### Phase 4-6 — Data Layer Cleanup + Database Hardening + Deploy Readiness (2026-08-14)

- ✅ **GlossaryPage through curriculumService** — Already routes through service (verified)
- ✅ **DailyChallenge through curriculumService** — Already routes through service (verified)
- ✅ **Type getVocabulary() properly** — Returns `Promise<VocabEntry[]>` (verified)
- ✅ **Dedupe DictationWord type** — Removed duplicate from `src/data/dictation.ts`, now imports from `types/curriculum.ts`
- ✅ **Stable string IDs verified** — All modules use semantic string keys (German words, phrases, letter IDs) for progress/review tracking, not array indexes
- ✅ **Unused service methods** — Commented out `getSpellingWords()` and `getGrammarConjugations()` in interface and implementation
- ✅ **Database migration** — Created `20260814000000_harden_database.sql` with missing columns (`last_result`, `box_level`), performance index, updated_at triggers, RLS INSERT policy
- ✅ **TypeScript interfaces updated** — ReviewRow, userDataService, useReviewQueue all sync new fields
- ✅ **Deploy documentation** — Created `DEPLOY.md` with complete deployment checklist, smoke tests, troubleshooting
- ✅ **.env.example** — Created template with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- ✅ Verification: tsc PASS, build PASS (735 modules), no RLS errors

### Data Cleanup — Orphaned Files Removal (2026-08-13)

- ✅ **Removed orphaned data files** — Deleted `src/data/calendar.ts` and `src/data/greetings.ts` (duplicates of data in `sharedContent.ts`)
- ✅ **Updated ARCHITECTURE.md** — Documented removal in "Known Duplications & Issues" and "Data Location" sections
- ✅ Verification: Files confirmed unused (0 imports), build still passes

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

### Phase 1 Production Polish (2026-08-13)

- ✅ **usePageTitle hook** — `src/hooks/usePageTitle.ts` created; applied to all existing + new route pages
- ✅ **Settings page** — `src/pages/SettingsPage.tsx` at `/settings` (language toggle, dark mode, TTS speed, sign out, reset progress)
- ✅ **Privacy & Terms pages** — `src/pages/PrivacyPage.tsx` + `src/pages/TermsPage.tsx` (i18n, five sections each)
- ✅ **Help/FAQ page** — `src/pages/HelpPage.tsx` at `/help` (expandable FAQ accordion)
- ✅ **Feedback page** — `src/pages/FeedbackPage.tsx` at `/feedback` (category + message form)
- ✅ **SEO meta** — `index.html` updated with description + OG + Twitter Card tags
- ✅ **Footer** — `src/components/Footer.tsx` rewired with `Link` navigation, removed fake "Speech API Active" pulse
- ✅ Dashboard: added Settings link next to review queue badge
- ✅ Layout: Settings link added to profile dropdown menu
- ✅ Verification: tsc PASS, build PASS (735 modules), lint 0 errors (4 pre-existing warnings)

### Stabilization Baseline (2026-08-12)

- ✅ TypeScript: PASS (`npx tsc --noEmit`)
- ✅ Build: PASS (`npm run build`)
- ✅ Lint: PASS (`npx oxlint` — 0 errors, 7 pre-existing warnings)
- ✅ Runtime: PASS — all 13 routes return HTTP 200 on dev server (port 5173)
