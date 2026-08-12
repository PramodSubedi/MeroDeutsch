# AI CONTEXT — MeroDeutsch

## Project

MeroDeutsch — A1-level German learning application with Nepali and English support.
React single-page application (SPA) with offline PWA capabilities.

## Stack

- **Framework:** React 19
- **Language:** TypeScript 6 (`verbatimModuleSyntax: true`, `noUnusedLocals`, `noUnusedParameters`)
- **Build tool:** Vite 8
- **Styling:** Tailwind CSS 4 (via `@tailwindcss/vite`)
- **Routing:** React Router 7
- **PWA:** `vite-plugin-pwa` (Workbox) — offline caching, install prompt, SW auto-update
- **Linting:** oxlint (react, typescript, oxc plugins)
- **State management:** `localStorage` via `src/utils/safeStorage.ts` (in-memory fallback)
- **Speech output:** Web Speech API (`speechSynthesis`) via `useSpeech.ts`
- **Speech input:** `SpeechRecognition` API (webkitSpeechRecognition fallback) via `useSpeechRecognition.ts`
- **Auth:** localStorage-based auth via `useAuth.tsx`
- **Dev server:** Vite (HMR on port 5173+)

## Core Architecture

### Current (Phase 1 + Phase A)

```
TS / JSON data
      ↓
Local Curriculum Service (LocalCurriculumService)
      ↓
curriculumService singleton (src/services/index.ts)
      ↓
React pages/components
```

### Future (Phase 5 target)

```
React
      ↓
CurriculumService interface (src/types/curriculum.ts)
      ↓
LocalCurriculumService (current) → API/Supabase/PostgreSQL (future)
      ↓
src/data/*.ts
```

The React layer should not need to change when the backend implementation changes.

## Curriculum Hierarchy

### Future target

```
A1
 └── Module
      └── Lesson
           └── Content
```

### Current flat structure

Each module is a direct page route:

- `/` — HomePage (landing: guest sees WOTD + A1 path; authed sees dashboard + → /learn)
- `/learn` — ContinueLearningPage (Learning Hub: WOTD + A1 path + tools)
- `/auth` — AuthPage (login/register)
- `/alphabet` — AlphabetPage
- `/numbers` — NumbersPage
- `/calendar` — CalendarPage
- `/greetings` — GreetingsPage
- `/articles` — ArticlesPage
- `/grammar` — GrammarPage
- `/pronunciation` — PronunciationPage
- `/roleplay` — RoleplayPage
- `/dictation` — DictationPage
- `/glossary` — GlossaryPage
- `/dashboard` — DashboardPage (auth-gated)

## Current Migration Status

### Fully service-backed

- Articles — `curriculumService.getArticles()`
- Greetings — `curriculumService.getGreetings()`
- Grammar — `curriculumService.getGrammarDrills()`
- Pronunciation — `curriculumService.getVocabulary()`
- Numbers — `curriculumService.getNumbers()`
- Roleplay — `curriculumService.getRoleplayScenarios()`
- Dictation — `curriculumService.getDictationWords()`
- Alphabet — `curriculumService.getAlphabet()`
- Calendar — `curriculumService.getCalendar()`

### Partially service-backed

- Daily Challenge (`DailyChallenge.tsx`) — imports `alphabetData`, `numbersData` from `sharedContent` directly (reused on guest Home + /learn)
- Glossary (`GlossaryPage.tsx`) — imports multiple datasets from `sharedContent` directly

### Completed Phases

- **Phase 1** (Data Architecture Migration): All page-level curriculum data migrated to `curriculumService`.
- **Phase A** (Homepage + Learning Hub): `/learn` route created; WOTD and A1 Learning Path
  extracted into reusable components; HomePage restructured (guests keep WOTD + A1 path,
  authenticated users get dashboard + Continue Learning → /learn).

### Phase priority

1. Roleplay ✅
2. Dictation ✅
3. Alphabet ✅
4. Numbers ✅
5. Daily Challenge — partially done (component exists, but still direct-imports data)
6. Glossary — not yet routed through service

## Protected Areas

- `src/pages/ArticlesPage.tsx` — speech recognition + MediaRecorder + audio visualization
- `src/hooks/useSpeechRecognition.ts` — speech recognition hook
- `src/hooks/useAuth.tsx` — authentication system

Do not modify these unless explicitly required by a task or a genuine blocker.

## Key Architectural Rules

1. One feature = one canonical data source in `src/data/`
2. No large curriculum datasets inside React components
3. Pages should go through `curriculumService` when a service method exists
4. `sharedContent.ts` is a compatibility aggregator, not a primary data source
5. Type-only imports use `import type` (required by `verbatimModuleSyntax`)
6. `ARCHITECTURE.md` is the authoritative architecture document — verify against actual code
