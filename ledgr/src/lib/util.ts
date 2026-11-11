import type { ISODate } from "./types";

export function uid(prefix = ""): string {
  const r = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "").slice(0, 16) : Math.random().toString(36).slice(2, 18);
  return prefix ? `${prefix}_${r}` : r;
}

export function nowISO() {
  return new Date().toISOString();
}

/** Local calendar date (not UTC) as YYYY-MM-DD. */
export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function today(): ISODate {
  return toISODate(new Date());
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Monday of the week containing the date. */
export function weekStart(s: ISODate): ISODate {
  const d = parseISODate(s);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return toISODate(d);
}

export function monthKey(s: ISODate) {
  return s.slice(0, 7);
}

export const DOW = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export function dayOfWeek(s: ISODate) {
  return DOW[(parseISODate(s).getDay() + 6) % 7];
}

export function inRange(d: ISODate, from: ISODate | "", to: ISODate | "") {
  return (!from || d >= from) && (!to || d <= to);
}

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

let locale = "en-US";
export function setNumberLocale(l: string) {
  locale = l;
}
export function getNumberLocale() {
  return locale;
}

export function fmtMoney(n: number | null | undefined, currency = "USD", opts: { sign?: boolean; compact?: boolean } = {}) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const s = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: opts.compact && Math.abs(n) >= 10000 ? 1 : 2,
    minimumFractionDigits: opts.compact && Math.abs(n) >= 10000 ? 0 : 2,
    notation: opts.compact && Math.abs(n) >= 10000 ? "compact" : "standard",
  }).format(Math.abs(n));
  if (n < 0) return `−${s}`;
  return opts.sign && n > 0 ? `+${s}` : s;
}

export function fmtNum(n: number | null | undefined, dp = 2) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const s = new Intl.NumberFormat(locale, { maximumFractionDigits: dp, minimumFractionDigits: dp }).format(Math.abs(n));
  return n < 0 ? `−${s}` : s;
}

export function fmtR(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(Math.abs(n))}R`;
}

export function fmtPct(n: number | null | undefined, dp = 1) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: dp, minimumFractionDigits: dp }).format(n * 100)}%`;
}

export function fmtDate(s: ISODate | string, style: "short" | "long" | "day" = "short") {
  if (!s) return "—";
  const d = s.length === 10 ? parseISODate(s) : new Date(s);
  if (style === "long") return d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  if (style === "day") return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export function fmtTime(s: string) {
  if (!s) return "";
  return new Date(s).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export function toneOf(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(n) || n === 0) return "neutral";
  return n > 0 ? "pos" : "neg";
}

export function download(filename: string, content: string | Blob, type = "text/plain") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCSV(rows: (string | number | null)[][]) {
  return rows
    .map((r) =>
      r
        .map((v) => {
          const s = v === null || v === undefined ? "" : String(v);
          // Neutralise spreadsheet formula injection
          const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
          return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
        })
        .join(","),
    )
    .join("\n");
}

/** Relative luminance contrast ratio between two hex colours (WCAG). */
export function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const [r, g, bl] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export function isHex(s: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s);
}

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (u.hostname.endsWith("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(embed|shorts|live)\/([\w-]{6,})/);
      if (m) return m[2];
    }
  } catch {
    /* not a URL */
  }
  return null;
}

export function parseTimestamp(s: string): number | null {
  const m = s.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return (Number(m[1] ?? 0) * 3600) + Number(m[2]) * 60 + Number(m[3]);
}

export function fmtTimestamp(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export function safeUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}
