"use client";
import { Check, Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PageIntro } from "@/components/blocks";
import { PlanWall, PlusTag } from "@/components/PlusGate";
import { SettingsNav } from "@/components/SettingsNav";
import { Button, Card, Input, useFeedback } from "@/components/ui";
import { getMatrixxKey } from "@/lib/matrixxClient";
import { supabase, useSession } from "@/lib/supabase";
import { atLeast, usePlan } from "@/lib/usePlus";
import { cx, fmtDate } from "@/lib/util";

interface KeyInfo { id: string; name: string; prefix: string; plan_source: "owner" | "matrixx"; pro_until: string | null; created_at: string; last_used_at: string | null }

async function call(method: string, path = "/api/keys", body?: unknown) {
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

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button size="sm" icon={done ? <Check size={13} /> : <Copy size={13} />} onClick={() => { void navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>
      {done ? "Copied" : label}
    </Button>
  );
}

function Code({ children }: { children: string }) {
  return (
    <div className="group relative">
      <pre className="scroll-thin overflow-x-auto rounded-xl border border-line-soft bg-bg-2 px-4 py-3 font-mono text-[12.5px] leading-relaxed text-text-2">{children}</pre>
      <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100"><CopyButton text={children} /></div>
    </div>
  );
}

const ENDPOINTS: { method: "GET" | "POST"; path: string; what: string }[] = [
  { method: "GET", path: "/me", what: "Your key, plan, and what's in your journal" },
  { method: "GET", path: "/accounts", what: "Accounts with balance, P&L and drawdown" },
  { method: "GET", path: "/trades", what: "Trades, newest first: net, R, review. ?from ?to ?account ?symbol ?status ?limit ?offset" },
  { method: "GET", path: "/stats", what: "Win rate, net, profit factor, R, drawdown, daily P&L. Same filters as /trades" },
  { method: "POST", path: "/trades", what: "Send in one trade or up to 50. They're added the next time LEDGR is open" },
];

function Keys() {
  const session = useSession();
  const { toast, confirm } = useFeedback();
  const [keys, setKeys] = useState<KeyInfo[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setKeys((await call("GET")).keys); setError(null); } catch (e) { setError((e as Error).message); setKeys([]); }
  }, []);
  useEffect(() => {
    if (!session) return;
    // Re-check LEDGR Pro first, so keys switch back on after renewing.
    void call("PATCH").catch(() => undefined).finally(load);
  }, [session, load]);

  if (session === undefined) return null;
  if (!session) return <p className="text-[13.5px] text-text-2">Sign in to your LEDGR account (Settings → General) with cloud sync on. The API reads the journal saved in your account.</p>;

  const create = async () => {
    setBusy(true); setError(null);
    try { const r = await call("POST", "/api/keys", { name: name.trim() || "API key" }); setFresh(r.key); setName(""); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const revoke = async (k: KeyInfo) => {
    if (!(await confirm({ title: `Revoke "${k.name}"?`, body: "Anything using this key stops working straight away. This can't be undone.", confirm: "Revoke", danger: true }))) return;
    try { await call("DELETE", `/api/keys?id=${k.id}`); toast("Key revoked"); await load(); } catch (e) { setError((e as Error).message); }
  };

  return (
    <div className="flex flex-col gap-4">
      {fresh && (
        <div className="rounded-2xl border border-pos/30 bg-pos/10 p-4">
          <p className="text-[14px] font-semibold text-text">Your new API key</p>
          <p className="mt-1 text-[13px] text-text-2">Copy it now. It's only shown once; LEDGR keeps a scrambled copy that can't be turned back into the key.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-bg-2 px-3 py-2 font-mono text-[12.5px] text-text">{fresh}</code>
            <CopyButton text={fresh} />
            <Button size="sm" variant="ghost" onClick={() => setFresh(null)}>Done</Button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="rounded-lg border border-neg/30 bg-neg/10 px-3 py-2 text-[13px] text-neg">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Input aria-label="Key name" placeholder="Name, e.g. NinjaTrader script" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void create(); }} className="min-w-0 flex-1 sm:max-w-xs" />
        <Button variant="accent" icon={<Plus size={14} />} disabled={busy} onClick={create}>{busy ? "Creating…" : "Create key"}</Button>
      </div>

      {keys === null ? <p className="text-[13px] text-muted">Loading your keys…</p> : keys.length === 0 ? (
        <p className="text-[13px] text-muted">No keys yet. You can have up to 5.</p>
      ) : (
        <ul className="divide-y divide-line-soft overflow-hidden rounded-xl border border-line-soft">
          {keys.map((k) => {
            const ended = k.plan_source === "matrixx" && (!k.pro_until || new Date(k.pro_until).getTime() < Date.now());
            return (
              <li key={k.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-card-2 text-text-2"><KeyRound size={15} /></span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[13.5px] font-medium text-text">{k.name}
                    <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold", ended ? "bg-neg/15 text-neg" : "bg-pos/15 text-pos")}>{ended ? "Off: Pro ended" : "Active"}</span>
                  </p>
                  <p className="truncate font-mono text-[12px] text-muted">{k.prefix}… · made {fmtDate(k.created_at)} · {k.last_used_at ? `last used ${fmtDate(k.last_used_at)}` : "never used"}{k.plan_source === "matrixx" && k.pro_until && !ended ? ` · until ${fmtDate(k.pro_until)}` : ""}</p>
                </div>
                <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={() => revoke(k)}>Revoke</Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Docs() {
  const [base, setBase] = useState("https://www.ledgrjournal.app/api/v1");
  useEffect(() => setBase(`${window.location.origin}/api/v1`), []);
  return (
    <div className="flex flex-col gap-5 text-[13.5px] leading-relaxed text-text-2">
      <div>
        <p className="font-medium text-text">Base URL</p>
        <div className="mt-2"><Code>{base}</Code></div>
        <p className="mt-2">Send your key in a header: <code className="font-mono text-[12.5px] text-text">Authorization: Bearer ledgr_sk_…</code> (or <code className="font-mono text-[12.5px] text-text">X-API-Key</code>). Answers are JSON. Up to 120 requests a minute per key.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-line-soft">
        {ENDPOINTS.map((e) => (
          <div key={e.method + e.path} className="grid grid-cols-[56px_110px_minmax(0,1fr)] items-baseline gap-3 border-t border-line-soft px-4 py-2.5 first:border-t-0">
            <span className={cx("font-mono text-[11.5px] font-semibold", e.method === "GET" ? "text-pos" : "text-accent")}>{e.method}</span>
            <span className="font-mono text-[12.5px] text-text">{e.path}</span>
            <span className="text-[12.5px]">{e.what}</span>
          </div>
        ))}
      </div>

      <div>
        <p className="font-medium text-text">Read this month's trades</p>
        <div className="mt-2"><Code>{`curl "${base}/trades?from=2026-11-01&limit=20" \\\n  -H "Authorization: Bearer $LEDGR_KEY"`}</Code></div>
      </div>
      <div>
        <p className="font-medium text-text">Send in a trade</p>
        <div className="mt-2"><Code>{`curl -X POST "${base}/trades" \\\n  -H "Authorization: Bearer $LEDGR_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "symbol": "NQ",\n    "direction": "long",\n    "quantity": 2,\n    "entryPrice": 21050.25,\n    "exitPrice": 21082.5,\n    "entryTime": "2026-11-27T14:31:00Z",\n    "exitTime": "2026-11-27T14:48:00Z",\n    "fees": 4.2,\n    "stopPrice": 21030,\n    "account": "Apex 50K",\n    "setup": "ORB",\n    "tags": ["api"],\n    "externalId": "my-platform-123"\n  }'`}</Code></div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[12.5px]">
          <li><b className="text-text">Required:</b> symbol, direction ("long" or "short"), and either entryPrice + quantity (add exitPrice when closed), an <code className="font-mono">executions</code> list for scaling in and out, or just <code className="font-mono">pnl</code>.</li>
          <li><b className="text-text">Optional:</b> entryTime, exitTime, fees, stopPrice, targetPrice, pointValue (guessed for common futures), account (name or id), market, setup, notes, tags.</li>
          <li><b className="text-text">externalId</b> stops the same trade being added twice. Use your platform's trade or order id.</li>
        </ul>
      </div>
      <div className="rounded-xl border border-line-soft bg-card-2/50 px-4 py-3 text-[12.5px]">
        <p>The API reads the journal saved in your LEDGR account, as of its last sync. Trades you send are added the next time LEDGR is open on any device, then synced.</p>
        <p className="mt-1.5">Keep keys secret, like a password. Never put one in a public repo, a video or a screenshot. If one leaks, revoke it here.</p>
      </div>
    </div>
  );
}

export default function ApiSettingsPage() {
  const plan = usePlan();
  const pro = atLeast(plan, "pro");
  return (
    <div className="flex flex-col gap-6">
      <PageIntro title={<span className="flex items-center gap-2">API <PlusTag level="pro" /></span>} sub="Connect LEDGR to your own scripts, spreadsheets and trading platforms." />
      <SettingsNav />
      <PlanWall level="pro" feature="The LEDGR API" sub="Your own API keys: read your trades, accounts and stats from anywhere, and send trades in automatically from your platform or scripts.">
        <Card className="flex flex-col gap-8">
          <section className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
            <div>
              <h2 className="text-[15px] font-semibold text-text">API keys</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">Each key can read your journal and add trades. Give each script its own key, so you can revoke one without the others.</p>
            </div>
            <div className="min-w-0">{pro ? <Keys /> : <p className="text-[13px] text-muted">API keys come with LEDGR Pro.</p>}</div>
          </section>
          <section className="grid gap-4 border-t border-line-soft pt-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
            <div>
              <h2 className="text-[15px] font-semibold text-text">How to use it</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">Five endpoints, plain JSON. Works with curl, Python, Google Sheets, Zapier or any language.</p>
            </div>
            <div className="min-w-0"><Docs /></div>
          </section>
        </Card>
      </PlanWall>
    </div>
  );
}
