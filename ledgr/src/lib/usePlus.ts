"use client";
/**
 * Which LEDGR plan is on for this person: "free", "plus" (LEDGR+) or "pro" (LEDGR Pro).
 * From their connected MatrixX account's paid plan (Starter → LEDGR+, Plus or higher → LEDGR Pro)
 * while it hasn't ended; LEDGR's owner and co-owners always get Pro. Checked once, then cached for
 * the session (5 minutes). This unlocks features in the browser; payments happen in MatrixX.
 */
import { useEffect, useState } from "react";
import { loadBadges } from "./community";
import { getMatrixxKey } from "./matrixxClient";
import type { PlanId } from "./plus";
import { supabase } from "./supabase";

const KEY = "ledgr.plan";
const RANK: Record<PlanId, number> = { free: 0, plus: 1, pro: 2 };
let pending: Promise<PlanId> | null = null;

export const planFromMatrixx = (p: { paid?: boolean; tier?: string; period_end?: string | null } | null | undefined): PlanId => {
  if (!p || !p.tier || p.tier === "free") return "free";
  if (p.period_end && new Date(p.period_end).getTime() <= Date.now()) return "free";
  return p.tier === "starter" ? "plus" : "pro";
};

async function check(): Promise<PlanId> {
  try {
    const c = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as { v: PlanId; at: number } | null;
    if (c && Date.now() - c.at < 5 * 60_000) return c.v;
  } catch { /* ignore */ }
  let v: PlanId = "free";
  const uid = (await supabase()?.auth.getSession().catch(() => null))?.data.session?.user.id;
  if (uid && (await loadBadges())[uid]) v = "pro";
  const k = getMatrixxKey();
  if (v === "free" && k) {
    const r = await fetch("/api/plus/status", { headers: { "x-matrixx-key": k }, cache: "no-store" }).then((x) => x.json()).catch(() => null) as { plan?: { paid?: boolean; tier?: string; period_end?: string | null } | null } | null;
    v = planFromMatrixx(r?.plan);
  }
  try { sessionStorage.setItem(KEY, JSON.stringify({ v, at: Date.now() })); } catch { /* ignore */ }
  return v;
}

/** null while checking, then the plan. */
export function usePlan(): PlanId | null {
  const [v, setV] = useState<PlanId | null>(null);
  useEffect(() => {
    pending ??= check().finally(() => setTimeout(() => { pending = null; }, 1000));
    void pending.then(setV);
  }, []);
  return v;
}

export const atLeast = (plan: PlanId | null, need: PlanId) => plan !== null && RANK[plan] >= RANK[need];

/** LEDGR+ or better (null while checking). */
export function usePlus(): boolean | null {
  const p = usePlan();
  return p === null ? null : atLeast(p, "plus");
}

/** Forget the cached answer (after buying or connecting MatrixX). */
export function refreshPlus() { try { sessionStorage.removeItem(KEY); sessionStorage.removeItem("ledgr.plus"); } catch { /* ignore */ } }
