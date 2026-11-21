"use client";
/**
 * Is LEDGR+ on for this person? True when their connected MatrixX account is on a paid plan that
 * hasn't ended, or when they're LEDGR's owner / co-owner (signed in). Checked once, then cached for
 * the session (5 minutes). This only unlocks features in the browser; payments happen in MatrixX.
 */
import { useEffect, useState } from "react";
import { loadBadges } from "./community";
import { getMatrixxKey } from "./matrixxClient";
import { supabase } from "./supabase";

const KEY = "ledgr.plus";
let pending: Promise<boolean> | null = null;

async function check(): Promise<boolean> {
  try {
    const c = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as { v: boolean; at: number } | null;
    if (c && Date.now() - c.at < 5 * 60_000) return c.v;
  } catch { /* ignore */ }
  let v = false;
  const uid = (await supabase()?.auth.getSession().catch(() => null))?.data.session?.user.id;
  if (uid && (await loadBadges())[uid]) v = true;
  const k = getMatrixxKey();
  if (!v && k) {
    const r = await fetch("/api/plus/status", { headers: { "x-matrixx-key": k }, cache: "no-store" }).then((x) => x.json()).catch(() => null) as { plan?: { paid?: boolean; tier?: string; period_end?: string | null } | null } | null;
    const p = r?.plan;
    v = !!p && (p.paid === true || (!!p.tier && p.tier !== "free")) && (!p.period_end || new Date(p.period_end).getTime() > Date.now());
  }
  try { sessionStorage.setItem(KEY, JSON.stringify({ v, at: Date.now() })); } catch { /* ignore */ }
  return v;
}

/** null while checking, then true / false. */
export function usePlus(): boolean | null {
  const [v, setV] = useState<boolean | null>(null);
  useEffect(() => {
    pending ??= check().finally(() => setTimeout(() => { pending = null; }, 1000));
    void pending.then(setV);
  }, []);
  return v;
}

/** Forget the cached answer (after buying or connecting MatrixX). */
export function refreshPlus() { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } }
