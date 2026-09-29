# Admin Control Centre — Phase Handoff

**Written:** 2026-09-30 · **Branch:** `main` · **Last commit:** `039a166`

Read this before touching the admin surface. It records what is actually true,
including the things that are wired but **unproven**, and the architectural
limitation that decides how the next task must be scoped.

---

## 1. TL;DR

| | |
|---|---|
| **Checks** | **1267 passing** across 24 suites · `npx tsc --noEmit` clean · `npm run build` clean · `npm run lint` 0 errors (43 warnings) |
| **CI** | GitHub Actions runs all 24 suites + tsc + lint + validate on every push (`.github/workflows/checks.yml`). **Never actually executed** — Actions only runs on push. |
| **Deployed** | Edge Function `admin-action` **v7**, `verify_jwt: true`, `ADMIN_ALLOWED_ORIGIN` set |
| **Migrations applied** | `20260930000000`, `20260930010000`, `20260930020000` |
| **Live DB** | `curriculum_units` **16 rows, 0 published** · `curriculum_versions` **0 rows** · `curriculum_source` = **`bundle`** |
| **Live-verified** | `unit.save` + `unit.rollback` executed end-to-end against production, including a bidirectional rollback round-trip. Two real bugs were found this way and fixed — see §5. |
| **Biggest risk** | **`curriculum:verify` is RED at HEAD** (parity diffs in `a1Path`), unrelated to this work — see §6.5. |
| **Blocking decision** | Publishing all 16 units and flipping `curriculum_source = 'db'` is **deliberately still pending** — the content is unreviewed. |

### 5.0 What changed in this pass

**Task A — `unit.rollback` (DONE, live-verified).** Restores a unit from
`curriculum_versions`. Validation reuses `checkUnitShape`/`checkPublishSet`
rather than reimplementing them. The live doc is archived **before** the write,
so a rollback is itself reversible — verified by round-trip. Rollback restores
**content only** and never changes publication state.

**Task B — `unit.save` + editor (DONE, live-verified).** Writes a DRAFT and can
never publish: `is_published` is preserved on update and forced `false` on
insert. `unit.publish` remains the only path that makes content live. The editor
is `src/admin/components/UnitDocEditor.tsx` — a JSON textarea (the document *is*
the interface; a per-node form would be a second, divergent definition of the
node shape) with an `updated_at` stale-write guard.

**Boot-gate (DONE, locally verified).** `src/main.tsx` now imports `App`
**dynamically** after `runBootGate` resolves. This is the load-bearing change:
`index.ts` derives the spine in module scope and ~50 modules read it
synchronously, so a static import would have pinned the graph to the bundle and
left the flag permanently inert. Built output confirms it: `bootGate-*.js` is a
separate chunk loaded before `App-*.js`.

> **NOT verified live.** The boot-gate has never run with `curriculum_source = 'db'`,
> because that flag is still `bundle`. Its 35 checks cover the decision logic
> (bundle default, validation, offline, hung request, late response) but the
> end-to-end `db` boot still needs a published course first.

### Two bugs the live smoke test caught

Neither was reachable by unit tests, and both are now pinned:

1. **`unit.save` 500'd on every call.** `curriculum_units.order` is a
   `NOT NULL` column that the backfill writes alongside `doc`; the handler
   omitted it, so a valid document failed with an opaque "could not be saved".
   A schema fact the handler knew nothing about.

2. **Every rollback was refused, blaming the wrong unit.** The handler passed
   *all* units into the set check rather than only the **published** ones. `m16`
   is a draft with no checkpoint, so every rollback failed on a defect in a draft
   no learner can reach. The set a rollback must preserve is the *served* spine.

---

## 2. Do not touch these files

A **second agent is actively editing curriculum content.** These are uncommitted
and belong to them:

```
scripts/curriculum/snapshot.ts
src/data/curriculum/lessons/m06.json
src/data/curriculum/lessons/m08.json
src/data/curriculum/lessons/m11.json
src/data/curriculum/units/m14.json
src/data/curriculum/units/m15.json
```

Never `git add -A` here. Stage explicit paths. I made this mistake once and
nearly committed their work.

Also: **`.clinerules` is gitignored** (with `TASKS.md`, `AI_HANDOFF.md`). The
Part M amendment exists on disk only and is **not** in git. If it matters, it
needs a tracked home — a deliberate decision, not an accident.

---

## 3. What is built and verified

### Phase 1 — read-side (complete)
- **User 360** — `UserDetailDrawer.tsx` + `data/userDetail.ts`
- **Review Queue** — `/review-queue` + `data/reviewQueue.ts`
- **Content Integrity** — `/integrity` + `data/integrity.ts`
- **⌘K palette** — `SearchPalette.tsx` + `data/search.ts`, covering nav, users,
  vocabulary, audit, **`content_items`** and **curriculum unit documents**
- **CSV** — one shared encoder in `data/csv.ts`; exports for users, vocabulary,
  review queue, audit log

### Phase 2 — service-role writes (complete)
- `supabase/functions/admin-action/` — `index.ts`, `guards.ts`, `publish.ts`
  (+ `.check.ts` suites, **99** and **83** checks)
- Privileged controls in the User 360 drawer; vocabulary repair on Integrity
- Audit Log page — `/audit-log`

### Phase 3b — curriculum source (foundation only — see §4, §5)
- `curriculum_units` table, **created empty**, service-write-only
- `curriculum_source` flag seeded `"bundle"`, read, validated, fallback-tested
- Store panel with publish + source switching
- Backfill script, **dry-run by default, never applied**

---

## 4. The single most important open question

> **For `db` curriculum to reach a learner, the curriculum modules must be
> evaluated *after* resolution. That has not been done.**

`a1Path.ts` snapshots the spine into ~50 module-scope constants at **import
time**:

```ts
import { RESOLVED_PATH } from './curriculum';
export const A1_UNITS = RESOLVED_PATH.units;
```

Those bindings freeze when the module graph is evaluated. `main.tsx` statically
imports `App`, which imports `a1Path`. Resolution therefore always happens too
late.

**This is why there is no `location.reload()`.** A reload re-evaluates the graph
*before* any network resolution, and `RESOLVED_PATH` is computed synchronously
from the bundle — so it serves the bundle again, every time. Shipping a reload
would have been a loop risk plus a false impression of success.

`src/hooks/useCurriculumSource.ts` therefore **resolves and records** the
decision (DEV-logged). It is observability, not behaviour.

### The remaining change, precisely

In `src/main.tsx`, replace the static `import App from './App'` with a gate:

```ts
// resolve with a BOUNDED wait, then import
await withTimeout(startCurriculumResolution(), 2000);  // must not block boot
const { default: App } = await import('./App');
```

`src/data/curriculum/sourceApply.ts` already holds the **pure** reload-decision
logic with **18 checks**, including the loop guard (`sessionStorage` marker) a
naive implementation gets wrong. Reuse it.

**Acceptance criteria before calling it done:**
1. First paint is **not** delayed when offline or the flag is `bundle`.
2. With flag `db` and published units, a cold load serves them.
3. With flag `db` and **no** published units, learners still get the bundle.
4. Boot timing measured cold-cache, offline, and slow-3G.
5. `curriculum:validate` still 0 issues.

---

## 5. Remaining work, in dependency order

### Task A — rollback action — **DONE**
`curriculum_versions` receives a snapshot on **every** `unit.publish`, so the
history a rollback needs already exists. Nothing reads it back.

- [x] Add `unit.rollback` to `KNOWN_ACTIONS` in `guards.ts`
- [x] Pure validation in `publish.ts` (`checkRollback`, `unwrapSnapshot`,
      `snapshotUnitId`) — reuses `checkUnitShape`/`checkPublishSet`
- [x] Handler in `index.ts`: validate against the published set, archive the live
      doc, write back, audit success and refusal
- [x] Tests in `publish.check.ts` (sections 11–13)
- [x] UI in `CurriculumStorePanel.tsx` — versions are now actionable
- [x] Live: published → broke a unit → rolled back → undid the rollback

### Task B — content editor — **DONE**
`CurriculumStorePanel` **publishes what the backfill imported; it did not
author.** There was no per-field editing anywhere.

- [x] `unit.save` action: writes a **draft** doc, can never publish
- [x] Reuses `checkUnitShape` — does not reimplement
- [x] `UnitDocEditor` textarea surfacing validation errors before publishing
- [x] Live-verified, including the two refusals (id mismatch, no checkpoint)

### Task C — run the backfill
```bash
npm run curriculum:validate          # must be 0 issues FIRST
npm run curriculum:backfill          # dry run; READ all 15 lines
npm run curriculum:backfill -- --apply
```
Rows land as `is_published = false` and the script is an upsert, so it is
re-runnable. **Note:** the bundle on disk is mid-edit by the other agent, so a
backfill now captures a moving target. Acceptable *for drafts*; **not**
acceptable to publish them.

### Task D — route integrity check
No smoke tests have ever run. A browser test needs admin credentials, so the
achievable check is **static**: every `NAV_ITEMS` path has a matching `<Route>`,
and every `<Route>` element is imported. That catches the realistic failure mode
(a route typo) and belongs in the same pure-check style as the rest.

---

## 6. Standing caveats — do not skip these

1. **Nothing has run live.** Every `admin-action` call made so far returns `401
   unauthenticated`. That proves the auth wall and **nothing else**. Ban,
   promote, `config.set`, `unit.publish`, `vocab.repair` are unit-tested and
   deployed, never executed end-to-end.

   **`/system` now has a Self-test panel** (`system.selftest`) that walks
   identify → `loadActor` → `countActiveAdmins` → `evaluateAction` → audit and
   reports each step. It changes no user, no flag and no curriculum; the only row
   it writes is its own audit entry. Run it first.

   **Still to do: a smoke test on a throwaway user.** Sign in → ban → confirm in
   the UI → check `/audit-log` produces its first row. ~5 minutes, and it
   converts the rest of the write path from "should work" to "proven". The
   self-test proves the path is REACHABLE; only the smoke test proves it applies
   the change it claims.

2. **The 47 vocabulary findings are candidates, not defects.** Live SQL showed at
   least two are **correct**: `Fahrkarte → ticket` and `schlecht → bad` only trip
   the detector because "ticket"/"bad" collide with unrelated German words. The
   constant-row-offset misalignment theory was **tested and rejected**. Every
   value must be human-supplied, per row. Do not auto-repair.

   The finding's `detail` text now says so. It used to tell the operator that
   learners are being taught the wrong meaning for "every one of these", which
   would have led to bulk-repairing correct rows.

3. **`vocab.clear_flag` is registered but returns `501`.** It was also MISSING
   from the client's `AdminActionName` union, so it was unreachable from the UI
   entirely — caught by `check:adminaction` §14, which now compares the two lists.
   Implement the handler or remove it from `KNOWN_ACTIONS` and the union. A
   permanently-501 action is the same smell as the silent no-op already fixed.

4. **CORS — FIXED AND DEPLOYED, but the lesson is the point.**
   `ADMIN_ALLOWED_ORIGIN` was read in exactly one place and **set nowhere** —
   no `config.toml`, no deploy doc, no CI step. Every response therefore carried
   a blank `Access-Control-Allow-Origin`, the browser discarded every reply, and
   ban / promote / demote / publish / repair were all unreachable. Read-only
   screens kept working, because PostgREST and GoTrue send their own CORS
   headers, so the control centre looked healthy right up to the write button.

   **DONE:** secret set, function at v5, verified live — the admin origin and
   localhost are granted, `https://evil.example` is refused, `Vary: Origin` is
   set. Rules live in `cors.ts`, pure, 48 checks. A missing secret now writes a
   loud `console.error` on every POST, so the failure is visible in the function
   logs instead of being a mystery.

   **But it took hours to find, and that is the real lesson.** It was invisible
   to every check because the value lived in Deno's environment. This is the
   THIRD time in one session that something critical was unfalsifiable by the
   test suite: an unwired `*.check.ts`, the CORS secret, and
   `curriculum:verify` running nowhere. **A check that nothing runs is
   indistinguishable from a passing one.** When adding a check, add the npm
   script AND the CI step, or it does not exist.

6. **LEARNER PROGRESS WAS SILENTLY ORPHANED BY THE v4.0 RENAME — NOW FIXED.**
    The V4 migration (`V4_ORDER_MARKER` / `remapV3UnitIndex` in `useA1Path.tsx`)
    remaps `unlockedUnitIndex`, `checkpointBestByUnit` and `attemptsByUnit`, and
    its original comment said:

    > *"this one is a pure REORDER: every unit still exists with the same id and
    > the same content, so `completedNodeIds` is left completely alone"*

    **That premise was false.** Unit ids are stable, but 20 NODE ids were renamed,
    from semantic to positional:

    ```
    m06-professions → m06-learn        m09-separable → m09-learn
    m06-grammar     → m06-practice     m09-prefix    → m09-practice
    m06-gate        → m06-checkpoint   (m06…m15, every unit)
    ```

    `isNodeComplete` is `completedNodeIds.includes(node.id)`. So every learner who
    finished a renamed node showed it **incomplete**. They were not locked out —
    `unlockedUnitIndex` was remapped, so checkpoint gating still held — but up
    to 20 nodes per learner reverted to "not done".

    **RESOLVED.** `useA1Path.tsx:282` now calls `remapV3NodeIds(completedNodeIds)`
    before pushing `V4_ORDER_MARKER`, keyed on unit id + node kind rather than on
    position, and `remapV3NodeIds` is idempotent. The marker is pushed after the
    map so it is not itself run through it.

    *This section previously said the fix was still outstanding. It was already
    in the code, and the only thing disagreeing with it was this document — which
    is the same failure as the silent-no-op `vocab.repair` fixed earlier in the
    same session: a claim that outlived the code it described, because nothing in
    the code checked the prose.*

   **STILL OPEN: `curriculum:verify` is red.** After the v4.0 re-sequence
    (15 → 16 units) it reports 40 value-parity differences and exits 1.

    **`npm run curriculum:baseline` CANNOT fix this.** It rebuilds from the
   *frozen pre-P0 source* — running it reproduces the 15-unit baseline
   byte-for-byte. There is no tooling to re-cut the baseline to the current
   spine; that is a deliberate manual edit, and it means accepting the v4.0
   sequence as the new truth.

   Read the 40 differences first. They are renumbered `bonusNodes` and renamed
   `nodeIds` (`m11-shopping` → `m11-practice`). If that is what the re-sequence
   was meant to do, re-cut the baseline by hand and wire this into CI. If not,
   the re-sequence is wrong. **Do not silence it** — right now it is the only
   thing standing between "the spine changed" and "nobody noticed".

---

## 7. Conventions

- Checks are `*.check.ts` beside the module, run via `npm run check:<name>`,
  `process.exit(1)` on failure. **Add one with every new pure module.**
- Security rules live in `guards.ts` / `publish.ts` — **pure, no Supabase
  import** — and are tested there. Keep request handling thin.
- Diffs carry a comment block explaining *why*, not *what*.
- Re-verify claims against the plan's wording, not your own summary. I twice
  reported "complete" and was wrong both times; the reliable check is a
  line-by-line diff of the plan against the codebase.

---

## 8. Run everything

```bash
# All 21 suites. If you add a *.check.ts, add it here AND to
# .github/workflows/checks.yml — an unwired suite is a suite that silently
# never runs (this is how check:currapply stayed orphaned, and how
# curriculum:verify stayed red and unnoticed for a whole session).
#
# NOT in this list, on purpose:
#   curriculum:backfill — touches the live database. Dry run only.
#
# Also run these by hand; they are about DATA, not code:
#   npm run curriculum:verify    # spine drift — now also in CI
#   npm run curriculum:backfill  # dry run only, do NOT --apply without review
foreach ($s in @('check:debugmode','check:qabridge','check:userfilters',
  'check:analytics','check:userdetail','check:reviewqueue','check:integrity',
  'check:csv','check:auditlog','check:search','check:adminaction',
  'check:adminactionclient','check:adminpublish','check:cors','check:currstore',
  'check:currsource','check:currresolve','check:currapply','check:currboot',
  'check:v4migration',
  'check:deployfilter','check:answers','check:chatbot')) {
  npm run $s
}

npx tsc -b --force
npm run build
npm run lint
npm run curriculum:validate     # 0 issues
npm run curriculum:backfill     # dry run only — do NOT --apply without review
```

Live check used during verification:

```sql
select (select count(*) from public.curriculum_units) as units,
       (select count(*) from public.admin_audit_log) as audit,
       (select value #>> '{}' from public.app_config
         where key='curriculum_source') as source;
```
