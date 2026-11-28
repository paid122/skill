/**
 * What the command center should show, worked out from the last fetch and the saved snapshot.
 * Pure (no Obsidian imports) so it can be tested.
 */
import type { ErrorKind } from "./api";
import type { Dashboard, Snapshot } from "./types";

export const STALE_AFTER_MS = 15 * 60_000; // older than this, the data is marked stale

export type ViewState =
  | { kind: "connect" } // no key yet
  | { kind: "loading" }
  | { kind: "locked"; reason: "invalid_key" | "not_pro"; message: string } // can't show data
  | { kind: "no_journal"; message: string }
  | { kind: "error"; message: string } // nothing to show at all
  | { kind: "data"; data: Dashboard; fetchedAt: number; live: boolean; stale: boolean; warning: string | null };

export interface LastFetch { ok: boolean; at: number; errorKind?: ErrorKind; message?: string }

export function viewState(hasKey: boolean, snap: Snapshot | null, last: LastFetch | null, loading: boolean, now: number): ViewState {
  if (!hasKey) return { kind: "connect" };
  // A wrong key or a plan without Pro must lock the view, even if old data is saved.
  if (last && !last.ok && (last.errorKind === "invalid_key" || last.errorKind === "not_pro")) {
    return { kind: "locked", reason: last.errorKind, message: last.message ?? "" };
  }
  if (last && !last.ok && last.errorKind === "no_journal") return { kind: "no_journal", message: last.message ?? "" };
  if (!snap) {
    if (loading || !last) return { kind: "loading" };
    return { kind: "error", message: last.message ?? "Something went wrong." };
  }
  const failed = !!last && !last.ok;
  const stale = failed || now - snap.fetchedAt > STALE_AFTER_MS;
  return {
    kind: "data", data: snap.data, fetchedAt: snap.fetchedAt,
    live: !failed && !stale, stale,
    warning: failed ? (last!.errorKind === "offline" ? "Offline: showing saved data." : last!.message ?? "Couldn't refresh: showing saved data.") : null,
  };
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
