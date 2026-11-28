/**
 * The command center's numbers, ported from the prototype and made testable (no DOM here):
 * trade normalising, stats, sessions, insights, the risk guard, position sizing and the news check.
 */
import { prof, rootOf, type Instrument } from "./instruments";

// ------------------------------------------------------------------ time zone

/** Clock helpers for one IANA time zone. local(d) is a Date whose UTC fields read as wall time in that zone. */
export function zone(tz: string) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const tzOff = (d: Date) => {
    const o: Record<string, string> = {};
    f.formatToParts(d).forEach((x) => (o[x.type] = x.value));
    return Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour % 24, +o.minute, +o.second) - Math.floor(d.getTime() / 1000) * 1000;
  };
  const local = (d: Date) => new Date(d.getTime() + tzOff(d));
  const dayKey = (d: Date) => local(d).toISOString().slice(0, 10);
  return { tz, tzOff, local, dayKey };
}
export type Zone = ReturnType<typeof zone>;
export const fmtT = (tz: string, d = new Date()) => d.toLocaleTimeString("en-GB", { timeZone: tz, hour12: false });

// ------------------------------------------------------------------ formatting (as in the prototype)

export const money = (v: number) => (!isFinite(v) ? "—" : (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
export const smoney = (v: number) => (!isFinite(v) ? "—" : (v > 0 ? "+" : "") + money(v));
export const cls = (v: number) => (v > 0 ? "up" : v < 0 ? "down" : "");
export const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const fmtDur = (m: number) => { m = Math.max(0, Math.round(m)); const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60; return (d ? d + "d " : "") + (h ? h + "h " : "") + mm + "m"; };
export function cd(ms: number) { const t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), x = t % 60; return (h ? h + ":" : "") + String(m).padStart(2, "0") + ":" + String(x).padStart(2, "0"); }

// ------------------------------------------------------------------ trades

/** A trade as the LEDGR API returns it (GET /api/v1/trades), only the fields used here. */
export interface ApiTrade {
  id: string; symbol: string; direction: "long" | "short" | null; status: "open" | "closed" | "draft";
  date: string; quantity: number | null; entryPrice: number | null; exitPrice: number | null;
  pointValue: number | null; net: number | null; r: number | null; fees?: number | null;
  setup: string | null; strategy: string | null; accountId: string | null; openedAt: string | null;
  mistakes?: string[]; emotions?: string[]; rating?: number | null;
  executions?: { kind: "entry" | "exit"; time: string }[];
  updatedAt?: string;
}

export interface Trade {
  id: string; sym: string; root: string; pvj: number; acct: string; dir: "long" | "short";
  qty: number; en: number; ex: number; net: number; pts: number; r: number;
  time: Date | null; tin: Date | null; status: string; setup: string;
}

const n = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : NaN);

/** API trade → the prototype's trade shape. time = when it closed (last exit), tin = when it opened. */
export function norm(t: ApiTrade): Trade {
  const sym = String(t.symbol || "").toUpperCase(), dir = t.direction === "short" ? "short" : "long";
  const qty = n(t.quantity), en = n(t.entryPrice), ex = n(t.exitPrice), pts = isFinite(en) && isFinite(ex) ? (ex - en) * (dir === "short" ? -1 : 1) : NaN;
  const exits = (t.executions ?? []).filter((e) => e.kind === "exit").map((e) => Date.parse(e.time)).filter(isFinite);
  const opened = t.openedAt ? Date.parse(t.openedAt) : NaN;
  const dayOnly = t.date ? Date.parse(t.date + "T12:00:00Z") : NaN; // trades logged without times: midday, so the date stays right
  const close = exits.length ? Math.max(...exits) : isFinite(opened) ? opened : dayOnly;
  return {
    id: t.id, sym, root: rootOf(sym), pvj: n(t.pointValue), acct: String(t.accountId ?? ""), dir, qty, en, ex, net: n(t.net), pts, r: n(t.r),
    time: isFinite(close) ? new Date(close) : null, tin: isFinite(opened) ? new Date(opened) : isFinite(close) ? new Date(close) : null,
    status: String(t.status || "closed").toLowerCase(), setup: String(t.setup || t.strategy || "—"),
  };
}

/** Closed trades with a result and a time, oldest first. */
export const closedOf = (tr: Trade[]) => tr.filter((t) => t.status === "closed" && isFinite(t.net) && t.time && !isNaN(+t.time)).sort((a, b) => +a.time! - +b.time!);

export interface Stats { n: number; net: number; win: number; pf: number; dd: number; avgR: number; gw: number; gl: number; w: number; l: number }

/** Win rate = wins / (wins + losses), like LEDGR (breakeven trades don't count either way). */
export function S(ts: Trade[]): Stats {
  const w = ts.filter((t) => t.net > 0), l = ts.filter((t) => t.net < 0), gw = w.reduce((s, t) => s + t.net, 0), gl = -l.reduce((s, t) => s + t.net, 0);
  let eq = 0, pk = 0, dd = 0;
  ts.forEach((t) => { eq += t.net; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); });
  const rs = ts.map((t) => t.r).filter(isFinite);
  return { n: ts.length, net: gw - gl, win: w.length + l.length ? w.length / (w.length + l.length) : NaN, pf: gl ? gw / gl : gw ? Infinity : NaN, dd, avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : NaN, gw, gl, w: w.length, l: l.length };
}

/** Session by UTC time, as the prototype: Asia, London 07:00–13:30, New York 13:30–21:00. */
export const sessOf = (d: Date) => { const h = d.getUTCHours() + d.getUTCMinutes() / 60; return h >= 13.5 && h < 21 ? "NEW YORK" : h >= 7 && h < 13.5 ? "LONDON" : "ASIA"; };

/** Trades within 20 min of a losing trade, and losses beyond -1.2R. */
export function behaviour(c: Trade[]) {
  let tilt = 0;
  for (let i = 1; i < c.length; i++) if (c[i - 1].net < 0 && +c[i].time! - +c[i - 1].time! < 20 * 60e3) tilt++;
  return { tilt, bigL: c.filter((t) => isFinite(t.r) && t.r < -1.2).length };
}

/** Groups closed trades and ranks the groups by net P&L (best first). */
export function groupBy(c: Trade[], f: (t: Trade) => string) {
  const g: Record<string, Trade[]> = {};
  c.forEach((t) => { const k = f(t); (g[k] = g[k] || []).push(t); });
  return Object.entries(g).map(([k, a]) => ({ k, ...S(a) })).sort((a, b) => b.net - a.net);
}

/** The neural map's node captions. */
export function brainLabels(c: Trade[]): Record<string, string> {
  const s = S(c), best = groupBy(c, (t) => t.setup)[0], { tilt, bigL } = behaviour(c);
  const none = "awaiting data";
  return {
    PSYCHE: c.length ? `${tilt} quick re-entries after losses` : none, STRATEGY: best ? `best setup: ${best.k}` : none, RULES: c.length ? `${bigL} losses beyond -1.2R` : none,
    PERFORMANCE: c.length ? `${smoney(s.net)} · win ${(s.win * 100).toFixed(0)}%` : none, RISK: c.length ? `max drawdown ${money(s.dd)}` : none, LEARNING: "see Psyche report", BODY: "sleep · focus · energy",
  };
}

/** Instruments in the journal, most traded first, and the profile for a choice (AUTO / ALL / a root). */
export function instrumentsOf(all: Trade[]) {
  const cnt: Record<string, number> = {};
  all.forEach((t) => { const k = t.root || "—"; cnt[k] = (cnt[k] || 0) + 1; });
  return { list: Object.keys(cnt).filter((k) => k !== "—").sort((a, b) => cnt[b] - cnt[a]), cnt };
}
export function focusOf(all: Trade[], list: string[], choice: string, fallback = "MGC") {
  const focus = choice === "AUTO" || choice === "ALL" ? list[0] : choice;
  const pvj = all.find((t) => t.root === focus && isFinite(t.pvj))?.pvj;
  return { focus, trades: choice === "ALL" || !focus ? all.slice() : all.filter((t) => t.root === focus), cur: prof(focus || fallback, pvj && isFinite(pvj) ? pvj : 0) };
}

// ------------------------------------------------------------------ risk guard

export interface Guard { loss: number; trades: number; consec: number; cool: number }
export const GUARD_DEFAULT: Guard = { loss: 200, trades: 4, consec: 2, cool: 20 };

export function guardState(today: Trade[], rg: Guard, now: number) {
  const net = today.reduce((a, t) => a + t.net, 0), count = today.length;
  let consec = 0;
  for (let i = today.length - 1; i >= 0 && today[i].net < 0; i--) consec++;
  const lastLoss = [...today].reverse().find((t) => t.net < 0);
  const coolLeft = lastLoss ? Math.max(0, +lastLoss.time! + rg.cool * 60e3 - now) : 0;
  const why: string[] = [];
  let lvl: "OK" | "CAUTION" | "STOP" = "OK";
  if (-net >= rg.loss) { lvl = "STOP"; why.push("daily loss limit hit"); }
  if (count >= rg.trades) { lvl = "STOP"; why.push("max trades reached"); }
  if (consec >= rg.consec) { lvl = "STOP"; why.push(consec + " losses in a row"); }
  if (lvl !== "STOP") {
    if (-net >= rg.loss * 0.7) { lvl = "CAUTION"; why.push("near loss limit"); }
    if (count >= rg.trades - 1) { lvl = "CAUTION"; why.push("one trade left"); }
    if (coolLeft > 0) { lvl = "CAUTION"; why.push("cool-down " + cd(coolLeft)); }
    if (consec === rg.consec - 1 && consec > 0) { lvl = "CAUTION"; why.push("one more loss = stop"); }
  }
  return { net, n: count, consec, coolLeft, lvl, why };
}

// ------------------------------------------------------------------ position size

export interface Sizing { acc: number; pct: number; fee: number; max: number }
export const SIZING_DEFAULT = { acc: 5000, pct: 1, fee: 1.24, max: 10, en: "" as number | "", st: "" as number | "" };

/** Contracts for a planned risk, using the instrument's point value; fees are per contract, round trip. */
export function sizeFor(cur: Pick<Instrument, "pv" | "tick">, s: Sizing, en: number, st: number) {
  if (!isFinite(en) || !isFinite(st) || en === st) return null;
  const dist = Math.abs(en - st), risk = (+s.acc * +s.pct) / 100, per = dist * cur.pv + (+s.fee || 0);
  const raw = Math.floor(risk / per), max = +s.max || 99, contracts = Math.max(0, Math.min(max, raw)), sgn = en > st ? 1 : -1;
  return {
    contracts, raw, capped: raw > max, dir: en > st ? "LONG" : "SHORT", dist, ticks: Math.round(dist / cur.tick), perContract: per, planned: risk, actual: contracts * per,
    target: (r: number) => en + sgn * dist * r, reward: (r: number) => contracts * dist * cur.pv * r,
  };
}

// ------------------------------------------------------------------ economic calendar

export interface CalEvent { title: string; country: string; date: string; impact: string; forecast?: string; previous?: string; t: Date; i: number }
export const IMP: Record<string, number> = { High: 3, Medium: 2, Low: 1, Holiday: 0 };

/** true: no high-impact news for the instrument's currencies from 5 min ago to 30 min ahead; null: no calendar. */
export function newsClear(ev: CalEvent[] | null, ccy: string[], now: number): boolean | null {
  if (!ev) return null;
  return !ev.some((e) => e.i === 3 && ccy.includes(e.country) && +e.t - now > -5 * 60e3 && +e.t - now < 30 * 60e3);
}

/** Which alert thresholds (15, 5, 1, 0 minutes) were crossed between two checks. */
export function crossed(prevMs: number | undefined, remMs: number): number[] {
  if (prevMs === undefined) return [];
  return [15, 5, 1, 0].filter((m) => prevMs > m * 60e3 && remMs <= m * 60e3);
}
