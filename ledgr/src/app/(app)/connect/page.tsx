"use client";
import { Check, Download, KeyRound, Link2, ShieldCheck, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { PageIntro } from "@/components/blocks";
import { PlanWall, PlusTag } from "@/components/PlusGate";
import { Button, Card, Input, useFeedback } from "@/components/ui";
import { getMatrixxKey } from "@/lib/matrixxClient";
import { supabase, useSession } from "@/lib/supabase";
import { fmtDate } from "@/lib/util";

/**
 * Connected apps: the Obsidian plugin (download + setup), approving a "Connect with LEDGR" code, and the apps and
 * keys that can use your journal (each can be disconnected).
 */
async function call(method: "GET" | "POST" | "DELETE", path: string, body?: unknown) {
  const token = (await supabase()?.auth.getSession())?.data.session?.access_token;
  const res = await fetch(path, {
    method, cache: "no-store",
    headers: { Authorization: `Bearer ${token ?? ""}`, "x-matrixx-key": getMatrixxKey(), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? `Something went wrong (${res.status}).`);
  return j;
}

interface KeyInfo { id: string; name: string; prefix: string; created_at: string; last_used_at: string | null }

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-line-soft pt-8 first:border-t-0 first:pt-0 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 className="text-[15px] font-semibold text-text">{title}</h2>
        {sub && <p className="mt-1 text-[13px] leading-relaxed text-muted">{sub}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

// ------------------------------------------------------------------ LEDGR for Obsidian

function Obsidian() {
  const steps = [
    "Download the plugin and double-click the zip to unzip it.",
    "In Obsidian: Settings → Community plugins → turn them on, then click the folder icon next to “Installed plugins”.",
    "Copy the “ledgr” folder into that plugins folder.",
    "Back in Obsidian, click ↻ next to Installed plugins and switch LEDGR on.",
    "Settings → LEDGR → Connect with LEDGR, and approve the code on this page.",
    "Click the pulse icon in Obsidian's left bar to open the Command Center.",
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-hidden rounded-2xl border border-line-soft bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/downloads/obsidian-command-center.jpg" alt="The LEDGR Command Center inside Obsidian" className="block w-full" loading="lazy" />
        <p className="border-t border-line-soft px-4 py-2 text-[12px] text-muted">The Command Center in Obsidian, shown with sample data.</p>
      </div>
      <ul className="grid gap-2 text-[13.5px] text-text-2 sm:grid-cols-2">
        {[
          "Your stats, P&L curve, clocks and session radar",
          "Risk guard, pre-trade checklist and position sizer",
          "Live charts and news (TradingView)",
          "Every trade as a linked note: days, setups, mistakes",
        ].map((t) => <li key={t} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-pos" />{t}</li>)}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <a href="/downloads/ledgr-obsidian.zip" download className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[14px] font-semibold text-on-accent"><Download size={15} /> Download for Obsidian</a>
        <span className="text-[12.5px] text-muted">Version 0.4 · Mac, Windows and Linux · Obsidian 1.11.4 or newer</span>
      </div>
      <ol className="space-y-2 text-[13.5px] text-text-2">
        {steps.map((s, i) => (
          <li key={s} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-card-2 text-[12px] font-semibold text-text">{i + 1}</span><span className="pt-0.5">{s}</span></li>
        ))}
      </ol>
    </div>
  );
}

// ------------------------------------------------------------------ approve a code

function Approve({ onApproved }: { onApproved: () => void }) {
  const params = useSearchParams();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [app, setApp] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "checking" | "ready" | "approved" | "denied">("idle");
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async (c: string) => {
    setError(null); setState("checking");
    try { const r = await call("GET", `/api/keys/device?code=${encodeURIComponent(c)}`); setApp(r.client); setCode(r.code); setState("ready"); }
    catch (e) { setError((e as Error).message); setState("idle"); }
  }, []);
  useEffect(() => { const c = params.get("code"); if (c) void check(c); }, [params, check]);

  const decide = async (action: "approve" | "deny") => {
    setError(null);
    try { await call("POST", "/api/keys/device", { code, action }); setState(action === "approve" ? "approved" : "denied"); if (action === "approve") onApproved(); }
    catch (e) { setError((e as Error).message); }
  };

  if (state === "approved" || state === "denied") {
    const ok = state === "approved";
    return (
      <div className="rounded-2xl border border-line-soft p-5 text-center">
        <span className={`mx-auto grid h-12 w-12 place-items-center rounded-2xl ${ok ? "bg-pos/15 text-pos" : "bg-card-2 text-text-2"}`}>{ok ? <Check size={22} /> : <X size={22} />}</span>
        <p className="mt-3 text-[16px] font-semibold text-text">{ok ? `${app ?? "The app"} is connected` : "Connection declined"}</p>
        <p className="mt-1 text-[13.5px] text-text-2">{ok ? "Go back to the app: it finishes connecting by itself." : "Nothing was shared."}</p>
        <Button className="mt-4" size="sm" variant="ghost" onClick={() => { setState("idle"); setCode(""); setApp(null); }}>Approve another code</Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line-soft p-5">
      {state === "ready" && app ? (
        <>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-card-2 text-text"><Link2 size={19} /></span>
            <div>
              <p className="text-[16px] font-semibold text-text">{app} wants to connect</p>
              <p className="font-mono text-[13px] text-muted">Code {code}</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-card-2/50 p-4 text-[13.5px] leading-relaxed text-text-2">
            <p className="flex items-center gap-2 font-medium text-text"><ShieldCheck size={15} /> It will be able to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5"><li>read your trades, accounts and stats</li><li>add trades to your journal</li></ul>
            <p className="mt-3 text-[12.5px] text-muted">It can&apos;t change or delete trades, see your password, or make payments.</p>
          </div>
          <p className="mt-3 text-[12.5px] text-muted">Only approve if you just started this in {app} and the code matches what it shows.</p>
          <div className="mt-4 flex gap-2">
            <Button variant="accent" onClick={() => decide("approve")}>Approve</Button>
            <Button variant="ghost" onClick={() => decide("deny")}>Deny</Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[13.5px] text-text-2">In the app, choose <b className="text-text">Connect with LEDGR</b>. This page opens with the code filled in, or type it here.</p>
          <div className="mt-3 flex gap-2">
            <Input aria-label="Code" placeholder="K7QX-3MRT" value={code} maxLength={9} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") void check(code); }} className="font-mono uppercase tracking-widest sm:max-w-[200px]" />
            <Button variant="accent" disabled={state === "checking" || !code.trim()} onClick={() => check(code)}>{state === "checking" ? "Checking…" : "Continue"}</Button>
          </div>
        </>
      )}
      {error && <p role="alert" className="mt-4 rounded-lg border border-neg/30 bg-neg/10 px-3 py-2 text-[13px] text-neg">{error}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ connected apps and keys

function Apps({ version }: { version: number }) {
  const { toast, confirm } = useFeedback();
  const [keys, setKeys] = useState<KeyInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setKeys((await call("GET", "/api/keys")).keys); setError(null); } catch (e) { setError((e as Error).message); setKeys([]); }
  }, []);
  useEffect(() => { void load(); }, [load, version]);

  const revoke = async (k: KeyInfo) => {
    if (!(await confirm({ title: `Disconnect "${k.name}"?`, body: "It stops working straight away. You can connect it again later.", confirm: "Disconnect", danger: true }))) return;
    try { await call("DELETE", `/api/keys?id=${k.id}`); toast("Disconnected"); await load(); } catch (e) { setError((e as Error).message); }
  };

  return (
    <div>
      {error && <p role="alert" className="mb-3 rounded-lg border border-neg/30 bg-neg/10 px-3 py-2 text-[13px] text-neg">{error}</p>}
      {keys === null ? <p className="text-[13px] text-muted">Loading…</p> : keys.length === 0 ? (
        <p className="text-[13.5px] text-muted">Nothing is connected yet.</p>
      ) : (
        <ul className="divide-y divide-line-soft overflow-hidden rounded-xl border border-line-soft">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-card-2 text-text-2">{/^obsidian/i.test(k.name) ? <Link2 size={15} /> : <KeyRound size={15} />}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium text-text">{k.name}</p>
                <p className="truncate text-[12px] text-muted">connected {fmtDate(k.created_at)} · {k.last_used_at ? `last used ${fmtDate(k.last_used_at)}` : "not used yet"}</p>
              </div>
              <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={() => revoke(k)}>Disconnect</Button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[12.5px] text-muted">API keys for your own scripts are in <Link href="/settings/api" className="underline">Settings → API</Link>.</p>
    </div>
  );
}

// ------------------------------------------------------------------ page

function Page() {
  const session = useSession();
  const [version, setVersion] = useState(0);
  return (
    <Card className="flex flex-col gap-8">
      <Section title="LEDGR for Obsidian" sub="Your journal as a command center and a second brain inside Obsidian.">
        <Obsidian />
      </Section>
      <Section title="Approve a code" sub="Connect an app to your journal without copying an API key.">
        {session === undefined ? null : session ? <Approve onApproved={() => setVersion((v) => v + 1)} /> : (
          <p className="text-[13.5px] text-text-2">Sign in to your LEDGR account first: <Link href="/settings" className="underline">Settings</Link>.</p>
        )}
      </Section>
      <Section title="Connected" sub="Apps and keys that can use your journal. Disconnect any of them at any time.">
        {session ? <Apps version={version} /> : <p className="text-[13.5px] text-muted">Sign in to see your connected apps.</p>}
      </Section>
    </Card>
  );
}

export default function ConnectPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageIntro title={<span className="flex items-center gap-2">Connected apps <PlusTag level="pro" /></span>} sub="Use your LEDGR journal in other apps, starting with Obsidian." />
      <PlanWall level="pro" feature="Connected apps" sub="LEDGR for Obsidian and connecting apps come with LEDGR Pro: your journal as a command center and a second brain.">
        <Suspense><Page /></Suspense>
      </PlanWall>
    </div>
  );
}
