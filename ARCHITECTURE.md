# German Learner — Architecture

MeroDeutsch is a React + TypeScript + Vite single-page application for A1-level
German learning, with Nepali and English support. This document describes the
**current** application structure as of the stabilization baseline.

---

## Tech Stack

| Layer              | Technology                                                                 |
|--------------------|----------------------------------------------------------------------------|
| Framework          | React 19                                                                  |
| Language           | TypeScript 6                                                                |
| Build tool         | Vite 8                                                                      |
| Styling            | Tailwind CSS 4 (via `@tailwindcss/vite`)                                   |
| Routing            | React Router 7                                                            |
| PWA                | `vite-plugin-pwa` (Workbox) — offline caching, install prompt, push     |
| Linting            | oxlint (with react, typescript, oxc plugins)                                |
| Auth & state       | `localStorage` via `src/utils/safeStorage.ts` (falls back to in-memory)  |
| Speech output      | Web Speech API (`speechSynthesis`)                                        |
| Speech input       | `SpeechRecognition` API (webkitSpeechRecognition fallback)               |

### State Management

All user state (auth, progress, review queue, streak, achievements, dark mode,
language mode) is persisted in `localStorage` through the `safeStorage` utility
(`src/utils/safeStorage.ts`), which gracefully degrades to an in-memory store
when `localStorage` is unavailable. There is no global state manager; each
concern is managed by a dedicated `src/hooks/` hook.

### PWA

PWA support is configured in `vite.config.ts` via `VitePWA`:
- `registerType: 'autoUpdate'` — service worker auto-updates on deploy
- `injectRegister: 'auto'` — auto-injected registration script
- Workbox precaching for offline use, with `navigateFallback` set to `/index.html`
- Offline banner shown by `Layout` when `useOnlineStatus` detects disconnection
- Install prompt surfaced via `useInstallPrompt` hook on the Home page

---

## Pages & Routes

| Route         | Page component        | Data source                                | Service-backed? |
|---------------|-----------------------|--------------------------------------------|-----------------|
| `/`           | `HomePage`            | Aggregated overview + `DailyChallenge`     | No (presentation) |
| `/auth`       | `AuthPage`            | `useAuth` (localStorage)                    | No (auth only)  |
| `/alphabet`   | `AlphabetPage`        | `curriculumService.getAlphabet()`           | Yes             |
| `/numbers`    | `NumbersPage`         | `curriculumService.getNumbers()`           | Yes             |
| `/calendar`   | `CalendarPage`        | `curriculumService.getCalendar()`           | Yes             |
| `/articles`   | `ArticlesPage`        | `curriculumService.getArticles()`          | Yes             |
| `/greetings`  | `GreetingsPage`       | `curriculumService.getGreetings()`         | Yes             |
| `/glossary`   | `GlossaryPage`        | `alphabetData`, `numbersData`, etc. (direct imports) | Partial |
| `/grammar`    | `GrammarPage`         | `curriculumService.getGrammarDrills()`     | Yes             |
| `/pronunciation` | `PronunciationPage` | `curriculumService.getVocabulary()`      | Yes             |
| `/roleplay`   | `RoleplayPage`        | `curriculumService.getRoleplayScenarios()`   | Yes             |
| `/dictation`  | `DictationPage`       | `curriculumService.getDictationWords()`      | Yes             |
| `/dashboard`  | `DashboardPage`       | `useAuth`, `useProgress`, `useReviewQueue`, `useStreak` | No (auth-gated) |
| `/learn`      | `ContinueLearningPage` | `DailyChallenge` (WOTD), `LearningPath`, `PracticeToolsGrid` | No (public hub) |

### Feature Notes

- **Daily Challenge** lives as a component (`src/components/DailyChallenge.tsx`)
  embedded on the Home page (guest). It generates a daily quiz from vocabulary,
  alphabet, and numbers data. Reused verbatim on `/learn`.
- **A1 Learning Path** — extracted into `src/components/learning/LearningPath.tsx`;
  reused on both the guest homepage and `/learn`.
- **Review Queue** (`useReviewQueue`) uses a lightweight SM-2-style interval
  ladder (1, 3, 7 days) for wrong answers across modules.
- **Achievements** (`useAchievements`) unlocks badges based on progress milestones.
- **Articles recorder** (`ArticlesPage`) is a protected subsystem with
  MediaRecorder, AnalyserNode visualization, speech recognition, and
  restart/stop behavior. Do not modify without extreme care.

---

## Data Architecture

```
┌──────────────────┐
│   React Pages    │
│  (src/pages/)    │
└────────┬─────────┘
         │  uses
         ▼
┌────────────────────────────────────┐
│   curriculumService (singleton)    │
│  src/services/index.ts             │
└────────┬─────────┬─────────────────┘
         │ returns │
         ▼         │
┌────────────────────────────────────┐
│  LocalCurriculumService            │
│  src/services/localCurriculumService.ts │
│  Implements CurriculumService interface │
└────────┬─────────┬─────────────────┘
         │ reads   │
         ▼         ▼
┌──────────────────┐  ┌──────────────────┐
│ TS/JSON curriculum│  │ TypeScript types │
│ data (src/data/)  │  │ (src/types/)      │
└──────────────────┘  └──────────────────┘
```

### Current Implementation

The current implementation is a **local curriculum service** architecture:

1. **React Pages** call methods on the `curriculumService` singleton (exported
   from `src/services/index.ts`).
2. **`curriculumService`** is an instance of `LocalCurriculumService`, which
   implements the `CurriculumService` interface (defined in `src/types/curriculum.ts`).
3. **`LocalCurriculumService`** reads from TypeScript data modules in `src/data/`.
4. The data modules contain typed arrays/objects of curriculum content (letters,
   numbers, calendar items, greetings, articles, grammar drills, roleplay
   scenarios, dictation words, vocabulary).

### Data Flow

```
React Components
      │
      ▼
CurriculumService interface (src/types/curriculum.ts)
      │
      ▼
LocalCurriculumService (src/services/localCurriculumService.ts)
      │
      ▼
TypeScript / JSON curriculum data (src/data/)
```

### Future Target

```
React Components
      │
      ▼
CurriculumService interface
      │
      ▼
LocalCurriculumService
      │
      ▼
TS / JSON
```

Eventually this will expand to:

```
React Components
      │
      ▼
CurriculumService interface
      │
      ▼
API / Supabase implementation
      │
      ▼
PostgreSQL / Storage
```

**Rule:** React components must not directly depend on raw curriculum data when a
service method exists. Pages should go through `curriculumService`.

---

## Migration State

### Fully / Mostly Service-Backed

These pages retrieve curriculum data through `curriculumService`:

- **Articles** — `curriculumService.getArticles()`
- **Greetings** — `curriculumService.getGreetings()`
- **Grammar** — `curriculumService.getGrammarDrills()`
- **Pronunciation** — `curriculumService.getVocabulary()`
- **Numbers** — `curriculumService.getNumbers()` (canonical source: `src/data/numbers.ts`;
  `sharedContent.ts` now re-exports a flattened view of the same data)
- **Roleplay** — `curriculumService.getRoleplayScenarios()` (canonical source: `src/data/roleplay.ts`)
- **Dictation** — `curriculumService.getDictationWords()` (canonical source: `src/data/dictation.ts`)
- **Alphabet** — `curriculumService.getAlphabet()` (canonical source: `src/data/alphabet.ts`;
  `sharedContent.ts` re-exports the same data)
- **Calendar** — `curriculumService.getCalendar()` (canonical source: `src/data/sharedContent.ts` —
  `calendarData` is defined inline in `sharedContent.ts`)

### Partially Service-Backed

These pages/components import data directly from `sharedContent.ts` (bypassing the service).
The service has methods for some of these, but they do not yet use them:

- **Daily Challenge** (`components/DailyChallenge.tsx`) — imports `alphabetData`, `numbersData`,
  `vocabularyData` from sharedContent directly
- **Glossary** (`pages/GlossaryPage.tsx`) — imports multiple datasets from `sharedContent` directly

### Page-Level Curriculum Data

None remaining — all pages now retrieve data through `curriculumService` or
direct imports from canonical data files. `RoleplayPage`, `DictationPage`,
`AlphabetPage`, and `CalendarPage` have all been migrated to use
`curriculumService` (Phase 1). Remaining direct-import consumers are
`DailyChallenge.tsx` and `GlossaryPage.tsx` (components, not full pages).

---

## Data Location

```
src/
  assets/              # Static assets (icons, images, etc.)
  components/
    alphabet/          # Alphabet-specific sub-components (LetterCard, AlphabetQuiz, SpellingPractice)
    learning/          # Reusable learning-hub components (extracted from HomePage)
      LearningPath.tsx # A1 learning-path grid (5 modules) — reused on / and /learn
    Layout.tsx         # Top navigation shell (dark mode, language toggle, auth)
    FlipCard.tsx       # Reusable flip card for learning items
    SectionGrid.tsx    # Reusable section layout with title, description, controls
    Card.tsx           # Simple card with badge, title, lines, footer
    DailyChallenge.tsx # Word-of-the-day + daily quiz — reused on / and /learn
    PracticeToolsGrid.tsx # Grid of practice tool links — reused on / and /learn
    AuthGate.tsx       # Auth gate wrapper
    BrandMark.tsx      # Logo component
    Footer.tsx         # Site footer
    ErrorBoundary.tsx  # React error boundary
  config/
    theme.ts           # Tailwind class tokens (colors, spacing, typography)
  context/
    LanguageContext.tsx # Legacy language context (useLang is the primary hook)
  data/
    alphabet.ts        # Canonical alphabet data (30 letters) — consumed by
                       # LocalCurriculumService.getAlphabet(); AlphabetPage migrated to service
    articles.ts        # Canonical article data (der/die/das nouns)
    dictation.ts       # Canonical dictation words (DictationWord[]) — consumed by
                       # LocalCurriculumService.getDictationWords(); DictationPage migrated to service
    grammar.ts         # CONJUGATIONS, CASES, DRILLS — canonical grammar data
    numbers.ts         # Canonical numbers data (Record<NumberRange, NumberItem[]>) + numberRules
    pronunciationTips.ts # Pronunciation tips keyed by alphabet item id
    roleplay.ts        # Canonical SCENARIOS (RoleplayScenario[]) — consumed by
                       # LocalCurriculumService.getRoleplayScenarios(); RoleplayPage migrated to service
    sharedContent.ts   # Aggregates re-exports + sharedTextDatabase + sharedTranslations.
                       # numbersData sourced from numbers.ts (flattened).
                       # greetingsData and calendarData defined inline (canonical source).
    spelling.ts        # spellingWords (easy + medium)
    loadVocabulary.ts  # Loads + dedupes vocabulary from JSON files
    vocab/
      core-a1.json     # A1 core vocabulary
      food.json        # Food vocabulary
      travel.json      # Travel vocabulary
  hooks/
    useAuth.tsx        # Auth context + localStorage-based login/register (protected)
    useLang.tsx        # Language mode (normal / german)
    useDarkMode.ts     # Dark mode toggle (localStorage)
    useTranslation.ts  # Translation helper (sharedTextDatabase, sharedTranslations)
    useProgress.ts     # Alphabet learning progress (localStorage)
    useReviewQueue.ts  # Wrong-answer review queue with SM-2-style intervals (localStorage)
    useStreak.ts       # Daily streak tracking (localStorage)
    useAchievements.ts # Badge unlocking system (localStorage)
    useMilestoneToast.ts # Milestone notification toasts
    useOnlineStatus.ts # Online/offline detection
    useLastModule.ts   # "Continue learning" last-visited module tracking
    useInstallPrompt.ts # PWA install prompt handling
    useSpeech.ts       # Text-to-speech helper (speakWord, speakLetter, speakText, useSpeechSpeed)
    useSpeechRecognition.ts # Speech recognition hook (protected — used by Articles + Pronunciation)
  pages/
    AlphabetPage.tsx   # Alphabet learning (LetterCard grid, quiz, spelling) — service-backed
    ArticlesPage.tsx   # der/die/das trainer with recording + speech recognition — service-backed
    AuthPage.tsx       # Login/register form
    CalendarPage.tsx   # Days & months flip cards — service-backed
    ContinueLearningPage.tsx # /learn hub — reuses DailyChallenge, LearningPath, PracticeToolsGrid
    DashboardPage.tsx  # Progress overview + review queue (auth-gated)
    DictationPage.tsx  # Listen-and-type — service-backed
    GlossaryPage.tsx   # Searchable glossary — direct data imports
    GrammarPage.tsx    # Grammar drills (sein, haben, weak verbs, cases) — service-backed
    GreetingsPage.tsx  # Greeting phrases flip cards — service-backed
    HomePage.tsx       # Landing: guest=hero+WOTD+learning path; authed=dashboard+→/learn
    NumbersPage.tsx    # Number learning + quiz + listen-and-type — service-backed
    PronunciationPage.tsx # Vocabulary pronunciation with speech recognition — service-backed
    RoleplayPage.tsx   # Conversation scenarios — service-backed
  services/
    index.ts           # Exports curriculumService singleton
    localCurriculumService.ts # LocalCurriculumService implementing CurriculumService
  types/
    index.ts           # Core domain types (AlphabetItem, NumberItem, CalendarItem, etc.)
    curriculum.ts      # CurriculumService interface + RoleplayScenario, DictationWord, etc.
  utils/
    safeStorage.ts     # localStorage wrapper with in-memory fallback
  App.tsx              # Route definitions only (+ /learn route)
  main.tsx             # React entry point
  pwa-register.ts      # Service worker registration
  App.css              # Global CSS (Tailwind directives)
  index.css            # Global CSS (Tailwind directives)
public/
  favicon.svg          # App icon
  icons.svg            # Icon sprite
  manifest.json        # PWA manifest (fallback)
  pwa-192x192.png       # PWA icon
  pwa-512x512.png       # PWA icon
```

---

## Architectural Rules

1. **One feature = one data source / module where practical.**
   Each curriculum feature should have a single canonical data file in
   `src/data/`. Pages and services should reference that canonical source
   rather than maintaining competing copies.

2. **Never put large curriculum datasets directly inside React components.**
   Curriculum data belongs in `src/data/` or in a service. All page-level
   data has been migrated to the service layer.

3. **React components should not directly depend on raw curriculum data
   where a service method exists.** Pages should go through
   `curriculumService` for features that have been migrated.

4. **The `sharedContent.ts` module is a compatibility aggregator.**
   It re-exports data from canonical source files (`alphabet.ts`,
   `articles.ts`, `spelling.ts`, `numbers.ts`) and hosts shared text
   databases and translations. It is not a primary data source.

---

## Known Duplications & Issues (to be resolved in future phases)

| Feature | Issue | Impact |
|---------|-------|--------|
| Numbers | `sharedContent.ts` previously had an inline flat `numbersData` duplicate of `numbers.ts`. **Fixed in this baseline** — `sharedContent.ts` now sources from `numbers.ts` via `Object.values(numbersByRange).flat()`. | Resolved. |
| Greetings | Orphaned `src/data/greetings.ts` file **removed (2026-08-13)** — `sharedContent.ts` is the canonical source. | Resolved. |
| Calendar | Orphaned `src/data/calendar.ts` file **removed (2026-08-13)** — `sharedContent.ts` is the canonical source. | Resolved. |
| Roleplay | `RoleplayPage.tsx` defined its own local `SCENARIES`; `data/roleplay.ts` had the same data. **Resolved in Phase 1** — page now uses `curriculumService.getRoleplayScenarios()`. | Resolved. |
| Dictation | `DictationPage.tsx` defined its own local `DICTATION_WORDS`; `data/dictation.ts` had the same data. **Resolved in Phase 1** — page now uses `curriculumService.getDictationWords()`. | Resolved. |
| Numbers | `NumbersPage.tsx` has component-level `getItemsByRange` that filters flat array data from the service by `item.n`. The `numberRules` constant is also defined locally in the page. | Low — functional, just duplicated definitions. |

---

## How to Run

```bash
cd german-learner
npm install
npm run dev        # Vite dev server (PWA + HMR)
npm run build      # tsc -b && vite build (production)
npm run lint       # oxlint
npm run preview    # Preview production build locally
```

## Current Baseline Status

- **TypeScript:** PASS (`npx tsc --noEmit`)
- **Build:** PASS (`npm run build`) — 87 modules transformed
- **Lint:** PASS (`npx oxlint` — 0 errors, 7 pre-existing warnings)
- **Routes:** 15 routes all return HTTP 200 on dev server (incl. `/learn`)

### Pre-existing Lint Warnings (not introduced by this baseline)

1. `react-hooks/exhaustive-deps` — `NumbersPage` `useCallback` missing `nextQuiz` dependency.
2. `react-hooks/exhaustive-deps` — `ArticlesPage` `useCallback` unnecessary `sharedTranslations` dependency.
3. `no-unused-vars` — Catch parameter `error` unused in `useSpeechRecognition.ts` and `ArticlesPage.tsx`.
4. `react/only-export-components` — `useAuth` and `useLanguage` are hooks exported from files with other exports (Fast Refresh hint).

These are pre-existing and tracked for future cleanup.
