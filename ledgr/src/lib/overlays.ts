"use client";
import { useSyncExternalStore } from "react";

export interface OverlayState {
  editor: { tradeId: string | null; tab?: string } | null; // tradeId null = new trade
  quickLog: boolean;
  palette: boolean;
  importCsv: boolean;
}
let st: OverlayState = { editor: null, quickLog: false, palette: false, importCsv: false };
const ls = new Set<() => void>();
const set = (p: Partial<OverlayState>) => { st = { ...st, ...p }; ls.forEach((l) => l()); };

export const openEditor = (tradeId: string | null, tab?: string) => set({ editor: { tradeId, tab }, quickLog: false });
export const closeEditor = () => set({ editor: null });
export const openQuickLog = () => set({ quickLog: true });
export const closeQuickLog = () => set({ quickLog: false });
export const openImport = () => set({ importCsv: true, quickLog: false });
export const closeImport = () => set({ importCsv: false });
export const setPalette = (palette: boolean) => set({ palette });

export function useOverlays() {
  return useSyncExternalStore((l) => { ls.add(l); return () => ls.delete(l); }, () => st, () => st);
}
