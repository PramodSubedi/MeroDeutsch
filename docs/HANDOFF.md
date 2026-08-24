# Handoff

## Current version baseline
- Shipped: v0.2.0
- Next target: v0.2.2 (content + calendar) — v0.2.1 engineering patch shipped

## Cline — active
- Task: ✅ DONE — v0.2.1 engineering patch (Phase 1) **and** Grammar System roadmap (Phases 1-4)
- Files changed:
  - `src/components/LanguageToggle.tsx` — **new** shared EN/DE switch (replaces duplicated controls) [Phase 1]
  - `src/components/Layout.tsx` — desktop + mobile header blocks now reuse `<LanguageToggle />` [Phase 1]
  - `src/components/CollapsibleModuleGroup.tsx` — expand height uses measured `contentHeight` only (removed `modules.length * 48` fallback) [Phase 1]
  - `src/App.tsx` — `/rapid-blitz` → `<Navigate to="/rapid-fire">` preserving `?mode=` query; route alias registered in `modules.ts` [Phase 1]
  - `src/data/a1Verbs.ts` — **new** ~53 A1 verbs + `FORM_TO_VERB` reverse index (53 verbs, 220 distinct forms, no dup keys/collisions verified) [conjugation slice]
  - `src/components/exercises/SentenceBuilder.tsx` — added `getSubjectPerson` (honest sich/du/Sie/wir/ihr/sie split) + `analyzeError` now resolves the correct verb form from the expected sentence, emits a `conjugation` mismatch message when detectable; existing DB/Akk/caps feedback path preserved [conjugation slice]
  - `docs/BACKLOG.md` — Phase 1 items + Grammar SystemCoordination section marked done
- Status: Grammar roadmap Phases 1-4 planned; implementation per roadmap schedule
- Needs from Kilo: docs/coordination support (vocab-category ↔ rule interface doc; BACKLOG/HANDOFF sync)
- Blocked by: none

## Cline — next
- **Priority 1: Calendar Uhrzeit widget** (small). Compact telling-time practice on `/calendar` reusing the existing Listen&Type pattern (audio for "Es ist…" hour/minute phrases + tap-to-hear, plus a tiny clock face). No new quiz framework, no seeds. Falls back gracefully if time phrases are sparse.
- If Uhrzeit needs new time-specific sentences/vocab, I will note a Kilo need and NOT seed myself.

## Kilo — active
- Task: ✅ DONE — category inventory + tagging plan (KILO_TAGGING_PLAN.md) ✅ and seeding execution (category: 'time' for TIME nouns, 'routine' for routine verbs)
- Files changed:
  - `scripts/seedCurriculum.ts` — updated category assignment: TIME nouns → 'core' → 'time', routine verbs → 'core' → 'routine'
  - `docs/KILO_TAGGING_PLAN.md` — updated tagging strategy to reflect seeded category values
  - `docs/BACKLOG.md` — marked vocab category tagging execute item done; Grammar SystemCoordination Kilo item done
  - `docs/VOCAB-BUILDER-INTERFACE.md` — updated success criteria with seeding completion
- Status: plan complete; seeding executed; coordination with Cline on grammar roadmap phases complete
- Needs from Cline: none for completed tagging plan and seeding execution; coordination sync when Cline phases conclude
- Blocked by: none

## Do not touch right now (locks)
- Prefer: avoid editing whatever Cline is mid-change; human updates locks when known

## Next up
1. **Cline: v0.2.2 (Phase 2)** — Calendar Uhrzeit widget (reuse Listen&Type), Sentence Builder growth, Roleplay scenarios (Cline features; needs Kilo data for sentences/roleplay/tags)
2. **Kilo: category inventory + tagging plan** — vocab tags for U4/U5 checkpoint frequency
3. Optional docs/VOCAB-CATEGORIES.md

How to list categories in Supabase (GROUP BY category)
U4/U5 try-lists + A1 fallback note from v0.2.0
No seeding in this task

Hard rules
- Docs only under docs/
- No src/ changes (Kilo side; Cline feature work is in src/)
- No package.json version changes without human
- No git commit of secrets
## Cline — active (current snapshot)

- **Shipped this pass:** Phase 2a (Calendar Uhrzeit), Phase 3a (Stories MCQs), Phase 4 (Pronunciation A1 pool), Phase 5 (typecheck script, reduced-motion guard, toast aria-live).
- **Files created:**
  - `src/data/uhrzeit.ts` — A1 telling-time phrases (client UI data, not a DB seed)
  - `src/components/stories/StoryComprehensionQuiz.tsx` — comprehension MCQs
- **Files modified (additive):**
  - `src/pages/CalendarPage.tsx`, `src/pages/PronunciationPage.tsx`, `src/pages/StoriesPage.tsx`,
  - `src/components/Layout.tsx`, `src/index.css`, `src/types/curriculum.ts`, `package.json` (typecheck)
- **Blocked:** Phase 3b Articles Akk (needs Kilo Akk-context seeds; ArticlesPage speech core protected).
- **Needs from Kilo (content owners):** vocab category tagging/execute, 100+ sentences, Roleplay scenarios, Articles Akk-context sentences, story MCQ content (`MicroStory.questions`), time-vocab category seed (Uhrzeit already runs from local UI data; can swap to seeded content later).
- **Lesson-complete rule:** visit-counts-as-complete (A1PathVisitTracker persists `meroDeutschA1Path:{userId|guest}`).
- **Storage:** new key `meroDeutschA1Path:{userId|guest}` — does NOT touch XP / progress / queue / streak keys.
- **Protected files respected:** ArticlesPage speech core, `useSpeechRecognition.ts`, `useAuth.tsx` — untouched this pass.
