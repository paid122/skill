/**
 * Development only: renders the prototype (command-center.html) and the plugin's command center side by side at
 * 1600x900, tab by tab, with the same sample trades, calendar, clock and random numbers.
 *
 *   node tools/harness/compare.cjs <prototype.html> <out-dir>
 *
 * Needs Playwright with Chromium, and network access to TradingView for the live widgets.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { execFileSync } = require("child_process");

const [protoHtml, out] = process.argv.slice(2);
const ROOT = path.resolve(__dirname, "../..");
const NOW = Date.parse("2026-11-25T13:10:00Z"); // Wed, NY session, CME open, US GDP due 13:30 UTC
const TZ = "Asia/Dubai";
fs.mkdirSync(out, { recursive: true });
const site = path.join(out, "site");
fs.mkdirSync(site, { recursive: true });

// ---------------------------------------------------------------- sample journal (API shape; exitTime/entryTime added so the prototype reads the same times)
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const setups = ["ORB", "VWAP reclaim", "Liquidity sweep", "Trend pullback"];
const trades = [];
for (let i = 0; i < 64; i++) {
  const dayBack = Math.floor(i / 2.2), hourUtc = [2, 8, 14, 15, 9, 13][i % 6] + rnd();
  const open = new Date(Date.UTC(2026, 10, 25 - dayBack, 0, 0) + hourUtc * 3600e3);
  if (+open > NOW - 15 * 60e3) continue;
  const close = new Date(+open + (8 + rnd() * 40) * 60e3);
  const long = rnd() > 0.45, win = rnd() > 0.42, r = +(win ? 0.4 + rnd() * 2.1 : -(0.3 + rnd() * 1.2)).toFixed(2);
  const qty = 1 + Math.floor(rnd() * 3), riskPts = 3 + rnd() * 3, entry = +(2640 + rnd() * 60).toFixed(1);
  const pts = +(r * riskPts).toFixed(1), exit = +(entry + (long ? pts : -pts)).toFixed(1), fees = +(1.24 * qty).toFixed(2), net = +(pts * 10 * qty - fees).toFixed(2);
  trades.push({
    id: "t" + i, number: 200 - i, accountId: "acc1", symbol: i % 9 === 4 ? "MNQZ6" : "MGCZ6", market: "Futures", direction: long ? "long" : "short",
    date: close.toISOString().slice(0, 10), status: "closed", result: net > 0 ? "win" : "loss", quantity: qty, entryPrice: entry, exitPrice: exit,
    pointValue: i % 9 === 4 ? 2 : 10, gross: net + fees, fees, net, r, setup: setups[i % 4], strategy: null, openedAt: open.toISOString(),
    executions: [{ kind: "entry", price: entry, quantity: qty, time: open.toISOString(), fees: fees / 2 }, { kind: "exit", price: exit, quantity: qty, time: close.toISOString(), fees: fees / 2 }],
    entryTime: open.toISOString(), exitTime: close.toISOString(), createdAt: open.toISOString(), updatedAt: close.toISOString(),
  });
}
const me = { key: { id: "k", name: "Obsidian" }, plan: { name: "LEDGR Pro", until: null }, journal: { displayName: "Alex", currency: "USD", accounts: 1, trades: trades.length, syncedAt: new Date(NOW).toISOString() } };
const ffSample = fs.readFileSync(path.join(path.dirname(protoHtml), "../ccsrc/command-center/assets/ff-data.sample.js"), "utf8");
const ffEvents = JSON.parse(ffSample.match(/window\.FF_DATA=(\[.*?\]);/s)[1]);
const ffUpdated = "2026-11-25T06:00:00Z";

// ---------------------------------------------------------------- pages
const proto = fs.readFileSync(protoHtml, "utf8").replace("<!--LEDGR_BASE-->", `<script>window.LEDGR_KEY="ledgr_sk_sample";window.LEDGR_TZ=${JSON.stringify(TZ)};window.LEDGR_NAME="";</script>`);
fs.writeFileSync(path.join(site, "proto.html"), proto);
fs.writeFileSync(path.join(site, "ff-data.js"), `window.FF_DATA=${JSON.stringify(ffEvents)};window.FF_UPDATED='${ffUpdated}';`);
fs.copyFileSync(path.join(ROOT, "assets/operator.mp4"), path.join(site, "operator.mp4"));
fs.copyFileSync(path.join(ROOT, "styles.css"), path.join(site, "styles.css"));
execFileSync(path.join(ROOT, "node_modules/.bin/esbuild"), [path.join(__dirname, "plugin-entry.ts"), "--bundle", "--format=iife", `--outfile=${path.join(site, "plugin.js")}`], { stdio: "inherit" });
fs.writeFileSync(path.join(site, "plugin.html"), `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="styles.css">
<style>html,body{margin:0;height:100%;background:#000}.workspace-leaf-content{width:1600px;height:900px}.view-content{width:100%;height:100%}</style></head>
<body><div class="workspace-leaf-content" data-type="ledgr-command-center"><div class="view-content" id="view"></div></div>
<script>window.HARNESS=${JSON.stringify({ trades, calendar: { events: ffEvents, updatedAt: ffUpdated }, tz: TZ, name: "Alex" })}</script><script src="plugin.js"></script></body></html>`);

const server = http.createServer((req, res) => {
  const f = path.join(site, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(site) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  const type = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".mp4": "video/mp4" }[path.extname(f)] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type }); fs.createReadStream(f).pipe(res);
}).listen(8765);

const TABS = ["MAIN", "MARKETS", "JOURNAL", "PERFORMANCE", "CHART", "RISK", "NEWS", "BRAIN"];
const seededRandom = () => { let s = 1234567; Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647); };

(async () => {
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  async function open(url, isProto) {
    const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    await p.clock.setFixedTime(NOW);
    await p.addInitScript(seededRandom);
    p.on("pageerror", (e) => console.log(isProto ? "[proto]" : "[plugin]", "pageerror", e.message));
    await p.route("https://www.ledgrjournal.app/api/v1/**", (r) => {
      const u = r.request().url();
      if (u.includes("/me")) return r.fulfill({ json: me });
      if (u.includes("/trades")) return r.fulfill({ json: { trades, total: trades.length, limit: 200, offset: 0 } });
      return r.fulfill({ status: 404, json: { error: { code: "not_found", message: "Not found" } } });
    });
    await p.goto(url);
    await p.waitForTimeout(1200);
    if (isProto) { await p.click("#gskip"); }
    await p.waitForTimeout(2500);
    return p;
  }
  const P = await open("http://localhost:8765/proto.html", true);
  const Q = await open("http://localhost:8765/plugin.html", false);
  for (const [i, t] of TABS.entries()) {
    for (const [p, who] of [[P, "proto"], [Q, "plugin"]]) {
      await p.locator(".tab", { hasText: new RegExp(`^${t}$`) }).first().click();
      await p.mouse.move(5, 895);
      await p.waitForTimeout(t === "CHART" || t === "NEWS" || t === "MAIN" ? 7000 : 2500);
      await p.screenshot({ path: path.join(out, `${String(i + 1).padStart(2, "0")}-${t.toLowerCase()}-${who}.png`) });
    }
    console.log("shot", t);
  }
  await b.close();
  server.close();
})();
