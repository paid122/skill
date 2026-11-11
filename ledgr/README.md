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
BASE_URL=http://localhost:3000 node tests/e2e/acceptance.cjs   # end-to-end acceptance checks (needs Playwright + Chromium)
```

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
- **Local-first storage.** All records live in the browser (IndexedDB), with images/PDFs in a separate blob store and cross-tab sync. Backups (JSON, optionally with images) are available in Settings.
- **Relational schema for hosting.** `supabase/migrations/0001_ledgr_schema.sql` defines every table (users/profiles, accounts, trades, executions, attachments, tags, strategies, confluences, journals, study, verses, reports, AI conversations, settings, goals), validation constraints, owner-only row-level security on every table, parent-ownership checks, and a private storage bucket scoped to each user's folder. The app does not yet sync to it — see *Status* below.
- **Calculation engine** in `src/lib/calc.ts`; every formula is documented in [`docs/CALCULATIONS.md`](docs/CALCULATIONS.md).
- **Verses** in `src/lib/verses.ts` — KJV (public domain) text; page verses follow the brief; context-aware selection uses only process signals (journal completeness, recorded emotions), never P&L. Unlicensed translations are listed but disabled.
- **Ledgr AI** (`src/app/api/ai/route.ts`) streams from Claude with a strict historical-analyst system prompt; the client sends only a summarised context of records in the selected scope (viewable under “What is shared”), and citations are validated against real records before they are linked.

## Status and known limits

- Data is stored per browser. Supabase authentication and sync are **not wired in yet**; the schema is ready and has been verified (migration applies cleanly; RLS isolation tested between two users).
- The Ledgr AI route has a simple per-instance rate limit; production deployments should add authentication in front of it.
- YouTube is the only embeddable video source for timestamped notes.
