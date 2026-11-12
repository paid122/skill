# Ledgr

**Discipline over impulse.** A premium personal trading journal and performance review workspace, with Scripture (KJV) woven through each page.

Ledgr records **simulated and historical trades only**. It never connects to a broker, executes trades, or gives financial advice.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

On first launch choose **Set up my journal** (empty) or **Explore with sample records** (clearly-flagged simulated data you can remove in Settings → Data).

Optional — model-backed Ledgr AI: copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY`. Without a key, Ledgr AI runs in *offline analysis* mode, answering deterministically from the calculation engine.

```bash
npm test                                   # calculation-engine unit tests (Vitest)
npm run lint                               # TypeScript type check
npm run build && npm start                 # production build
BASE_URL=http://localhost:3000 npm run test:e2e   # 21 end-to-end acceptance checks (needs Playwright + Chromium)
```

## Turn on accounts (Supabase)

Ledgr works without accounts. To enable sign up, log in, Google sign-in, cloud sync, reviews and site sign-ups:

1. Create a free project at supabase.com.
2. In the project's **SQL Editor**, run `supabase/migrations/0001_ledgr_schema.sql`, then `0002_accounts_sync_site.sql`.
3. In **Settings → API**, copy the Project URL and the anon/public key into `.env.local`:
   `NEXT_PUBLIC_SUPABASE_URL=…` and `NEXT_PUBLIC_SUPABASE_ANON_KEY=…`
4. In **Authentication → URL Configuration**, set the Site URL to your domain and add `https://YOUR-DOMAIN/auth/callback` and `https://YOUR-DOMAIN/reset-password` as redirect URLs.
5. Optional: enable **Google** under Authentication → Providers.
6. Reviews appear on the site only after you set their `status` to `approved` in the `reviews` table. Community and affiliate sign-ups are in `site_signups`.

## Public website

`/` (landing with a 3D hero), `/features`, `/pricing`, `/reviews`, `/community`, `/affiliates`, `/privacy`, `/terms`, `/login`, `/signup`, `/forgot-password`. The app itself starts at `/dashboard`.

## What's inside

| Route | Purpose |
|---|---|
| `/dashboard` | Greeting, context-aware verse, six KPIs with period comparison and sparklines, zoomable cumulative P&L, calendar, recent trades, weekly summary, customisable daily checklist, learning goals |
| `/journal`, `/journal/[id]` | Sortable/filterable table, saved views, pagination, CSV export; full trade detail with executions, calculations, psychology, reflection, images and history |
| Quick Log (`N` key) & trade editor | Essentials-only drafts; five-tab editor (Trade, Execution, Psychology, Reflection, Attachments) with multiple entries/partial exits and transparent maths |
| `/daily-journal`, `/weekly-review` | Autosaving pre/post-session entries with calendar; weekly review with computed statistics and objectives |
| `/showcase` | Pinned trades, descriptions, backgrounds, privacy-first shareable PNG cards |
| `/analytics` | 8 overview figures, 14 charts, grouped breakdowns, 14 configurable pattern insights, hypothetical what-if analysis |
| `/psychology`, `/performance-score` | Transparent discipline score, emotion and mistake tracking, trends; composite performance score with formula |
| `/strategies`, `/strategies/[id]` | Strategy documentation, linked-trade statistics, comparison |
| `/accounts`, `/account-history` | Multiple virtual accounts, archive/restore, comparison, evaluation-practice tracker, running ledger with adjustments |
| `/study` | Folders, block note editor, YouTube notes with clickable timestamps, draggable study boards |
| `/verses` | KJV library: topics, search, favourites with reflections, history |
| `/ai` | Chat over your own records with validated citations, conversation history, safeguards |
| `/reports` | Six report types, five themes, PNG/PDF export |
| `/settings`, `/settings/appearance` | Preferences, backup/restore, sample data; themes (Midnight, Onyx, Platinum, Light), accent and chart colours with contrast checks, saved themes |

## Architecture

- **Next.js 16 · TypeScript · Tailwind CSS 4 · Recharts.**
- **Local-first storage.** All records live in the browser (IndexedDB), with images/PDFs in a separate blob store and cross-tab sync. Every change is also written synchronously to a write-ahead copy, so a reload or tab close mid-save cannot lose data. Backups (JSON, optionally with images) are available in Settings.
- **Relational schema for hosting.** `supabase/migrations/0001_ledgr_schema.sql` defines every table (users/profiles, accounts, trades, executions, attachments, tags, strategies, confluences, journals, study, verses, reports, AI conversations, settings, goals), validation constraints, owner-only row-level security on every table, parent-ownership checks, and a private storage bucket scoped to each user's folder. The app does not yet sync to it — see *Status* below.
- **Calculation engine** in `src/lib/calc.ts`; every formula is documented in [`docs/CALCULATIONS.md`](docs/CALCULATIONS.md).
- **Verses** in `src/lib/verses.ts` — KJV (public domain) text; page verses follow the brief; context-aware selection uses only process signals (journal completeness, recorded emotions), never P&L. Unlicensed translations are listed but disabled.
- **Ledgr AI** (`src/app/api/ai/route.ts`) streams from Claude with a strict historical-analyst system prompt; the client sends only a summarised context of records in the selected scope (viewable under “What is shared”), and citations are validated against real records before they are linked.

## Status and known limits

- Without Supabase configured, data is stored per browser. With it, the journal syncs as one snapshot per user (`user_snapshots`) plus files in a private bucket; the fully relational tables in `0001` are ready for a future normalised sync. Both migrations and their row-level security were verified on PostgreSQL; sign-up/sync against a live Supabase project has not been tested in this environment.
- The Ledgr AI route has a simple per-instance rate limit; production deployments should add authentication in front of it.
- YouTube is the only embeddable video source for timestamped notes.
