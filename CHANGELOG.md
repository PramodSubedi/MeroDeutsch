# Changelog

## Multi-phase handoff — MeroDeutsch

### Phase 1 — Layout + branding
- Created shared `BrandMark` component (`src/components/BrandMark.tsx`) — "Mero" red + "Deutsch" gradient.
- Logo in header is now a `<Link to="/">` (clicking Mero Deutsch → Home).
- BrandMark reused in header, hero chip, Auth page, and Dashboard.
- Added brand tokens to `theme.ts` (`theme.brand.*`).
- Tightened spacing on HomePage and DashboardPage (denser layout, less blank space).
- Loaded Inter font (CSS) with a clear type hierarchy.
- Language toggle labels: normal = **EN+NE**, German = **Nur DE**.
- Created `BRANDING.md` (name, tagline, colors, logo rules).

### Phase 2 — PWA polish
- Added `navigateFallback: '/index.html'` to Workbox for offline SPA routing.
- Added `useInstallPrompt` hook + non-blocking "Install MeroDeutsch" tip on Home.
- Added `useOnlineStatus` hook + offline banner in Layout ("You are offline — cached lessons still work.").
- Verified SW precaches app shell (index.html, JS/CSS, icons, manifest) with navigation fallback.

### Phase 3 — SRS review queue
- Extended `WrongAnswerItem` type with SRS fields (`ease`, `intervalDays`, `repetitions`, `dueAt`, `lastResult`).
- `useReviewQueue`:
  - Wrong answers set a short interval (due today).
  - `markCorrect` pushes interval out via SM-2–style ladder (1 → 3 → 7 days).
  - Sorting prioritizes due items first, then error count.
- Dashboard shows Due/Scheduled badges, "Got it ✓" (markCorrect) and "Resolved" actions, and next-review time.

### Phase 4 — Badges with real rules
- `UserAchievements` now stores `UnlockedBadge` records with `unlockedAt`.
- `useAchievements` exposes 7 badges with real rules evaluated against progress:
  - first_steps (1 letter), alphabet_10 (10), alphabet_26 (26),
  - quiz_10 (10 attempts), quiz_accuracy_80 (80%+, 5+ attempts),
  - spelling_10 (10 words), century_club (100 actions).
- `checkAndUnlock` runs on progress changes in HomePage.
- HomePage displays unlocked (colored) vs locked (grey/dashed with requirement) badges.

### Phase 5 — Bilingual glossary
- New `GlossaryPage` at `/glossary` aggregating terms from alphabet, numbers, calendar, greetings, articles.
- Client-side search filter (German, English, Nepali).
- TTS speak button per entry.
- German-only mode hides EN/NE helper text.
- Added nav link.

### Phase 6 — Dictation drills (Hörverstehen)
- New `DictationPage` at `/dictation`.
- Hear → type → check flow using `speechSynthesis` (answer not shown first).
- Replay audio, scoring, normalized comparison (case/trim).
- Wrong answers feed the review queue / SRS.
- Added nav link.

## Refinements + new features handoff

### Priority bugfix
- HomePage: "Why sign in?" card now hidden when authenticated.

### Phase A1 — Articles
- Added A1 example sentences; sentence shown + 🔊 speak; Web Audio beep; wrongs feed SRS.

### Phase A2 — Alphabet
- Pronunciation tips map in letter modal; centralized TTS speed (Slow/Normal/Fast persisted) + speed toggle.

### Phase A3 — Numbers
- "Learn List | Listen & Type" toggle; listen-and-type flow; wrongs feed SRS.

### Phase A4 — Greetings & Calendar
- Reusable `FlipCard` component (front DE, back EN/NE, hidden in German-only) with 🔊.

### Phase A5 — Progress / streaks UX
- Dashboard per-module progress bars; `useMilestoneToast` milestone toasts.

### Phase B1 — Vocabulary database
- `src/data/vocabulary.ts` with 82 curated A1 entries; wired into Glossary.

### Phase B2 — Adaptive audio
- Global speed + optional pre-recorded audio fallback (`speakWordWithAudio`).

### Phase C1 — Daily challenge + Word of the Day
- Date-seeded word + 3-question challenge; `daily_challenger` badge; reward once/day.

### Phase C2 — Grammar hub
- `/grammar`: sein/haben/weak-verb tables + Nominativ/Akkusativ; 5-question mini-drill; wrongs feed SRS.

### Phase C3 — Pronunciation feedback
- `/pronunciation`: speak → compare (normalized); green/yellow/red; typing fallback; wrongs feed SRS.

### Phase C4 — Role-play scenarios
- `/roleplay`: 3 scripted scenarios; choose response; correct advances; completion toast.

## Builds
- `npm run build` passes after every phase (final: 65 modules).

## UI Redesign — HomePage banner, Footer, Practice Tools Grid, Learning Path Toggle

### HomePage
- Welcome banner redesigned with polished card styling, subtle gradients, and clear spacing.
- A1 Learning Path grid is no longer statically visible — now shown conditionally via the "Continue Learning" hero button.
- `isLearningActive` state toggle: clicking "Continue Learning" enables the A1 Learning Path and smooth-scrolls to it.
- PracticeToolsGrid component imported and rendered above the achievements section.

### PracticeToolsGrid
- New `src/components/PracticeToolsGrid.tsx` with standardized tool cards for Glossary, Dictation, Grammar, Role-play, and Pronunciation.
- Each card has icon, title, description, and aligned action button with hover effects.
- Uses inline SVG icons (Heroicons-style) — no extra dependency required.

### Footer
- New `src/components/Footer.tsx` with professional card layout:
  - Brand column with "A1 Core" tag.
  - Explore quick-navigation links.
  - Live Speech API status indicator.
  - Copyright row with Privacy/Terms/Support links.
