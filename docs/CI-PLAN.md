# CI Plan — MeroDeutsch (proposed GitHub Actions)

## Overview

CI runs on every PR and on pushes to `main`. Jobs are matrix'd to test multiple Node.js versions.

## Jobs

### 1. Lint
- `npm run lint` (oxlint)
- Fails on warnings

### 2. Typecheck
- `npx tsc --noEmit`
- Fails on any type error

### 3. Build
- `npm run build` (tsc -b + vite build)
- Verifies production build succeeds

### 4. Test (future)
- `vitest run` — once Vitest is configured
- Currently skipped until test files are added

## Matrix

| Node version | 20 | 22 |
|-------------|----|----|
| Lint        | x  | x  |
| Typecheck   | x  | x  |
| Build       | x  | x  |

## Workflow file location (planned)

`.github/workflows/ci.yml` — docs-only discussion; not created in this pass.

---

*This is a proposal only. No `.github/workflows` added.*