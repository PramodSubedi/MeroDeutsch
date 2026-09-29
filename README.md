# MeroDeutsch

**MeroDeutsch** is a German-language learning app built with React 19, TypeScript and Vite. It teaches German from zero — with Nepali support — through a structured CEFR campaign, Leitner-box spaced repetition, offline-first practice and a local LLM conversation companion.

Installable as a PWA, it works with or without an account, and it ships with its own admin control center.

- **Learner app** — https://merodeutsch.pramods.com.np
- **Admin control center** — https://admin.merodeutsch.pramods.com.np

---

## 📱 Learner Features

**Learning**
- **A1 Campaign** — 16 JSON-defined units with lesson documents, node spine and 80% checkpoint gates
- **CEFR Ladder** — `/levels` index; A1 available, A2/B1 marked coming soon
- **Foundation Modules** — alphabet, numbers, calendar, articles, greetings
- **Grammar & Pronunciation** — flowchart drills and phoneme practice
- **Practice Hub** — dictation, sentence builder, roleplay, email builder, article sprint, Rapid Blitz, games
- **Stories** — reading material tied to the active level

**Retention**
- **Spaced Repetition** — Leitner 4-box scheduling (1/3/7/14 days), not SM-2; the SM-2 columns were dropped in migration `20260928010000`
- **Review Queue** — surfaced words, ordered by need
- **Vocabulary Trainer** — deck import and per-word mastery tracking
- **Glossary & Stories** — reference material

**Motivation**
- **XP & Levels** — XP rewards, ranks and level curve
- **Streaks & Daily Quests** — 3 randomized quests resetting at local midnight
- **Achievements** — 11 badges (local + Supabase mirrored)

**Platform**
- **PWA** — installable, `standalone` with `minimal-ui` fallback, app shortcuts, staged updates via prompt
- **Offline-first** — Dexie/IndexedDB (`MeroDeutsch` DB) with a 60s + `online` sync bridge
- **Audio** — 813 bundled MP3s (Goethe-Institut A1 wordlist, CC BY-SA 4.0) with `speechSynthesis` fallback; slow/normal/fast rates
- **Mero AI companion** — local Ollama/LM Studio chat (default `qwen2.5:3b`), no cloud fallback by design
- **Analytics** — 30-day activity trend, skill radar, weak items, mastery indicators
- **Guest Mode** — full learning without signing up
- **Auth** — email/password + Google, via Supabase Auth
- **Language Mode** — EN/DE UI toggle with German-only mode; Nepali appears in content, not chrome

### Free vs Premium

| | Free | Premium |
|---|---|---|
| Foundation modules, practice tools, stories | ✅ | ✅ |
| Full A1 campaign incl. checkpoint gates | — | ✅ |

Plan is read from `profiles.plan` and DB-trigger protected. **No billing provider** — grants are issued manually from the admin panel.

---

## 🛠️ Admin Control Center

A second entry point (`admin.html`) in the same repo, sharing one Supabase project. Gated on `profiles.role = 'admin'` and served `noindex, nofollow` on its own subdomain.

- **Users** — search, virtualized tables, facets, CSV export, User-360 drawer; ban, promote, demote, grant premium
- **Curriculum** — author units, diff bundle vs published DB store, validate and publish
- **Vocabulary & Integrity** — content findings and privileged repair
- **Chatbot Settings** — companion defaults via `app_config`
- **Analytics, Audit Log, System Health** — row counts, feature flags, announcement banner
- **Debug / QA** — mode switcher and cross-origin bridge to the learner app
- **Global search** — ⌘K / Ctrl+K palette

All privileged writes go through the service-role `admin-action` Edge Function. Client-side writes are blocked by database triggers — **the real security boundary is RLS + triggers, not the UI**.

---

## 🛠️ Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 19, TypeScript 6, Vite 8 |
| Styling | Tailwind CSS 4 |
| Routing | React Router DOM 7 |
| State | Zustand 5 + React Context |
| Local persistence | Dexie 4 + dexie-react-hooks |
| Backend / Auth | Supabase (PostgreSQL, Edge Functions) |
| Charts | Recharts 3 |
| UI / Motion | Lucide React, Framer Motion, Canvas Confetti |
| PWA / SEO | vite-plugin-pwa, vite-plugin-sitemap |
| Analytics | Vercel Analytics |
| Testing | Vitest 5, Testing Library, MSW |
| Linting | Oxlint |

> The AI companion is a local **Ollama / LM Studio** client (`src/lib/ollamaClient.ts`), not a cloud API. The `openai` package is a devDependency used only by content-generation scripts and is never bundled.

---

## 🚀 Quick Start

```bash
npm install
cp .env.example .env      # then fill in your Supabase values
npm run dev
```

- Learner app → http://localhost:5173/
- Admin control center → http://localhost:5173/admin.html

Both entries run from one dev server. Leave `VITE_APP_URL` / `VITE_ADMIN_URL` empty locally and the control center resolves to same-origin `/admin.html`.

Apply the SQL files in `supabase/migrations/` in order (45 migrations, see [DEPLOY.md](./DEPLOY.md)).

---

## 🔑 Environment Variables

Client bundle (`src/`) — all optional except the first two:

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL. **Throws in production if missing.** |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key. |
| `VITE_APP_URL` | Learner origin, for the QA bridge and cross-app links. |
| `VITE_ADMIN_URL` | Control-centre origin. |
| `VITE_CHATBOT_ENABLED` | `false` compiles the AI companion out entirely. |
| `VITE_OLLAMA_BASE_URL` | Defaults to `http://localhost:11434`. |
| `VITE_OLLAMA_DEFAULT_MODEL` | Defaults to `qwen2.5:3b`. |

Scripts and Edge Functions only (`process.env` / Deno env):

| Variable | Purpose |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Management API PAT for `runSql.ts` / `check-migrations`. **Never set on Vercel.** |
| `SUPABASE_PROJECT_REF` | Supabase project ref. |
| `SUPABASE_SERVICE_ROLE_KEY` | Seeding and audit scripts. Local only. |
| `OPENAI_API_KEY` / `OPENAI_MODEL`, `GROQ_API_KEY` / `GEN_MODEL` | Content-generation scripts only. |
| `ADMIN_ALLOWED_ORIGIN` | Edge Function CORS allowlist. |

`.env` and `.env.local` are gitignored. See [`.env.example`](./.env.example) for the annotated template.

---

## 📦 Scripts

```bash
npm run dev            # dev server with HMR (both entries)
npm run build          # tsc -b && vite build → dist/
npm run preview        # preview the production build
npm run lint           # oxlint
npm run typecheck      # tsc -b
```

### Testing

```bash
npm test               # vitest run (9 suites)
npm run test:watch
npm run test:coverage
```

The repo also uses **33 standalone assertion suites** (`*.check.ts`), each with its own `check:*` script and its own CI step:

```bash
npm run check:answers      # answer normalization
npm run check:integrity    # content integrity
npm run check:auditlog     # admin audit log
npm run check:currstore    # curriculum DB store
npm run check:learnerroutes # route manifest vs App.tsx
npm run check:deployfilter  # Vercel deploy filter exit codes
# …see package.json for the rest
```

Adding a `*.check.ts` requires adding a `check:<name>` script **and** a CI step (`.github/workflows/checks.yml`).

### Curriculum

```bash
npm run curriculum:validate   # content gate — exits 1 on error
npm run curriculum:verify     # regression proof vs baseline.json
npm run curriculum:barrel     # regenerate units.generated.ts
npm run curriculum:baseline   # re-baseline (intentional changes only)
```

See [`scripts/data/a1-curriculum/README.md`](./scripts/data/a1-curriculum/README.md) for the fixture rules.

### Data pipeline

`seed-vocab`, `seed-curriculum`, `seed-content-pools`, `extract-vocab`, `extract-pdf`, `import-csv`, `import-notebooklm`, `enrich`, `generate-a1`, `backfill-*`, `run-sql`, `audit-db`, `verify-seeds`. These require `SUPABASE_SERVICE_ROLE_KEY` and touch the live database — see `package.json` for arguments.

---

## 🏗️ Project Structure

```
index.html              # learner entry
admin.html              # admin entry
src/
├── components/         # UI: dashboard/, lesson/, exercises/, chat/, path/, games/
├── pages/              # learner route components
├── admin/              # control center (own router, own entry, no SW)
├── data/
│   ├── curriculum/     # 16 unit JSONs + 16 lesson docs + schema
│   └── cefrLevels.ts
├── context/            # Auth, Language, XP, Learning
├── hooks/              # useA1Path, useReviewQueue, useStreak, useSpeech, …
├── lib/                # db (Dexie), supabase, ollamaClient, pure helpers
├── services/           # sync, entitlement, supabase access
├── shared/             # types/utilities used by both entries
├── config/             # routes, achievements, chatbot
└── utils/
scripts/                # seeding, CI checks, curriculum tooling
supabase/
├── migrations/         # 45 SQL migrations
└── functions/          # admin-action Edge Function
```

---

## ☁️ Deployment

Two Vercel projects, one repo, one build — `vite build` emits both entries into a single `dist/`:

| Project | Domain | Ignored Build Step |
|---|---|---|
| `mero-deutsch` | `merodeutsch.pramods.com.np` | `npx tsx scripts/ci/deployFilter.ts learner` |
| `mero-deutsch-admin` | `admin.merodeutsch.pramods.com.np` | `npx tsx scripts/ci/deployFilter.ts admin` |

Two projects are required because a Vercel rewrite is scoped to a project, not a hostname. A single `vercel.json` serves both — its host conditions are assertions, not a dispatcher.

Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL` and `VITE_ADMIN_URL` on **both** projects for Production and Preview.

⚠️ Never set `SUPABASE_ACCESS_TOKEN` on Vercel.

Full instructions, including the deploy-filter exit-code gotcha and the origin-separation trade-off: [DEPLOY.md](./DEPLOY.md).

---

## 🔒 Security

- RLS policies plus DB triggers on every table; privileged writes require the service-role Edge Function
- Admin origin gets `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'`, `nosniff`, and `noindex`
- Service worker is deliberately excluded from the admin entry — a registration there would hijack every admin route with the learner shell
- The Supabase anon key is public by design; no service key or PAT ever reaches the client
- `.env`, `.env.local` and `scripts/data/*` are gitignored (with a deliberate exception for the curriculum baseline fixture)

---

## 📚 Documentation

- [DEPLOY.md](./DEPLOY.md) — deployment guide
- [ADMIN_PHASES_HANDOFF.md](./ADMIN_PHASES_HANDOFF.md) — admin control center build notes
- [`scripts/data/a1-curriculum/README.md`](./scripts/data/a1-curriculum/README.md) — curriculum regression fixture
- [`public/audio/anki/ATTRIBUTION.md`](./public/audio/anki/ATTRIBUTION.md) and [LICENCE.md](./public/audio/anki/LICENCE.md) — audio credits

CI runs on every push to `main` and every PR: 33 `check:*` suites → `typecheck` → `lint` → curriculum gates → `build`.

---

## 🤝 Contributing

1. Fork the repository
2. Create a branch (`git checkout -b feature/my-feature`)
3. Run the gates: `npm run typecheck && npm run lint && npm test`
4. If you touched curriculum content, run `npm run curriculum:validate` and `npm run curriculum:verify`
5. Commit and push (`git push origin feature/my-feature`)
6. Open a Pull Request

Never commit `.env`, `.env.local` or any service-role key.

---

## 👤 Author

**Pramod Subedi** — [GitHub](https://github.com/PramodSubedi)

## 🙏 Acknowledgments

- Goethe-Institut A1 wordlist Anki deck for the pronunciation audio
- The React, Vite and Supabase communities

---

**MeroDeutsch** — Learn German, one word at a time! 🇩🇪
