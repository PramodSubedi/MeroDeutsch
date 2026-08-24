# Kilo Instructions — Content & Curriculum Strengthening (authoritative)

## 0. Your role in this task
MeroDeutsch has two parallel, non-overlapping workstreams this slice:

| Workstream | Owner | Surface |
|---|---|---|
| Engine & Mechanics (A1–A4, wiring) | **Cline** | `src/` app code only |
| Content Generation Pipeline (Part C) | **Kilo (you)** | `scripts/` + `supabase/migrations/` + `src/data/generated/` |

The **only** hard requirement: never edit a file Cline owns. Your full ownership set + "never touch" set is the two tables in §4. If a task would force you into Cline's surface, stop and file a HANDOFF need instead.

## 1. Deliverables (in strict order)
Each step is a separate, reviewable unit. Do not roll steps together.

### Step 1 — Extract the reusable pipeline core (one-time, unblocks everything)
Create **`scripts/lib/contentGen.ts`** by extracting the already-proven machinery from `scripts/generateA1VocabClusters.ts` (the pipeline that built the 1000-row `vocabulary` table):
- provider selection (the LLM-call boundary),
- staged-file-write behavior (to `src/data/generated/**`, never the DB),
- dedup logic (against live rows + within batch),
- make validation **pluggable per content type** (today it is vocab-specific).
- **German content is never LLM-authored.** The LLM localizes only (EN + Nepali/Devanagari) from a human-curated German source list. Preserve the existing local-validator guarantees: article correctness, non-empty translations, Devanagari check, length caps, article checks.

### 1.2 — Author cluster-definition files (mirror the existing `CLUSTERS: Cluster[]` pattern)
Human picks the real German content; the LLM fills translations/localized variants. Four files, tier-gated:

| Content | Current | Target | Tier | Deliverable shape |
|---|---|---|---|---|
| Greetings | 8 | 30–40 | **1** | `greeting` phrases + `en` + `ne` + usage context |
| Grammar-drill | 20 | 150–200 | **2** | conjugations across sein/haben/machen/cases/Nom↔Akk/Bridge tabs |
| Sentences | 58 (Akk-only) | 200+, multi-focus | **2** | shifted away from Akkusatz-only |
| Story-sentence | 8 (3 stories) | 80–100 (8–10 stories) | **2** | narrative + A1-vocabulary-level control |
| Roleplay-scenario | 3 | 15–20 | **3** | full branch: `steps[].npc/.prompt/.options[].text/.ok/.fb` |

### Step 3 — Emit the next migration (one-migration rule)
Extend `scripts/seedContentPools.ts` / `scripts/genSeedSql.ts` and emit **`supabase/migrations/016_expand_content_pools.sql`** following the **same idempotent pattern already in `012`** (`ON CONFLICT (content_type, id) DO UPDATE SET payload = EXCLUDED.payload, sort = EXCLUDED.sort`). Do not edit `012` or any prior migration. Do not create `017`.

### Step 4 — Seed the `Unit4` / `Unit5` / `A1` category rows
Per `docs/VOCAB-CATEGORIES.md`, `getVocabularyFiltered` + the `a1Path.ts` checkpoint try-list/fallback **need** the documented category values present in `public.vocabulary.category`:
```
U4 targets:  ['food','travel','places','directions','restaurant','core']
U5 targets:  ['verbs','phrases','routine','core']
U4/U5 try-list direct:  'Unit4','Unit5'
A1 fallback registry pool:  'A1'
```
Seed these rows **in migration 016** (it is the single intended place for content this pass). Verify with:
```sql
SELECT category, COUNT(*) FROM vocabulary GROUP BY category ORDER BY category;
```
…returns all of `A1, Unit4, Unit5, core, food, travel, places, restaurant, verbs, phrases, routine, time, general`.

## 2. Your authority (this task only) and its gates
This slice **lifts** the prior "Kilo docs-only / no seeding" constraint **for the generated-content branch only**. It does NOT grant access to `src/`. The lift is gated:

| Tier | Gate before staging |
|---|---|
| Tier 1 (Greetings) | Automated validator passes → may stage |
| Tier 2 (Grammar, Sentences, Stories) | **Mandatory human second-pass review of every batch** (a wrong conjugation/word order teaches an error) |
| Tier 3 (Roleplay) | **Full manual playthrough of every scenario.** No spot checks. Varying option plausibility and feedback per option verified. |

All staged output must also pass the branch validator before any upsert.

## 3. What NOT to do (Kilo guardrails)
- ❌ Don't hand-author a few extra items into `012`. The **pipeline is the deliverable**, not a one-off bigger migration.
- ❌ Don't grow Dictation or RapidBlitz pools. Cline will re-surface those consumers to existing pools — outside your surface.
- ❌ Don't touch any `src/` file (incl. `src/pages`, `src/components`, `src/hooks`, hand-auth'd `src/data`).
- ❌ Don't edit `package.json`, or the protected speech/auth files (`ArticlesPage` speech core, `useSpeechRecognition`, `useAuth`).
- ❌ Don't invent new migration numbers or rewrite existing ones.
- ❌ Don't commit secrets, and wrap every LLM call so German content is never generated — only localized.

## 4. File-ownership matrix (the collision contract — read both dimensions)
| Path | Owner | Never-touch rule |
|---|---|---|
| `scripts/**` | Kilo | Cline never edits |
| `supabase/**` + migrations | Kilo | Cline never edits |
| `src/data/generated/**` (new) | Kilo | Cline never reads-writes |
| `src/pages/**`, `src/components/**`, `src/hooks/**` | Cline | Kilo never edits |
| hand-auth'd `src/data/{a1Path,uhrzeit,a1Verbs,hints}.ts` | Cline | Kilo never edits |
| `package.json`, `src/config/modules.ts`, `src/index.css` | Cline | — |
| `ArticlesPage` speech core, `useSpeechRecognition`, `useAuth` | **Protected** | Neither without explicit + other |

## 5. Definition of done + how to report
When all of the following are true, you may mark your `[Kilo]` items done in `BACKLOG.md` and set `HANDOFF 'Kilo — active' → ✅ DONE`:
- [x] `scripts/lib/contentGen.ts` extracted and Pluggable validators in place
- [x] All four cluster-definition files authored under tier-gates (Greetings validated; Grammar/sentences/stories human-revealed; Roleplay full-played)
- [x] Staged JSON written under `src/data/generated/` — **not** committed as live DB
- [x] `016_expand_content_pools.sql` emitted with idempotent upsert
- [x] `Unit4/Unit5/A1` + U4/U5/themed category rows seeded; `GROUP BY category` shows the expected set
- [x] `BACKLOG.md` `[Kilo]` items checked; `HANDOFF.md` updated with the Cline join-gate dependency

## 6. Head hire with Cline (the join gate)
- Your Step 1 + Tier 1 can run **in parallel** with Cline's A1–A4+re-route (no file overlap).
- Cline's checkpoint `vocab-translation` level-powering is **blocked on your unit4/Unit5/A1 rows**; until they a land, the existing `a1Path.ts` A1 fallback keeps it non-degraded — so this is a soft/gate, not a blocker.
- When your seeds are ready, say so explicitly in `HANDOFF.md` so Cline can proceed with the checkpoint level filter.