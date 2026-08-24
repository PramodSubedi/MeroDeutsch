# QA Plan — MeroDeutsch v0.2.0

## 1. What test tooling exists today (check package.json)

- **`oxlint`** — lint script (`npm run lint`)
- **`typescript`** — `~6.0.2`; `tsc --noEmit` available via build script
- **Vitest** — not yet installed/configured; will be added in future
- **`tsx`** — runner for scripts (seed, enrichment, etc.)
- No test runner or test files currently present

## 2. Minimal future Vitest list (plan only)

- `questionGenerator` — verifies question output shape for a given vocab set
- `filterReviewQueue` — tests filter logic if exported from `useReviewQueue`
- `dateUtils` — unit tests for date formatting/helpers used in checkpoint UI
- `vocabFilter` — tests category/tag filtering logic
- `useSessionStorage` — hydrates/restores session state across refresh
- *[reserve]* component snapshot tests for `CollapsibleModuleGroup`, `A1CheckpointPage`
- *[reserve]* integration: `/vocab-trainer` route mounts without errors
- *[reserve]* build sanity: `npx tsc --noEmit` && `npm run build`

## 3. Manual smoke checklist for v0.2.0

- [ ] Unit 4/5 checkpoint loads non-empty vocab set
- [ ] Glossary shows more than ~100 words when online (Supabase fetch)
- [ ] `/vocab-trainer` reachable from Practice navigation
- [ ] `/sentence-builder` reachable from Practice navigation
- [ ] Review list: filter by unit works
- [ ] Review: clear-all button survives page refresh
- [ ] Answer not shown before user response in review session
- [ ] `npx tsc --noEmit` passes with no errors
- [ ] `npm run build` completes successfully