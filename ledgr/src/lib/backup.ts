"use client";
import { migrate } from "./defaults";
import { allBlobKeys, getBlob, getState, putBlob, replaceState } from "./store";
import type { LedgrState } from "./types";

interface Backup { app: "ledgr"; exportedAt: string; state: LedgrState; blobs?: Record<string, string> }

const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(b); });

export async function createBackup(includeImages: boolean): Promise<string> {
  const backup: Backup = { app: "ledgr", exportedAt: new Date().toISOString(), state: getState() };
  if (includeImages) {
    backup.blobs = {};
    for (const k of await allBlobKeys()) { const b = await getBlob(k); if (b) backup.blobs[k] = await blobToDataUrl(b); }
  }
  return JSON.stringify(backup);
}

const ARRAY_KEYS: (keyof LedgrState)[] = ["accounts", "adjustments", "trades", "strategies", "dailyJournals", "weeklyJournals", "studyFolders", "studyNotes", "studyBoards", "favouriteVerses", "verseHistory", "goals", "savedFilters", "conversations", "reports"];

/** Validates a backup file and restores it. Throws a readable Error on invalid input. */
export async function restoreBackup(text: string) {
  let data: Backup;
  try { data = JSON.parse(text); } catch { throw new Error("This file is not valid JSON."); }
  if (!data || data.app !== "ledgr" || typeof data.state !== "object" || !data.state) throw new Error("This file is not a Ledgr backup.");
  for (const k of ARRAY_KEYS) if (data.state[k] !== undefined && !Array.isArray(data.state[k])) throw new Error(`Backup field “${k}” is malformed.`);
  for (const t of data.state.trades ?? []) {
    if (typeof t.id !== "string" || typeof t.number !== "number" || !Array.isArray(t.executions)) throw new Error("A trade in the backup is malformed.");
  }
  if (data.blobs) {
    for (const [k, url] of Object.entries(data.blobs)) {
      if (!/^data:(image\/(png|jpeg|webp|gif)|application\/pdf);base64,/.test(url)) continue;
      const blob = await (await fetch(url)).blob();
      await putBlob(k, blob);
    }
  }
  await replaceState(migrate(data.state));
}
