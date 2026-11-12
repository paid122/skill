"use client";
/**
 * Cloud sync (Supabase). The whole journal is stored as one JSON snapshot per user in
 * `user_snapshots` (protected by row-level security); images and PDFs are stored in the
 * private `ledgr-attachments` bucket under the user's own folder.
 *
 * Local data stays the source of truth while offline. On sign-in and whenever the window
 * regains focus, `decideSync` compares this device with the cloud copy:
 *   push      – the cloud has nothing newer than this device
 *   pull      – this device has no unsynced changes and the cloud is newer (or this device is empty)
 *   conflict  – both changed; the user chooses which copy to keep
 */
import type { LedgrState } from "./types";

export type SyncDecision = "push" | "pull" | "conflict" | "noop";

export interface SyncMeta {
  userId: string;
  remoteUpdatedAt: string | null; // updated_at of the cloud copy last seen by this device
  localDirty: boolean; // local changes not yet pushed
}

export function hasUserData(s: Pick<LedgrState, "trades" | "accounts" | "dailyJournals" | "studyNotes" | "strategies">) {
  return s.trades.length + s.accounts.length + s.dailyJournals.length + s.studyNotes.length + s.strategies.length > 0;
}

export function decideSync(args: { userId: string; meta: SyncMeta | null; remoteUpdatedAt: string | null; localHasData: boolean }): SyncDecision {
  const { userId, meta, remoteUpdatedAt, localHasData } = args;
  if (!remoteUpdatedAt) return "push";
  const known = meta && meta.userId === userId;
  if (!known) return localHasData ? "conflict" : "pull";
  const remoteNewer = !meta.remoteUpdatedAt || remoteUpdatedAt > meta.remoteUpdatedAt;
  if (meta.localDirty && remoteNewer) return "conflict";
  if (meta.localDirty) return "push";
  if (remoteNewer) return "pull";
  return "noop";
}

const META_KEY = "ledgr.sync";
export function readMeta(): SyncMeta | null {
  try { const r = localStorage.getItem(META_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
export function writeMeta(m: SyncMeta | null) {
  try { if (m) localStorage.setItem(META_KEY, JSON.stringify(m)); else localStorage.removeItem(META_KEY); } catch { /* ignore */ }
}

/** Blob ids referenced by the journal (trade attachments, strategy screenshots, note images, board files). */
export function referencedBlobs(s: LedgrState): string[] {
  const ids = new Set<string>();
  s.trades.forEach((t) => { t.attachments.forEach((a) => ids.add(a.blobId)); if (t.showcase?.media) ids.add(t.showcase.media.blobId); if (t.showcase?.icon) ids.add(t.showcase.icon); });
  s.strategies.forEach((x) => x.screenshots.forEach((a) => ids.add(a.blobId)));
  s.studyNotes.forEach((n) => n.blocks.forEach((b) => b.blobId && ids.add(b.blobId)));
  s.studyBoards.forEach((b) => b.cards.forEach((c) => c.blobId && ids.add(c.blobId)));
  return [...ids];
}
