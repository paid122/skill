/**
 * Which screen the view shows (pure, tested): connect, locked, no journal, or the command center.
 * The command center itself works offline from cached trades and marks them stale.
 */
import type { ErrorKind } from "./api";

export interface LastFetch { ok: boolean; at: number; errorKind?: ErrorKind; message?: string }

export type Mode =
  | { kind: "connect" }
  | { kind: "locked"; reason: "invalid_key" | "not_pro"; message: string }
  | { kind: "no_journal"; message: string }
  | { kind: "cc" };

export function mode(hasKey: boolean, last: LastFetch | null): Mode {
  if (!hasKey) return { kind: "connect" };
  // A wrong or revoked key, or an account without LEDGR Pro, locks the view even if trades are cached.
  if (last && !last.ok && (last.errorKind === "invalid_key" || last.errorKind === "not_pro")) return { kind: "locked", reason: last.errorKind, message: last.message ?? "" };
  if (last && !last.ok && last.errorKind === "no_journal") return { kind: "no_journal", message: last.message ?? "" };
  return { kind: "cc" };
}

/** "just now", "4 min ago", "3 h ago", "2 days ago". */
export function ago(then: number, now: number): string {
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
