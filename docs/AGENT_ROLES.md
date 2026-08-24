# Agent Roles — MeroDeutsch

## Cline — owns

- **Features**, UI, pages, components, routes, most hooks
- All `src/pages/`, `src/components/`, `src/hooks/` code
- User-facing behavior, styling, interactions

## Kilo — owns

- **DB/content**, seeds, migrations notes, vocab tags, sentences/roleplay data, planning docs
- All `scripts/`, `supabase/migrations/` files
- Data schemas, seeding logic, category/tag definitions

## Shared rules

- Read `HANDOFF.md` + `BACKLOG.md` first before touching shared areas
- **Protected files**: `ArticlesPage`, `useSpeechRecognition`, `useAuth` — coordinate before editing
- Phase 0 review (Leitner, clear-all, filters, answer reveal) = no reopen unless proven regression
- No secrets in git; `tsc + build` when touching app code
- `a1Path` categories and curriculum service: coordinate on changes

## File ownership table

| Path | Owner |
|---|---|
| `src/pages/` | Cline |
| `src/components/` | Cline |
| `src/hooks/` | Cline |
| `scripts/` | Kilo |
| `supabase/migrations/` | Kilo |
| `docs/` | Either (Kilo preferred for DB docs) |
| `a1Path` categories & curriculum service | Coordinate |

## Next sync

- Cline: finish current feature → update `HANDOFF.md`
- Kilo: category inventory + tagging plan (as parallel docs)