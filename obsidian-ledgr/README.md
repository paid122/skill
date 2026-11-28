# LEDGR for Obsidian

Your [LEDGR](https://www.ledgrjournal.app) trading journal as a command center inside Obsidian. Requires **LEDGR Pro**.

> Status: **phase 1 prototype**. Connects to LEDGR, shows your stats and accounts, works offline with saved data.

## Install (development build)

```bash
npm install
npm run build
```

Copy `main.js`, `manifest.json` and `styles.css` into `<your vault>/.obsidian/plugins/ledgr/`, then in Obsidian go to **Settings → Community plugins**, turn on community plugins if needed, and enable **LEDGR**.

## Connect

1. In LEDGR, go to **Settings → API** and create a key (LEDGR Pro).
2. In Obsidian, go to **Settings → LEDGR**, paste the key and press **Test connection**.
3. Open the Command Center from the ribbon (pulse icon) or the command palette: **LEDGR: Open Command Center**.

## What it does now

- Shows all-time and last-30-days stats (net P&L, win rate, profit factor, average R, max drawdown, trades) and your active accounts.
- Refreshes when opened, every 5 minutes while open, and with the refresh button or **LEDGR: Refresh data**. Answers are cached for 60 seconds, and requests stay under LEDGR's limit (120 a minute per key).
- Works offline: the last good data is saved and shown with a **STALE** badge and the time it was fetched.
- Locks with a clear message if the key is wrong or revoked, or the account doesn't have LEDGR Pro.

## Privacy

- Your API key is kept in Obsidian's **secret storage** on this device. It is not written to your vault or to the plugin's `data.json`, so it isn't synced or committed with your notes.
- The plugin only talks to `https://www.ledgrjournal.app/api/v1`. It sends your API key and asks for your stats, accounts and plan. Nothing else leaves your device, and there is no telemetry.
- The last fetched stats and account balances are saved in the plugin's `data.json` (inside `.obsidian/plugins/ledgr/`) so the view works offline. **Disconnect** removes both the key and this data.

## Develop

```bash
npm run dev    # rebuild on change
npm test       # unit tests (API client, rate limit, cache, offline/locked states, formatting)
```
