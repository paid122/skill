# LEDGR for Obsidian

Your [LEDGR](https://www.ledgrjournal.app) trading journal as a sci-fi command center inside Obsidian. Requires **LEDGR Pro**.

> Status: **phase 3**. The Command Center (a native port of the LEDGR command-center prototype in `spec/`), plus your trades as linked notes.

## Install (development build)

```bash
npm install
npm run build
```

Copy `main.js`, `manifest.json`, `styles.css` and `assets/operator.mp4` into `<your vault>/.obsidian/plugins/ledgr/`. In Obsidian: **Settings → Community plugins** → enable **LEDGR**. Needs Obsidian 1.11.4 or newer.

## Connect

1. You need LEDGR Pro.
2. In Obsidian, go to **Settings → LEDGR** and press **Connect with LEDGR**. Approve the code in your browser (ledgrjournal.app/connect). Or paste an API key from LEDGR → Settings → API.
3. Open the Command Center from the ribbon (pulse icon) or the command palette: **LEDGR: Open Command Center**.

## What's in it

Tabs: **MAIN, MARKETS, JOURNAL, PERFORMANCE, CHART, RISK, NEWS, BRAIN** (keys 1–8 while the view has focus).

- Clocks in your time zone plus New York, London and Tokyo; account stats; 30-day P&L curve; long vs short; today's trades; activity feed.
- Neural map with insight nodes (best setup, losses beyond -1.2R, quick re-entries after a loss, drawdown); globe of open markets; session radar.
- Trade log and P&L calendar; equity curve; results by session and by setup; the Psyche report.
- Risk: daily checklist with an automatic news check, risk guard (CLEAR / CAUTION / STOP with an alarm), position sizer using the instrument's point value (MGC $10/point, $1/tick) with fees and 1R/2R/3R targets.
- Instrument menu built from your journal's symbols, driving the specs table, the sizer and the market widgets.
- Cinematic intro (setting), synthesised sound (setting).

## Trades as notes (the second brain)

**LEDGR: Sync trades to notes** (command, or the button in Settings → LEDGR, or automatically every 15 min – 4 h) writes:

| Note | What's in it |
|---|---|
| `LEDGR/Trades/YYYY-MM-DD SYMBOL Direction Setup.md` | Frontmatter: `id, symbol, direction, qty, entry, exit, net, R, setup, account, tags, opened, closed, date, status, result, ledgr` (link to the trade in LEDGR). Body: result table, review, trade notes, emotions, links. |
| `LEDGR/Days/YYYY-MM-DD.md` | The day's P&L, win rate, average R and its trades. |
| `LEDGR/Setups/<setup>.md`, `Mistakes/<m>.md`, `Tags/<t>.md` | Hub notes with stats and every trade, so the graph view shows your patterns. |

- **Your notes are safe.** LEDGR rewrites the part above `<!-- your notes -->` on every sync; text below it is never touched. Frontmatter keys you add are kept. If you delete the marker, your text is kept below a new one.
- **Idempotent.** Notes are matched by the trade's `id`, wherever you move or rename them. Unchanged notes aren't rewritten. A second trade with the same name gets ` (2)`.
- **Deleted in LEDGR?** The note stays (it may hold your notes) and gets `status: deleted in LEDGR`.
- **Starter vault** (asked once after the first sync, or **LEDGR: Create starter trading vault**): `LEDGR/Home.md` dashboard whose LEDGR section refreshes on sync, PARA folders (Projects, Areas, Resources, Archive) and `LEDGR/Templates/Daily trading note.md`. Existing files are never changed.

## Data and offline

- Trades sync from LEDGR when the view opens and every 5 minutes. The first sync downloads everything; later ones only trades created or edited since the last sync (`?updatedSince=`), plus the list of trade ids, so edits and deletions come through straight away. **SYNC** (or **LEDGR: Sync trades now**) and a daily run download everything again.
- The last sync is kept in `trades-cache.json` in the plugin folder. Offline, the Command Center shows it with a **STALE** status and when it was cached.
- A wrong or revoked key, or an account without LEDGR Pro, shows a locked screen with an upgrade link. LEDGR checks Pro on the server for every API request.

## Privacy: what goes over the network

| To | When | What |
|---|---|---|
| `www.ledgrjournal.app` | connect, sync, calendar | Your API key (in a header). When you use **Connect with LEDGR**, the app name "Obsidian (your vault's name)" is shown on the approval page. Answers: your profile name, plan, trades, calendar. |
| `tradingview.com` (`www.tradingview-widget.com`, `s.tradingview.com` and the hosts their widgets use) | when **Live TradingView widgets** is on | The widgets' settings: the instrument symbol (e.g. OANDA:XAUUSD), time zone and colours. No journal data and no key. |

- The API key is kept in Obsidian's **secret storage** on this device, not in your vault or `data.json`.
- `data.json` holds settings and Command Center state (checklist, risk limits, sizer inputs, your LEDGR profile and the last calendar). `trades-cache.json` holds your synced trades. **Disconnect** removes the key, the trade cache, the profile and the calendar.
- No telemetry. No code is loaded from other sites: fonts are bundled, TradingView runs only inside sandboxed iframes on TradingView's own domains (they can't reach the plugin, your vault or your key).
- TradingView widgets are subject to [TradingView's terms](https://www.tradingview.com/policies/); their attribution stays visible.

## Assets and licences

- **Fonts**: Share Tech Mono (Carrois Type Design) and Rajdhani (Indian Type Foundry), SIL Open Font License 1.1, bundled in `styles.css`. Licence texts in `fonts/`.
- **Intro video** `assets/operator.mp4`: loaded from the plugin folder. Obsidian's plugin store only installs `main.js`, `manifest.json` and `styles.css`, so for store installs the plugin downloads it once on first run from the plugin's GitHub release (`VIDEO_URL` in `src/main.ts`, empty until the release repo exists). **Check the video's licence allows commercial use before release.**

## Not built yet (needs LEDGR changes)

- **Economic calendar**: the plugin calls `GET /api/v1/calendar` and shows "calendar not connected" until LEDGR serves it. Expected answer:
  `{ "events": [{ "title", "country", "date" (ISO), "impact": "High"|"Medium"|"Low"|"Holiday", "forecast", "previous" }], "updatedAt", "source": { "name", "url" } }`.
  Forex Factory's feed isn't licensed for redistribution; use a provider whose terms allow it.

## Develop

```bash
npm run dev     # rebuild on change
npm test        # stats, risk guard, sizing, sync, notes (in a fake vault), TradingView URLs, view states
npm run build   # styles.css (scoped prototype CSS + fonts), type check, main.js
```

- `spec/` holds the prototype's CSS and markup. `tools/build-css.mjs` scopes the CSS under `.ledgr-cc`; `tools/make-template.py` makes `src/cc/template.ts` and lists every change from the prototype.
- `tools/harness/compare.cjs` renders the prototype and the plugin side by side at 1600×900 with the same sample data.
