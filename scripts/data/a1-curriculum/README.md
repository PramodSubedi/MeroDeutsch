# Curriculum regression evidence (P0)

This folder holds the evidence behind the P0 refactor that moved the A1 campaign
content out of `src/data/a1Path.ts` and into editable JSON under
`src/data/curriculum/`.

| File | Committed? | What it is |
|---|---|---|
| `baseline.json` | **yes** | Canonical snapshot of *every* observable export of `a1Path.ts` as it was before the content moved. `npm run curriculum:verify` diffs the current data-driven module against it. |
| `_pre-p0-a1Path.ts.bak` | no | Byte copy of the original `a1Path.ts`. Used for the export-surface check. |
| `_legacy.ts` | no | The same file renamed to `.ts` so tooling can import it. Used by `npm run curriculum:baseline` to regenerate `baseline.json`. |

`baseline.json` is committed even though `scripts/data/` is otherwise
gitignored, because a fresh clone needs it for `curriculum:verify` to have
anything to compare against. The two frozen source copies stay local: 100 KB of
dead code is not worth versioning.

## Commands

```bash
npm run curriculum:validate    # content gate — errors exit 1 (run this after any unit edit)
npm run curriculum:verify      # P0 regression proof — value parity vs baseline.json
npm run curriculum:barrel      # rewrite units.generated.ts (only after adding/removing a unit file)
npm run curriculum:baseline    # REGENERATE baseline.json from the frozen pre-P0 source
```

## Restoring the local files (e.g. on a fresh clone)

`curriculum:verify` degrades gracefully without them — it reports
`export surface: skipped` and still performs the value-parity check against the
committed `baseline.json`.

To re-enable the export-surface check, put the pre-P0 `a1Path.ts` back as
`_pre-p0-a1Path.ts.bak` and copy it to `_legacy.ts`:

```powershell
git show <the P0 commit>^:src/data/a1Path.ts > scripts/data/a1-curriculum/_pre-p0-a1Path.ts.bak
Copy-Item scripts/data/a1-curriculum/_pre-p0-a1Path.ts.bak scripts/data/a1-curriculum/_legacy.ts
```

⚠ Do this only if you need to *regenerate* the baseline. `git show` reproduces
whatever was committed; the spine that P0 actually converted also included
uncommitted working-tree changes, so regenerating from history can produce a
baseline that differs from the original conversion.

## If `curriculum:verify` fails

1. Read the reported paths — they are exact (`a1Path.units.7.pedagogy.…`).
2. Two categories of difference are expected and already whitelisted, both about
   ORDER, never set membership: the 14 bonus chips and the bonus tail of
   `A1_CURRICULUM.nodes`. They are grouped by unit because a bonus chip now
   lives inside its own unit file.
3. Anything else means a real change of behaviour. If the change is intentional
   (new unit, new node, reordering), re-run `npm run curriculum:baseline` with a
   fresh frozen source so the fixture matches the new intent.
