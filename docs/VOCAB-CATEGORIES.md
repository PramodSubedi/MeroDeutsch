# Vocab Categories — MeroDeutsch

## How categories/tags appear in the repo

- Categories are defined in Supabase migrations as `category` column on vocabulary rows
- Tags (if used) are stored in a separate `tags` column or junction table
- Types in `src/types/` reflect the DB schema (e.g., `VocabWord` type includes `category?: string | null`)
- Category filters are applied in the curriculum service when fetching themed checkpoint vocab

## SQL to run in Supabase

```sql
-- Group vocab by category, count per category
SELECT category, COUNT(*) AS count
FROM vocabulary
GROUP BY category
ORDER BY category ASC;
```

```sql
-- If tags column exists (comma-separated text)
SELECT category, tags,
       COUNT(*) FILTER (WHERE tags LIKE '%%adjective%%') AS adj_count
FROM vocabulary
GROUP BY category, tags
ORDER BY category ASC;
```

```sql
-- U4/U5 try-list: fetch themed rows first, fall back to A1 if sparse
SELECT * FROM vocabulary
WHERE category IN ('Unit4', 'Unit5')
ORDER BY
  CASE WHEN category = 'Unit4' THEN 1
       WHEN category = 'Unit5' THEN 2
       ELSE 3 END
LIMIT 20;
```

## U4/U5 try-lists + fallback

- When loading checkpoint vocab for Units 4 or 5, the service first tries themed rows (`category IN ('Unit4','Unit5')`)
- If themed rows are sparse (fewer than the cap), it falls back to A1-level vocab via the registry
- Fallback ensures the checkpoint always has at least the minimum vocab count, even if U4/U5 content is still being seeded
- The `a1Path.ts` defines the progression order; fallback respects that order

## Notes

- No seeding changes, no service code changes in this doc pass
- Category logic lives in migrations + types; service-level fallbacks are in `src/data/`
- Tags, if present, are opaque strings; parsing is done in UI filter components only