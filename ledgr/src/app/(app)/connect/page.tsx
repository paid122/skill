"use client";
import { Check, Link2, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { PageIntro } from "@/components/blocks";
import { PlanWall } from "@/components/PlusGate";
import { Button, Card, Input } from "@/components/ui";
import { getMatrixxKey } from "@/lib/matrixxClient";
import { supabase, useSession } from "@/lib/supabase";

/** "Connect with LEDGR": approve an app (e.g. the Obsidian plugin) that showed you a code. */
async function call(method: "GET" | "POST", query: string, body?: unknown) {
  const token = (await supabase()?.auth.getSession())?.data.session?.access_token;
  const res = await fetch(`/api/keys/device${query}`, {
    method, cache: "no-store",
    headers: { Authorization: `Bearer ${token ?? ""}`, "x-matrixx-key": getMatrixxKey(), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? `Something went wrong (${res.status}).`);
  return j;
}

function Connect() {
  const session = useSession();
  const params = useSearchParams();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [app, setApp] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "checking" | "ready" | "approved" | "denied">("idle");
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async (c: string) => {
    setError(null); setState("checking");
    try { const r = await call("GET", `?code=${encodeURIComponent(c)}`); setApp(r.client); setCode(r.code); setState("ready"); }
    catch (e) { setError((e as Error).message); setState("idle"); }
  }, []);

  useEffect(() => { if (session && params.get("code")) void check(params.get("code")!); }, [session, params, check]);

  const decide = async (action: "approve" | "deny") => {
    setError(null);
    try { await call("POST", "", { code, action }); setState(action === "approve" ? "approved" : "denied"); }
    catch (e) { setError((e as Error).message); }
  };

  if (session === undefined) return null;
  if (!session) {
    return (
      <Card className="max-w-lg">
        <p className="text-[14px] text-text-2">Sign in to your LEDGR account to connect an app.</p>
        <Link href="/settings" className="mt-4 inline-block rounded-xl bg-accent px-4 py-2 text-[14px] font-semibold text-on-accent">Sign in</Link>
      </Card>
    );
  }

  if (state === "approved" || state === "denied") {
    const ok = state === "approved";
    return (
      <Card className="max-w-lg text-center">
        <span className={`mx-auto grid h-12 w-12 place-items-center rounded-2xl ${ok ? "bg-pos/15 text-pos" : "bg-card-2 text-text-2"}`}>{ok ? <Check size={22} /> : <X size={22} />}</span>
        <p className="mt-4 text-[17px] font-semibold text-text">{ok ? `${app ?? "The app"} is connected` : "Connection declined"}</p>
        <p className="mt-1.5 text-[14px] text-text-2">{ok ? "You can close this tab and go back to the app. It finishes connecting by itself." : "Nothing was shared."}</p>
        {ok && <p className="mt-4 text-[12.5px] text-muted">It shows in <Link href="/settings/api" className="underline">Settings → API</Link>, where you can disconnect it any time.</p>}
      </Card>
    );
  }

  return (
    <Card className="max-w-lg">
      {state === "ready" && app ? (
        <>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-card-2 text-text"><Link2 size={19} /></span>
            <div>
              <p className="text-[16px] font-semibold text-text">{app} wants to connect</p>
              <p className="font-mono text-[13px] text-muted">Code {code}</p>
            </div>
          </div>
          <div className="mt-5 rounded-xl border border-line-soft bg-card-2/50 p-4 text-[13.5px] leading-relaxed text-text-2">
            <p className="flex items-center gap-2 font-medium text-text"><ShieldCheck size={15} /> It will be able to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>read your trades, accounts and stats</li>
              <li>add trades to your journal</li>
            </ul>
            <p className="mt-3 text-[12.5px] text-muted">It can't change or delete trades, see your password, or make payments.</p>
          </div>
          <p className="mt-4 text-[12.5px] text-muted">Only approve if you just started this in {app} and the code matches what it shows.</p>
          <div className="mt-4 flex gap-2">
            <Button variant="accent" onClick={() => decide("approve")}>Approve</Button>
            <Button variant="ghost" onClick={() => decide("deny")}>Deny</Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[14px] text-text-2">Type the code the app shows you.</p>
          <div className="mt-3 flex gap-2">
            <Input aria-label="Code" placeholder="K7QX-3MRT" value={code} maxLength={9} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") void check(code); }} className="font-mono uppercase tracking-widest sm:max-w-[200px]" />
            <Button variant="accent" disabled={state === "checking"} onClick={() => check(code)}>{state === "checking" ? "Checking…" : "Continue"}</Button>
          </div>
        </>
      )}
      {error && <p role="alert" className="mt-4 rounded-lg border border-neg/30 bg-neg/10 px-3 py-2 text-[13px] text-neg">{error}</p>}
    </Card>
  );
}

export default function ConnectPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageIntro title="Connect an app" sub="Let an app such as LEDGR for Obsidian use your journal, without copying an API key." />
      <PlanWall level="pro" feature="Connect apps" sub="Connecting apps such as LEDGR for Obsidian comes with LEDGR Pro.">
        <Suspense><Connect /></Suspense>
      </PlanWall>
    </div>
  );
}
