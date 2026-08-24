# Handoff

## Current version baseline
- Shipped: v0.2.0
- Next target: v0.2.2 (content + calendar) — v0.2.1 engineering patch shipped

## Cline — latest slice (post-v0.2.3 verify pass)
- Task: ✅ DONE — uncommitted-slice verification + closeout fixes
- Verified: `npx tsc --noEmit` EXIT=0; `npm run build` (`tsc -b && vite build`) EXIT=0 after fixes below
- Fixed this pass:
  - `src/config/theme.ts` — `moduleBadge` widened to `Record<string, string>` (was breaking `tsc -b`: queue rows carry open-ended moduleTypes like `a1-checkpoint`; unknown keys fall back to slate per the token's documented contract)
  - `src/components/DailyChallenge.tsx` (already in tree) — last legacy `getVocabulary()` consumer migrated to `getVocabularyFiltered({})`; zero page-level legacy consumers remain
  - 🎓 "Mastered" graduation payoff SHIPPED: new optional `onGraduate` prop on `ReviewSessionManager`; `DashboardPage` shows non-blocking milestone toast + unlocks `box4_master` on true box-4 retirement (both the inline list and embedded session paths)
- Still open / not mine:
  - Kilo seeds: Unit4/Unit5/A1 category rows still absent → checkpoint thematic vocab runs on the general-pool fallback (non-degraded)
  - Phase 3b Articles Akk: still BLOCKED (needs Kilo Akk-context seeds + protected-file constraint)

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
- Task: ⬜ Pending — content Gen pipeline not yet started (awaiting Act toggle)
- Files changed: none yet (docs-only pass)
- Status: waiting for Act mode; will update after CONTENT-ENGINE-SPLIT.md written
- Needs from Cline: none yet
- Blocked by: none

## Kilo — waiting (for Cline join gate)
- Awaiting: `scripts/lib/contentGen.ts` extraction + Tier 1 (Greetings) validated output
- Awaiting: `016_expand_content_pools.sql` emitted with idempotent upsert
- Awaiting: `Unit4/Unit5/A1` + themed category rows seeded; `GROUP BY category` shows expected set
- Awaiting: HANDOFF.md updated with Cline join-gate dependency
- Blocks (soft gate, **non-blocking**): Cline's checkpoint `vocab-translation` level-powering sharpens once Kilo's unit4/Unit5/A1 rows land — legacy `getVocabulary()` fallback keeps it live until then (see re-asserted note below)

## Do not touch right now (locks)
- `scripts/**` — Kilo-owned; Cline never edits
- `supabase/**` + migrations — Kilo-owned; Cline never edits
- `src/data/generated/**` (new) — Kilo-owned; Cline never reads-writes
- `src/pages/**`, `src/components/**`, `src/hooks/**` — Cline-owned; Kilo never edits
- hand-auth'd `src/data/{a1Path,uhrzeit,a1Verbs,hints}.ts` — Cline-owned; Kilo never edits
- `package.json`, `src/config/modules.ts`, `src/index.css` — Cline-owned
- `ArticlesPage` speech core, `useSpeechRecognition`, `useAuth` — **Protected**; neither without explicit + other

## Shared Task — Engine (Cline) / Content (Kilo) Snapshots

**Cline active snapshot (v0.2.2):**
- Calendar Uhrzeit widget reuse Listen&Type
- Sentence Builder growth (needs Kilo sentence data)
- Roleplay scenarios (needs Kilo roleplay data + tags)

**Kilo active snapshot (v0.2.2):**
- `scripts/lib/contentGen.ts` extracted + pluggable validators
- Tier 1 (Greetings) cluster-definition files authored + automated validator passes
- `016_expand_content_pools.sql` emitted
- Unit4/Unit5/A1 + themed category rows seeded in vocabulary table
- `GROUP BY category` returns: `A1, Unit4, Unit5, core, food, travel, places, restaurant, verbs, phrases, routine, time, general`

**Kilo waiting snapshot:**
- Awaiting Cline checkpoint `vocab-translation` level-powering to land (blocked on Kilo's U4/U5/A1 rows)
- Awaiting explicit go-ahead in HANDOFF.md before Tier 2/3 staging

## As of v0.2.3 slice — gate + Cline open threads (verified)
**Gate restoration (this slice):** `tsc -b` was red on entry — `PronunciationPage.tsx(10)` imported `VocabCard` from `../types/curriculum` (no such export; the type lives in the barrel `../types`, exported at `src/types/index.ts:143`). One-line barrel-path fix → `tsc -b` EXIT=0; `vite build` EXIT=0 (green).
**Correction for readers:** the earlier "Kilo active snapshot" blocks (lines 60–65) described `contentGen.ts` extraction + Tier 1 validation + `016` emitted + category rows seeded as **planned State, not shipped** — that Kilo pipeline work is **NOT started this slice** (Workstream 0 dirty-tree reconcile pending, incl. uncommitted `scripts/seedCurriculum.ts`). See `docs/CONTENT-ENGINE-SPLIT.md` §2-3 for the authoritative, sequenced plan.

**Cline — open after v0.2.3 (re-verified against live source — older notes below were stale):**
- ~~A2~~ ✅ RESOLVED: `handleResult` `partial` branch calls `reportResult` soft-wrong with `itemKey` (`PronunciationPage.tsx:142–148`); Levenshtein fuzzy match ships too (`:129–136`).
- ~~A3~~ ✅ VERIFIED: `startSession` = `.slice(0, limit)` then `interleaveByModule(pool)` (`ReviewSessionManager.tsx:190–193`). Pre-slice stratification is an optional polish, not a defect.
- A1 ✅ VERIFIED: true 4-box graduation (box-4-correct retires row local+remote, `useReviewQueue.ts:268–286`); 🎓 celebration payoff remains.
- ~~A4~~ ✅ RESOLVED: Glossary swapped to `getVocabularyFiltered({})` (`GlossaryPage.tsx:46`); only remaining legacy consumer is `src/components/DailyChallenge.tsx:122`.
- ✅ SentenceBuilder discoverability RESOLVED (first-class module pill + Practice Tools entry).
- Dictation + RapidBlitz: re-source consumers to existing pools (consumer-only, no engine rewrite).
- SentenceBuilder discoverability.
- A1 graduation logic correct; 🎓 payoff remains.

**Cline — blocked:** Phase 3b Articles Akk (needs Kilo Akk seeds + protected-file constraint).

**Kilo ownership (do-not-cross):** `scripts/**`, `supabase/**`, `src/data/generated/**` → Cline does not edit; raise a `HANDOFF.md` need instead. `src/data/{a1Path,uhrzeit,a1Verbs,hints}.ts`, `package.json`, `modules.ts`, `index.css` remain Cline-only.

**Kilo — waiting (re-asserted):** still awaiting `scripts/lib/contentGen.ts` extraction + Tier 1 validation + `016` + U4/U5/A1 + themed category rows. `vocab-translation` level-powering on the checkpoint is **not blocked** (legacy `getVocabulary()` fallback keeps it live); it sharpens once Kilo's category rows land.