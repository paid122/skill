/** Number formatting for the command center (pure, tested). */

export function money(n: number | null | undefined, currency = "USD", { sign = false } = {}): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  let s: string;
  try {
    s = new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
  } catch {
    s = `${Math.abs(n).toFixed(2)} ${currency}`;
  }
  if (n < 0) return `-${s}`;
  return sign && n > 0 ? `+${s}` : s;
}

export function pct(fraction: number | null | undefined, dp = 1): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return "—";
  return `${(fraction * 100).toFixed(dp)}%`;
}

export function num(n: number | null | undefined, dp = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toFixed(dp);
}

export function r(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}R`;
}

/** "pos", "neg" or "" for colouring P&L. */
export function tone(n: number | null | undefined): "pos" | "neg" | "" {
  if (n === null || n === undefined || !Number.isFinite(n) || n === 0) return "";
  return n > 0 ? "pos" : "neg";
}
