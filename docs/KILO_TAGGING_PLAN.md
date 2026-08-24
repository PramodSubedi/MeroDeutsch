# Kilo — Vocab Category Tagging Plan

## Purpose

Define category values for `public.vocabulary.category` that align with the existing `GROUP BY category` SQL pattern and support U4/U5 themed checkpoint vocab with A1 fallback integrity.

## Category Inventory

Categories are plain `VARCHAR(50)` values stored in the `category` column (see `supabase/migrations/004_vocabulary_expansion.sql`). The default is `'general'`. All new category values must be valid entries that the `GROUP BY category` query can aggregate.

### Core categories (used across all units)

| Category | Description | Typical usage |
|---|---|---|
| `core` | General/fallback vocab | Default for nouns/verbs without thematic tag |
| `Unit4` | Unit 4 themed vocab | U4 checkpoint try-list primary filter |
| `Unit5` | Unit 5 themed vocab | U5 checkpoint try-list primary filter |
| `A1` | A1-level general pool | Fallback source when U4/U5 sparse |
| `food` | Food & drink themed | U4 unit theme (`food`, `restaurant`) |
| `travel` | Travel & transport themed | U4 unit theme |
| `places` | Places & locations themed | U4 unit theme |
| `directions` | Directions themed | U4 unit theme |
| `restaurant` | Restaurant ordering themed | U4 unit theme |
| `verbs` | Verb-focused vocab | U5 unit theme (`vocabPos: 'verb'`) |
| `phrases` | Phrase/routine vocab | U5 unit theme |
| `routine` | Routine & separable verbs | U5 unit theme, also `seedCurriculum` tag |
| `time` | Time & clock vocab | `seedCurriculum` TIME nouns tag |

### U4/U5 try-list compatibility

The U4/U5 try-list SQL pattern (from `VOCAB-CATEGORIES.md:30-38`) is:

```sql
SELECT * FROM vocabulary
WHERE category IN ('Unit4', 'Unit5')
ORDER BY
  CASE WHEN category = 'Unit4' THEN 1
       WHEN category = 'Unit5' THEN 2
       ELSE 3 END
LIMIT 20;
```

**Requirement**: Category values `'Unit4'` and `'Unit5'` must exist in the vocabulary table for the try-list to work. When themed rows are sparse (< cap), the service falls back to A1-level vocab via the registry (respecting `a1Path.ts` progression order).

### A1 unit vocabCategories alignment

Per `src/data/a1Path.ts:301` and `a1Path.ts:325`, the A1 units declare `vocabCategories`:

- **Unit 4** (index 3): `vocabCategories: ['food', 'travel', 'places', 'directions', 'restaurant', 'core']`
- **Unit 5** (index 4): `vocabCategories: ['verbs', 'phrases', 'routine', 'core']`

**Requirement**: The category values listed above must be present in the `vocabulary.category` column for the themed checkpoint loading logic to match. Unknown categories return nothing and the A1 fill tops up the deck (see `a1Path.ts:299-300`).

## Tagging Strategy

- **Category is derived from the primary thematic tag** during seeding (`seedCurriculum.ts`: `category: 'time'` for TIME nouns, `category: 'routine'` for routine verbs; `seedVocab.ts:77`: `category: categories[0] ?? 'general'`).
- **Store clean category values** — do not expect UI to parse complex tag formats. Tags are opaque; category is the structured filter.
- **When a vocab row has a thematic tag, set category to the matching category value** from the inventory below. If no thematic tag matches, leave as `'core'` (default).
- **U4/U5 checkpoint theming**: Seed vocab rows with `category = 'Unit4'` or `category = 'Unit5'` as appropriate, so the try-list can find themed rows first.
- **Fallback integrity**: If a unit has fewer than the cap themed rows, the service falls back to A1 vocab. Ensure category `'A1'` exists in the DB for this fallback to work via the registry.

## SQL Pattern Alignment

The tagging plan must produce data compatible with this query (from `VOCAB-CATEGORIES.md:12-18`):

```sql
SELECT category, COUNT(*) AS count
FROM vocabulary
GROUP BY category
ORDER BY category ASC;
```

**Result should include rows for**: `A1`, `Unit4`, `Unit5`, `core`, `food`, `travel`, `places`, `directions`, `restaurant`, `verbs`, `phrases`, `routine`, `time`, `general` (and any other categories present).

## No-Op Constraints (docs-only)

- **No database schema changes**: The `category` column already exists as `VARCHAR(50) NOT NULL DEFAULT 'general'`.
- **No seeding changes**: Hard rule — Kilo's work is docs/coordination only. Actual seed data is in `scripts/` and is out of scope.
- **No src/ code changes**: Category filtering logic lives in `src/data/` curriculum services; Kilo does not modify those.
- **No package.json version changes**: Without human coordination.

## HANDOFF Synchronization

- Update `HANDOFF.md` "Needs from Kilo" and "Blocked by" fields when tagging plan work concludes.
- Mark this AGENT_ROLES/BACKLOG item done when the tagging plan document is finalized.
- Cline to update HANDOFF.md after their v0.2.2 feature work concludes.