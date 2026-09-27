# Admin Control Centre — Phase Handoff

**Written:** 2026-09-30 · **Branch:** `main` · **Last commit:** `039a166`

Read this before touching the admin surface. It records what is actually true,
including the things that are wired but **unproven**, and the architectural
limitation that decides how the next task must be scoped.

---

## 1. TL;DR

| | |
|---|---|
| **Checks** | **983 passing** across 17 suites · `npx tsc -b` clean · `npm run build` clean · `npm run lint` 0 errors |
| **Deployed** | Edge Function `admin-action` **v3**, `verify_jwt: true` |
| **Migrations applied** | `20260930000000`, `20260930010000`, `20260930020000` |
| **Live DB** | `curriculum_units` **0 rows** · `admin_audit_log` **0 rows** · `curriculum_source` = **`bundle`** |
| **Biggest risk** | **No write path has ever executed against production.** Every call returns `401`. |
| **Blocking decision** | The learner app **cannot** serve `db` curriculum without a boot-gate change (§4) |

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

### Task A — rollback action (do this next)
`curriculum_versions` receives a snapshot on **every** `unit.publish`, so the
history a rollback needs already exists. Nothing reads it back.

- Add `unit.rollback` to `KNOWN_ACTIONS` in `guards.ts`
- Pure validation in `publish.ts`: a rollback must not restore a snapshot that
  would produce an invalid spine
- Handler in `index.ts`: read the newest `curriculum_versions` row for a unit,
  write it back to `curriculum_units.doc`, re-validate, audit
- Tests in `publish.check.ts`
- UI in `CurriculumStorePanel.tsx` (versions are already rendered read-only)

### Task B — content editor
`CurriculumStorePanel` **publishes what the backfill imported; it does not
author.** There is no per-field editing anywhere.

- Add a `unit.save` action: write a **draft** doc (`is_published` stays `false`)
- Reuse `checkUnitShape` / `checkPublishSet` — do not reimplement
- A textarea in the store panel, surfacing validation errors before publishing

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

1. **Nothing has run live.** Every `admin-action` call returns `401
   unauthenticated`. That proves the auth wall and **nothing else**. Ban,
   promote, `config.set`, `unit.publish`, `vocab.repair` are unit-tested and
   deployed, never executed end-to-end.

   **First thing to do: a smoke test on a throwaway user.** Sign in → ban →
   confirm in the UI → check `/audit-log` produces its first row. ~5 minutes, and
   it converts ~1000 lines of deployed code from "should work" to "proven".

2. **The 47 vocabulary findings are candidates, not defects.** Live SQL showed at
   least two are **correct**: `Fahrkarte → ticket` and `schlecht → bad` only trip
   the detector because "ticket"/"bad" collide with unrelated German words. The
   constant-row-offset misalignment theory was **tested and rejected**. Every
   value must be human-supplied, per row. Do not auto-repair.

3. **`vocab.clear_flag` is registered but returns `501`.** Implement it or remove
   it from `KNOWN_ACTIONS`. A permanently-501 action is the same smell as the
   silent no-op already fixed.

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
foreach ($s in @('check:debugmode','check:qabridge','check:userfilters',
  'check:analytics','check:userdetail','check:reviewqueue','check:integrity',
  'check:csv','check:auditlog','check:search','check:adminaction',
  'check:adminactionclient','check:adminpublish','check:currstore',
  'check:currsource','check:currresolve','check:deployfilter')) {
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
