/**
 * Trades as Obsidian notes (pure: no Obsidian imports, so it's tested on its own).
 *
 *   <root>/Trades/YYYY-MM-DD SYMBOL Direction Setup.md   one per trade, keyed on its LEDGR id (frontmatter `id`)
 *   <root>/Days/YYYY-MM-DD.md                            the day's trades and P&L
 *   <root>/Setups/<setup>.md, Mistakes/<m>.md, Tags/<t>.md  hub notes, so the graph shows patterns
 *
 * Everything above the "<!-- your notes -->" line is LEDGR's and is rewritten on every sync.
 * Everything below it is the trader's and is never touched. Frontmatter keys the plugin doesn't manage are kept.
 */

export const MARKER = "<!-- your notes -->";
const MARKER_RE = /<!--\s*your notes\s*-->/;

/** A trade as GET /api/v1/trades returns it. */
export interface PublicTrade {
  id: string; number: number; accountId: string | null; symbol: string; market: string | null;
  direction: "long" | "short" | null; date: string; session: string | null;
  status: "open" | "closed" | "draft"; result: "win" | "loss" | "breakeven" | null;
  quantity: number | null; entryPrice: number | null; exitPrice: number | null; stopPrice: number | null; targetPrice: number | null;
  pointValue: number | null; gross: number | null; fees: number | null; net: number | null; risk: number | null; r: number | null;
  durationMinutes: number | null; openedAt: string | null; strategy: string | null; setup: string | null; grade: string | null; rating: number | null;
  emotions: string[]; mistakes: string[]; tags: string[];
  notes: { entry: string; exit: string };
  review: { wentWell: string; wentWrong: string; improve: string; learned: string; followedPlan: "yes" | "partial" | "no" | null };
  executions: { kind: "entry" | "exit"; price: number; quantity: number; time: string; fees: number }[];
  copyOf: string | null; createdAt: string; updatedAt: string;
}

export interface Ctx {
  root: string; // vault folder, default "LEDGR"
  tz: string; // the user's time zone, for times
  accounts: Record<string, string>; // account id → name
  currency: string;
}

// ------------------------------------------------------------------ names and links

/** Characters Obsidian doesn't allow in file names or that break links. */
export const safeName = (s: string) => s.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

/** "Long" / "Short". */
const dirWord = (d: PublicTrade["direction"]) => (d === "short" ? "Short" : d === "long" ? "Long" : "");

export const setupOf = (t: PublicTrade) => (t.setup || t.strategy || "").trim();

/** The file name a new trade note gets (before any " (2)" for duplicates). */
export function tradeBaseName(t: PublicTrade): string {
  return safeName([t.date, t.symbol.toUpperCase(), dirWord(t.direction), setupOf(t)].filter(Boolean).join(" ")) || safeName(`${t.date} trade ${t.number}`);
}

export const paths = (root: string) => ({
  trades: `${root}/Trades`, days: `${root}/Days`, setups: `${root}/Setups`, mistakes: `${root}/Mistakes`, tags: `${root}/Tags`,
  day: (d: string) => `${root}/Days/${d}.md`,
  setup: (s: string) => `${root}/Setups/${safeName(s)}.md`,
  mistake: (m: string) => `${root}/Mistakes/${safeName(m)}.md`,
  tag: (t: string) => `${root}/Tags/${safeName(t)}.md`,
});

/** A wiki link to a path, shown as its name. */
export const link = (path: string, label?: string) => `[[${path.replace(/\.md$/, "")}|${(label ?? path.split("/").pop()!.replace(/\.md$/, "")).replace(/[|\]]/g, " ")}]]`;

/**
 * Note paths for trades that don't have a note yet. Existing notes keep their path (links to them never break),
 * new ones get the next free name: "2026-11-25 MGC Long ORB.md", then "… ORB (2).md".
 */
export function assignPaths(trades: PublicTrade[], existing: Map<string, string>, taken: Set<string>, root: string): Map<string, string> {
  const out = new Map(existing);
  const used = new Set(Array.from(taken, (p) => p.toLowerCase()));
  for (const t of [...trades].sort((a, b) => a.date.localeCompare(b.date) || a.number - b.number)) {
    if (out.has(t.id)) continue;
    const base = `${paths(root).trades}/${tradeBaseName(t)}`;
    let p = `${base}.md`;
    for (let i = 2; used.has(p.toLowerCase()); i++) p = `${base} (${i}).md`;
    used.add(p.toLowerCase());
    out.set(t.id, p);
  }
  return out;
}

// ------------------------------------------------------------------ formatting

const num = (n: number | null | undefined, dp = 2) => (n === null || n === undefined || !isFinite(n) ? null : Math.round(n * 10 ** dp) / 10 ** dp);
const money = (n: number | null, cur: string) => {
  if (n === null || !isFinite(n)) return "—";
  let s: string;
  try { s = new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(Math.abs(n)); } catch { s = Math.abs(n).toFixed(2); }
  return (n < 0 ? "-" : n > 0 ? "+" : "") + s;
};
const rTxt = (r: number | null) => (r === null || !isFinite(r) ? "—" : `${r > 0 ? "+" : ""}${r.toFixed(2)}R`);
const price = (n: number | null) => (n === null || !isFinite(n) ? "—" : String(+n.toFixed(6)));

/** "2026-11-25 14:31" in the user's time zone. */
export function localTime(iso: string | null, tz: string): string | null {
  if (!iso || isNaN(Date.parse(iso))) return null;
  const p: Record<string, string> = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(new Date(iso)).forEach((x) => (p[x.type] = x.value));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

export const closeTime = (t: PublicTrade) => {
  const exits = t.executions.filter((e) => e.kind === "exit").map((e) => e.time).sort();
  return exits.length ? exits[exits.length - 1] : null;
};

/** Obsidian tags can't have spaces or most punctuation. */
export const tagName = (s: string) => s.trim().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}_/-]/gu, "").replace(/^\d+$/, (d) => `n${d}`);

/** Text that must not end up as markup that breaks the managed section. */
const clean = (s: string) => s.replace(MARKER_RE, "<!-- your notes (from LEDGR) -->").replace(/^---$/gm, "—").trim();

// ------------------------------------------------------------------ YAML (only scalars and string lists; enough for the managed keys)

const yamlScalar = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(String(v)); // a JSON string is a valid YAML double-quoted string
};
export function yamlBlock(o: Record<string, unknown>): string {
  return Object.entries(o).map(([k, v]) => (Array.isArray(v) ? (v.length ? `${k}:\n${v.map((x) => `  - ${yamlScalar(x)}`).join("\n")}` : `${k}: []`) : `${k}: ${yamlScalar(v)}`)).join("\n");
}

// ------------------------------------------------------------------ notes

export const TRADE_KEYS = ["id", "symbol", "direction", "qty", "entry", "exit", "net", "R", "setup", "account", "tags", "opened", "closed", "date", "status", "result", "ledgr"] as const;

export function tradeFrontmatter(t: PublicTrade, c: Ctx, deleted = false): Record<string, unknown> {
  return {
    id: t.id, symbol: t.symbol, direction: t.direction ?? "", qty: num(t.quantity, 4), entry: num(t.entryPrice, 6), exit: num(t.exitPrice, 6),
    net: num(t.net), R: num(t.r), setup: setupOf(t), account: (t.accountId && c.accounts[t.accountId]) || "",
    tags: ["ledgr/trade", ...t.tags.map(tagName).filter(Boolean)], opened: localTime(t.openedAt, c.tz) ?? "", closed: localTime(closeTime(t), c.tz) ?? "",
    date: t.date, status: deleted ? "deleted in LEDGR" : t.status, result: t.result ?? "", ledgr: `https://www.ledgrjournal.app/journal/${t.id}`,
  };
}

export function tradeBody(t: PublicTrade, c: Ctx, deleted = false): string {
  const P = paths(c.root), setup = setupOf(t), cur = c.currency;
  const pts = t.entryPrice !== null && t.exitPrice !== null ? (t.exitPrice - t.entryPrice) * (t.direction === "short" ? -1 : 1) : null;
  const opened = localTime(t.openedAt, c.tz), closed = localTime(closeTime(t), c.tz);
  const rows: [string, string][] = [
    ["Result", t.status === "closed" ? `**${money(t.net, cur)}** · ${rTxt(t.r)}${t.result ? ` · ${t.result}` : ""}` : t.status === "open" ? "Open" : "Draft"],
    ["Account", (t.accountId && c.accounts[t.accountId]) || "—"],
    ["Size", `${t.quantity ?? "—"} @ ${price(t.entryPrice)} → ${price(t.exitPrice)}${pts !== null ? ` (${+pts.toFixed(4)} pts)` : ""}`],
    ["Stop / target", `${price(t.stopPrice)} / ${price(t.targetPrice)}`],
    ["Opened → closed", `${opened ?? "—"} → ${closed && opened && closed.slice(0, 10) === opened.slice(0, 10) ? closed.slice(11) : closed ?? "—"}${t.durationMinutes ? ` (${t.durationMinutes} min)` : ""}`],
    ["Session", t.session ?? "—"],
    ["Fees", money(t.fees === null ? null : -t.fees, cur).replace(/^-/, "")],
    ["Grade · rating", `${t.grade ?? "—"} · ${t.rating ? `${t.rating}/10` : "—"}`],
  ];
  const links = [
    `**Day** ${link(P.day(t.date), t.date)}`,
    setup && `**Setup** ${link(P.setup(setup), setup)}`,
    t.mistakes.length && `**Mistakes** ${t.mistakes.map((m) => link(P.mistake(m), m)).join(", ")}`,
    t.tags.length && `**Tags** ${t.tags.map((x) => link(P.tag(x), x)).join(", ")}`,
  ].filter(Boolean).join(" · ");
  const r = t.review, plan = r.followedPlan === "yes" ? "Yes" : r.followedPlan === "partial" ? "Partly" : r.followedPlan === "no" ? "No" : "—";
  const field = (label: string, v: string) => (v && v.trim() ? `**${label}**\n${clean(v)}\n` : "");
  const review = [field("What went well", r.wentWell), field("What went wrong", r.wentWrong), field("What to improve", r.improve), field("What I learned", r.learned)].filter(Boolean).join("\n");
  const notes = [field("Entry", t.notes.entry), field("Exit", t.notes.exit)].filter(Boolean).join("\n");
  return [
    `# ${t.symbol.toUpperCase()} ${dirWord(t.direction)}${setup ? ` · ${clean(setup)}` : ""}`,
    "",
    deleted
      ? "> [!warning] This trade was deleted in LEDGR. Your notes below are kept; delete this note yourself if you don't need it."
      : `> [!info] Synced from [LEDGR](https://www.ledgrjournal.app/journal/${t.id}). Edit the trade in LEDGR; write your own notes below the line.`,
    "",
    "| | |",
    "|---|---|",
    ...rows.map(([k, v]) => `| ${k} | ${v.replace(/\|/g, "\\|")} |`),
    "",
    links,
    "",
    "## Review",
    review || "_No review yet._",
    `**Followed plan** ${plan}`,
    ...(t.emotions.length ? ["", `**Emotions** ${t.emotions.join(", ")}`] : []),
    ...(notes ? ["", "## Trade notes", notes] : []),
  ].join("\n").trim();
}

// ------------------------------------------------------------------ hub notes

export interface Summary { n: number; net: number; wins: number; losses: number; rSum: number; rN: number }
const summarise = (ts: PublicTrade[]): Summary => {
  const c = ts.filter((t) => t.status === "closed" && t.net !== null);
  const rs = c.map((t) => t.r).filter((r): r is number => r !== null && isFinite(r));
  return { n: c.length, net: c.reduce((a, t) => a + (t.net ?? 0), 0), wins: c.filter((t) => (t.net ?? 0) > 0).length, losses: c.filter((t) => (t.net ?? 0) < 0).length, rSum: rs.reduce((a, b) => a + b, 0), rN: rs.length };
};
const statLine = (s: Summary, cur: string) =>
  `**${money(s.n ? s.net : null, cur)}** · ${s.n} closed trade${s.n === 1 ? "" : "s"} · win rate ${s.wins + s.losses ? Math.round((s.wins / (s.wins + s.losses)) * 100) + "%" : "—"} · avg ${s.rN ? rTxt(s.rSum / s.rN) : "—"}`;

const tradeRow = (t: PublicTrade, path: string, c: Ctx) => {
  const time = localTime(t.openedAt, c.tz)?.slice(11) ?? "";
  return `- ${link(path, `${t.date}${time ? " " + time : ""} ${t.symbol.toUpperCase()} ${dirWord(t.direction)}`.trim())} · ${t.status === "closed" ? `${money(t.net, c.currency)} · ${rTxt(t.r)}` : t.status}`;
};

export interface HubNote { path: string; frontmatter: Record<string, unknown>; body: string }

/** Day, setup, mistake and tag notes, from all trades. */
export function hubNotes(trades: PublicTrade[], notePath: Map<string, string>, c: Ctx): HubNote[] {
  const P = paths(c.root), out: HubNote[] = [];
  const group = (key: (t: PublicTrade) => string[]) => {
    const m = new Map<string, PublicTrade[]>();
    for (const t of trades) for (const k of key(t)) if (k) m.set(k, [...(m.get(k) ?? []), t]);
    return m;
  };
  const list = (ts: PublicTrade[]) => [...ts].sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number).map((t) => tradeRow(t, notePath.get(t.id)!, c)).join("\n");

  for (const [day, ts] of group((t) => [t.date])) {
    const setups = [...new Set(ts.map(setupOf).filter(Boolean))];
    out.push({
      path: P.day(day),
      frontmatter: { date: day, trades: ts.length, net: num(summarise(ts).net), tags: ["ledgr/day"] },
      body: [`# ${day}`, "", statLine(summarise(ts), c.currency), "", "## Trades", list([...ts].reverse()), ...(setups.length ? ["", `**Setups** ${setups.map((s) => link(P.setup(s), s)).join(", ")}`] : [])].join("\n"),
    });
  }
  const hub = (title: string, tag: string, path: (k: string) => string, m: Map<string, PublicTrade[]>) => {
    for (const [k, ts] of m) out.push({ path: path(k), frontmatter: { [tag]: k, trades: ts.length, net: num(summarise(ts).net), tags: [`ledgr/${tag}`] }, body: [`# ${clean(k)}`, "", `${title} · ${statLine(summarise(ts), c.currency)}`, "", "## Trades", list(ts)].join("\n") });
  };
  hub("Setup", "setup", P.setup, group((t) => [setupOf(t)]));
  hub("Mistake", "mistake", P.mistake, group((t) => t.mistakes));
  hub("Tag", "tag", P.tag, group((t) => t.tags));
  return out;
}

export const HUB_KEYS = ["date", "trades", "net", "tags", "setup", "mistake", "tag"];

// ------------------------------------------------------------------ merging with what's on disk

interface Split { fm: string | null; body: string }
export function splitFrontmatter(text: string): Split {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return m ? { fm: m[1], body: text.slice(m[0].length) } : { fm: null, body: text };
}

/** Top-level YAML entries (a key line plus its indented / list lines), by key. */
function yamlEntries(fm: string): { key: string | null; text: string }[] {
  const out: { key: string | null; text: string }[] = [];
  for (const line of fm.split(/\r?\n/)) {
    const k = line.match(/^([^\s#:][^:]*):(\s|$)/);
    if (k) out.push({ key: k[1].trim(), text: line });
    else if (out.length) out[out.length - 1].text += "\n" + line;
    else out.push({ key: null, text: line });
  }
  return out;
}

/**
 * The note's new text: managed frontmatter keys replaced (others kept), the managed body above the marker replaced,
 * and everything below the marker kept exactly. A note without the marker keeps its whole old body below it.
 */
export function mergeNote(existing: string | null, managedKeys: readonly string[], fm: Record<string, unknown>, body: string, starter = "## My notes\n\n"): string {
  const managedFm = yamlBlock(fm);
  if (existing === null) return `---\n${managedFm}\n---\n${body}\n\n${MARKER}\n${starter}`;
  const { fm: oldFm, body: oldBody } = splitFrontmatter(existing);
  const keep = oldFm ? yamlEntries(oldFm).filter((e) => e.key === null ? e.text.trim() !== "" : !managedKeys.includes(e.key)).map((e) => e.text) : [];
  const idx = oldBody.search(MARKER_RE);
  const mine = idx >= 0 ? oldBody.slice(idx).replace(MARKER_RE, "").replace(/^\r?\n/, "") : `\n${oldBody.trim()}\n`;
  return `---\n${[managedFm, ...keep].join("\n")}\n---\n${body}\n\n${MARKER}\n${mine}`;
}

/** The `id` in a note's frontmatter, if it's a LEDGR trade note. */
export function noteTradeId(text: string): string | null {
  const { fm } = splitFrontmatter(text);
  const m = fm?.match(/^id:\s*"?([^"\n]+)"?\s*$/m);
  return m ? m[1].trim() : null;
}
