"use client";
/**
 * Local-first persistence.
 * State is kept in memory, observed with useSyncExternalStore and written to IndexedDB
 * (debounced). Binary attachments live in a separate object store keyed by blob id.
 * Other open tabs are notified through BroadcastChannel and reload.
 *
 * The relational schema in /supabase/migrations mirrors this model for hosted deployments.
 */
import { useRef, useSyncExternalStore } from "react";
import { emptyState, migrate } from "./defaults";
import type { LedgrState } from "./types";

const DB_NAME = "ledgr";
const DB_VERSION = 1;
const STATE_KEY = "state";

let state: LedgrState | null = null;
let hydrated = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastError: string | null = null;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
const tabId = Math.random().toString(36).slice(2);

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb<T>(store: "kv" | "blobs", mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

function emit() {
  listeners.forEach((l) => l());
}

async function persist() {
  if (!state) return;
  try {
    await idb("kv", "readwrite", (s) => s.put(state, STATE_KEY));
    lastError = null;
    channel?.postMessage({ type: "changed", from: tabId });
  } catch (e) {
    lastError = e instanceof Error ? e.message : "Could not save to browser storage";
    emit();
  }
}

export async function hydrate() {
  if (hydrated) return;
  try {
    const raw = await idb<LedgrState | undefined>("kv", "readonly", (s) => s.get(STATE_KEY));
    state = raw ? migrate(raw) : emptyState();
  } catch {
    state = emptyState();
    lastError = "Browser storage is unavailable. Changes will not be saved.";
  }
  hydrated = true;
  if (typeof BroadcastChannel !== "undefined" && !channel) {
    channel = new BroadcastChannel("ledgr");
    channel.onmessage = async (ev) => {
      if (ev.data?.type === "changed" && ev.data.from !== tabId) {
        const raw = await idb<LedgrState | undefined>("kv", "readonly", (s) => s.get(STATE_KEY));
        if (raw) {
          state = migrate(raw);
          emit();
        }
      }
    };
  }
  emit();
}

export function getState(): LedgrState {
  if (!state) throw new Error("Ledgr state used before hydration");
  return state;
}

export function setState(recipe: (s: LedgrState) => LedgrState) {
  if (!state) return;
  state = recipe(state);
  emit();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 250);
}

/** Flush pending writes immediately (used before navigation-sensitive operations and tests). */
export async function flush() {
  if (saveTimer) clearTimeout(saveTimer);
  await persist();
}

export function replaceState(next: LedgrState) {
  state = migrate(next);
  emit();
  return flush();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const serverSnapshot = () => null;

export function useHydrated() {
  return useSyncExternalStore(subscribe, () => hydrated, () => false);
}

export function useStorageError() {
  return useSyncExternalStore(subscribe, () => lastError, serverSnapshot);
}

/**
 * Select from state. Results are cached per state snapshot, so selectors may derive
 * new arrays/objects (e.g. filters) without causing render loops.
 */
export function useLedgr<T>(selector: (s: LedgrState) => T): T {
  const cache = useRef<{ src: LedgrState | null; fn: (s: LedgrState) => T; value: T } | null>(null);
  const sel = useRef(selector);
  sel.current = selector;
  const get = () => {
    const src = state ?? FALLBACK;
    if (cache.current && cache.current.src === src && cache.current.fn === sel.current) return cache.current.value;
    const value = sel.current(src);
    if (cache.current && cache.current.src === src && shallowEqual(cache.current.value, value)) {
      cache.current = { src, fn: sel.current, value: cache.current.value };
      return cache.current.value;
    }
    cache.current = { src, fn: sel.current, value };
    return value;
  };
  return useSyncExternalStore(subscribe, get, get);
}
function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

const FALLBACK = emptyStateStable();
function emptyStateStable(): LedgrState {
  // Deterministic placeholder used only for server render / before hydration.
  const s = emptyState();
  s.studyFolders = [];
  return s;
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const ALLOWED_DOC_TYPES = ["application/pdf"];

export async function putBlob(id: string, file: Blob) {
  await idb("blobs", "readwrite", (s) => s.put(file, id));
}

export async function getBlob(id: string): Promise<Blob | undefined> {
  return idb<Blob | undefined>("blobs", "readonly", (s) => s.get(id));
}

export async function deleteBlob(id: string) {
  await idb("blobs", "readwrite", (s) => s.delete(id));
}

export async function allBlobKeys(): Promise<string[]> {
  return idb<string[]>("blobs", "readonly", (s) => s.getAllKeys() as IDBRequest);
}

export async function clearAll() {
  await idb("blobs", "readwrite", (s) => s.clear());
  state = emptyState();
  emit();
  await flush();
}

export function validateUpload(file: File, kinds: ("image" | "pdf")[]): string | null {
  const okTypes = [...(kinds.includes("image") ? ALLOWED_IMAGE_TYPES : []), ...(kinds.includes("pdf") ? ALLOWED_DOC_TYPES : [])];
  if (!okTypes.includes(file.type)) return `Unsupported file type. Use ${kinds.includes("pdf") ? "PNG, JPEG, WebP, GIF or PDF" : "PNG, JPEG, WebP or GIF"}.`;
  if (file.size > MAX_IMAGE_BYTES) return "File is larger than 8 MB.";
  return null;
}
