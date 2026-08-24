# Backlog — MeroDeutsch

## v0.2.0 shipped (vocab cap, checkpoint categories, registry)

- [x] vocab cap
- [x] checkpoint categories
- [x] registry

## v0.2.1 eng (Cline): CollapsibleModuleGroup measured height; rapid-blitz → rapid-fire; LanguageToggle extract; build script only if red

- [x] CollapsibleModuleGroup measured height — compute height from actual content rather than `modules.length * 48` (DONE v0.2.1: measured `contentHeight` only; removed `modules.length * 48` fallback)
- [x] `rapid-blitz` → redirect to `/rapid-fire` — route alias for consistency (DONE v0.2.1: `<Navigate>` preserving `?mode=`)
- [x] Extract LanguageToggle if triplicated — consolidate into a single shared component (DONE v0.2.1: `src/components/LanguageToggle.tsx`, reused in desktop + mobile header)
- [x] Build script only if red — skip if no changes (DONE v0.2.1: build was green, no change needed — `tsc -b && vite build` PASS)

## v0.2.2 content: Calendar Uhrzeit (Cline UI); vocab category tagging (Kilo); sentences → 100+ (Kilo); roleplay +2–3 scenarios data (Kilo); optional SentenceBuilder verb hybrid feedback (Cline)

- [ ] Calendar Uhrzeit (telling time) + short practice — a small clock-based practice widget (Cline UI)
- [x] Vocab category tagging — plan: category inventory + tagging plan (Kilo)
- [x] Vocab category tagging — execute: UPDATE/seed so rows use food|travel|places|… (Kilo)
- [ ] Sentences → 100+ — add 100+ sentence entries (Kilo)
- [ ] Roleplay +2–3 scenarios data — add roleplay scenario data (Kilo)
- [x] Optional SentenceBuilder verb hybrid feedback — verb feedback with hybrid approach (DONE v0.2.2-slice: new `src/data/a1Verbs.ts` ~53 A1 verbs + `FORM_TO_VERB` + `getSubjectPerson` (honest sie/Sie); `analyzeError` now takes the correct form from the expected sentence, never from an ambiguous subject; existing DB/Akk/caps path preserved)

## v0.2.3: Stories MCQs (Cline); Articles Akk minimal (Cline, careful with protected file)

- [ ] Stories MCQs — multiple choice questions after story sections (Cline)
- [ ] Articles Akk minimal — minimal Akkusatz article support (Cline, careful with protected file)

## v0.3.0: Pronunciation fuzzy match; stronger A1 pools for pronunciation/dictation

- [ ] Pronunciation fuzzy match — fuzzy STT matching for pronunciation practice
- [ ] Stronger A1 pools for pronunciation/dictation — expanded A1-level audio pools

## Grammar System Coordination (Kilo/Cline) — v0.2.3+

*Shared roadmap for SentenceBuilder rule-based validation. Split by ownership: Kilo = docs/coordination, Cline = src/ implementation.*

- [x] **Kilo: Vocab-category ↔ SentenceBuilder rule interface doc** — document how vocabulary categories (food, verbs, time, etc.) map to SentenceBuilder feedback rules; ensure category tags in DB support rule checking; no src/ changes
- [ ] **Cline: Phase 1 — Verb Conjugation Expansion** (2 weeks) — expand VERBS to 50+, add getSubjectPerson(), update FORM_TO_VERB; modify SentenceBuilder.tsx
- [ ] **Cline: Phase 2 — Rule-Enhanced Feedback** (1 week) — integrate verb conjugation check into analyzeError priority; ensure backward compat with DB matching
- [ ] **Cline: Phase 3 — Multi-Rule Validation** (2 weeks) — add noun capitalization enhancements, Akkusativ context, word order basic check, sentence structure templates; integrated feedback priority ordering
- [ ] **Cline: Phase 4 — Polish & Documentation** (2 weeks) — unit tests for analyzeError, TypeScript checks, bilingual messages, JSDoc updates, CONTRIBUTING.md section
- [ ] **Kilo: Coordination sync** — update HANDOFF.md Needs/Blocked fields when Cline phases conclude; mark BACKLOG items done when docs/coordination complete

## v0.3.0: Pronunciation fuzzy match; stronger A1 pools for pronunciation/dictation

- [ ] Pronunciation fuzzy match — fuzzy STT matching for pronunciation practice
- [ ] Stronger A1 pools for pronunciation/dictation — expanded A1-level audio pools

## Later eng: aria-live, reduced-motion, heatmap keyboard, typecheck+CI, cast cleanup, RPC batch only if needed

- [ ] aria-live — live region announcements for dynamic content
- [ ] reduced-motion — respect reduced-motion preference
- [ ] heatmap keyboard — keyboard usage heatmap
- [ ] typecheck+CI — add typed typecheck script and CI pipeline
- [ ] cast cleanup — clean up cast handling
- [ ] RPC batch only if needed — batch RPC calls if beneficial

## Never default: ModuleChrome on every practice route without IA decision

- Rule: Never add ModuleChrome on every practice route without an IA decision

## Never reopen unless regression: Phase 0 review (Leitner, clear-all, filters, answer reveal)

- Rule: Phase 0 review is done — only fix proven regressions later. No product features in this pass.## Cline phase pass (post-v0.2.0) — implementation log

- **Phase 2a ✅ Calendar Uhrzeit** — `src/data/uhrzeit.ts` (+21 A1 telling-time phrases, client-side UI data — NOT a DB seed) + `src/pages/CalendarPage.tsx` additive third "Uhrzeit" tab + shared Listen&Type deck (module `calendar`, SRS/XP via existing engine). Falls back gracefully if calendar data is sparse.
- **Phase 3a ✅ Stories comprehension MCQs** — new `StoryComprehensionQuestion` on `MicroStory` + `src/components/stories/StoryComprehensionQuiz.tsx` (options shuffled at create, answer revealed after lock, wrong → `addWrongAnswer({ moduleType: 'stories' })`). Renders after the read view ONLY when Kilo-seeded `questions` exist.
- **Phase 3b ⛔ BLOCKED** — Articles Akk: `ArticlesPage`'s article quiz is inlined adjacent to the protected speech-recognition core (`useSpeechRecognition`). A real Akk surface needs either a full ~250-line page duplicate (violates "no new quiz framework / minimal diffs") or editing protected internals. Needs Kilo Akk-context seeds; Cline will revisit once content exists.
- **Phase 4 ✅ Pronunciation A1 pool** — `PronunciationPage` now prefers `getVocabularyFiltered({ level: 'A1' })` (mapped to `{id,de,en,ne}`) with fallback to general vocab; pool now cycles on exhaustion instead of repeating the first word. (DictationPage not touched this pass.)
- **Phase 5 ✅ Engineering** — added `typecheck` npm script (`tsc -b`); global `@media (prefers-reduced-motion: reduce)` guard; milestone toast `<div>` got `role="status"` + `aria-live="polite"`. Heatmap keyboard access still deferred (low-risk, out of time-box).

### Ownership boundaries (honest)
- **Kilo-owned (NOT seeded by me):** vocab category tagging/execute, 100+ sentences, Roleplay +2–3 scenarios, Articles Akk-context sentences, story MCQ content (`MicroStory.questions`), time-vocab category seed.
- **Cline-owned:** all UI wiring, hooks, routes, a11y, typecheck — all additive.
- **Gate results:** `tsc --noEmit` → PASS after every phase; `vite build` → PASS after every phase.
