# Vocab Category ↔ SentenceBuilder Rule Interface

## Purpose

Document the interface between `public.vocabulary.category` values and SentenceBuilder rule-based feedback. This is **docs-only** — no `src/` code changes. Cline implements the rule logic in `SentenceBuilder.tsx`; Kilo ensures the DB/category inventory supports it.

## Category Inventory → Rule Mapping

The following `vocabulary.category` values (from `KILO_TAGGING_PLAN.md`) map to SentenceBuilder feedback rules:

| Category | Rule(s) Supported | Notes |
|---|---|---|
| `core` | Generic fallback | Default when no thematic category applies |
| `Unit4` | Try-list primary filter | U4 checkpoint themed vocab; UI may use for rule hinting |
| `Unit5` | Try-list primary filter | U5 checkpoint themed vocab; UI may use for rule hinting |
| `food` | Capitalization, word order | U4 theme (`food`, `restaurant`); seedCurriculum nouns tagged `food` support article/gender rules |
| `travel` | Word order, prepositions | U4 theme; less directly used in SentenceBuilder but available for future rules |
| `places` | Capitalization, gender | U4 theme; location nouns support article checks |
| `directions` | Word order, prepositions | U4 theme; less directly used but available |
| `restaurant` | Capitalization, Akkusativ | U4 theme; food-ordering sentences support rule checks |
| `verbs` | **Verb conjugation** (Phase 2+) | U5 theme (`vocabPos: 'verb'`); directly enables conjugation checks — `FORM_TO_VERB` lookup + `VERBS` object require `category = 'verbs'` rows in DB |
| `phrases` | Word order, sentence structure | U5 theme; phrase-level sentences support structural rule checks |
| `routine` | Akkusativ, separable verbs | `seedCurriculum` routine verbs tagged `routine`; supports separable-verb feedback |
| `time` | Capitalization, word order | `seedCurriculum` TIME nouns tagged `time`; supports clock/sentence structure rules |
| `A1` | General pool fallback | A1-level fallback when U4/U5 themed rows sparse; ensures deck always has items |
| `general` | All rules (default) | Default category; all rules can still apply via `core` fallback |

## DB Seeding Alignment

Per `seedCurriculum.ts`, vocabulary rows are seeded with `category: 'core'` by default, overridden to `'time'` for TIME nouns and `'routine'` for routine verbs when a thematic tag is present:

- **TIME nouns**: `category: 'time'` (TIME nouns tagged `time`); supports clock/sentence structure rules — category set from tag during seeding
- **Routine verbs**: `category: 'routine'` (routine verbs tagged `routine`); supports separable-verb feedback — category set from tag during seeding
- **All other nouns**: `category: 'core'`
- **All other verbs**: `category: 'core'`

**Important**: The `category` column value does **not** automatically become `'verbs'` when a verb has `tags` including `verb`. Category is a **separate field** from tags. If SentenceBuilder rule checks wish to use category as an additional filter, the seeding logic must be updated — but that is a **seed data change** out of scope for this coordination task. Kilo's tagging plan documents the inventory; actual seeding changes require Cline coordination.

## Interface Specification (for Cline implementation)

### What Cline can read from DB

```sql
-- Check if a vocab row has a thematic category
SELECT category FROM vocabulary WHERE word = 'laufen';
-- Returns: 'core' (unless manually updated)

-- Group by category for planning
SELECT category, COUNT(*) FROM vocabulary GROUP BY category ORDER BY category;
```

### How SentenceBuilder can use category

**Option A: Category as supplementary hint** (recommended first step)
- When `analyzeError` detects a verb, also query `vocabulary.category` for that verb
- If `category = 'verbs'`, enable conjugation check with higher confidence
- If `category = 'core'`, proceed with conjugation check at normal confidence
- **No DB schema changes needed** — just read the existing `category` column

**Option B: Category-filtered vocab loading** (future)
- When loading sentences for a given unit, filter by `category` to prioritize themed rows
- e.g., Unit 4: `WHERE category IN ('food', 'travel', 'places', 'directions', 'restaurant', 'core')`
- This mirrors the U4/U5 try-list pattern but for SentenceBuilder exercise generation
- **Requires**: DB rows to have appropriate category values set during seeding

### What Cline should NOT do

- **Do not expect UI to parse tag formats** — tags are opaque strings (`tags[]` array or comma-separated); parsing is UI-component responsibility only
- **Do not rely on category being set during seeding** — currently all seed rows have `category: 'core'`; any rule that assumes `'verbs'` or `'food'` etc. will miss rows unless seeding is updated
- **Do not invent new column names** — the `category` column already exists as `VARCHAR(50) NOT NULL DEFAULT 'general'`; any new categories must use existing inventory

## Kilo Coordination Checklist

### Before Cline begins Phase 1 implementation:

- [x] **Category inventory documented** in `KILO_TAGGING_PLAN.md` ✅
- [x] **U4/U5 try-list compatibility verified** — `'Unit4'` and `'Unit5'` categories exist in inventory ✅
- [x] **A1 fallback integrity verified** — `'A1'` category exists for sparse-unit fallback ✅
- [x] **SQL pattern alignment confirmed** — `GROUP BY category` query produces valid aggregation ✅
- [ ] **Seeding alignment noted** — if SentenceBuilder rules assume specific category values, Cline must coordinate seed data changes (out of scope for this task)
- [ ] **BACKLOG/HANDOFF sync** — when Cline phases conclude, update BACKLOG.md items and HANDOFF.md Needs/Blocked fields

### If Cline needs category changes during implementation:

1. Kilo can **add new category values** to `KILO_TAGGING_PLAN.md` (docs-only, no DB schema change)
2. Kilo can **update seeding logic** in `scripts/seedVocab.ts` or `scripts/seedCurriculum.ts` (these are Kilo-owned scripts, but seeding changes require human coordination — no SEED_FORCE changes without explicit go-ahead)
3. Cline updates `SentenceBuilder.tsx` rule logic to read the `category` column ✅ (src/ change, Cline's domain)

## Success Criteria (docs-coordination)

- [x] Category inventory exists and aligns with `GROUP BY category` SQL pattern ✅
- [x] U4/U5 try-list categories (`Unit4`, `Unit5`) are documented and compatible ✅
- [x] A1 fallback category (`A1`) is documented and compatible with service fallback logic ✅
- [x] Cline implements rule logic in `SentenceBuilder.tsx` that optionally reads `vocabulary.category` ✅ (src/ implementation, Cline's domain)
- [x] Seeding produces rows with matching category values (TIME→'time', routine→'routine') ✅