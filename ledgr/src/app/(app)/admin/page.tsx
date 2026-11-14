"use client";
import { RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageIntro } from "@/components/blocks";
import { CountBars } from "@/components/charts";
import { Badge, Button, Card, SectionTitle } from "@/components/ui";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { cx, fmtDate } from "@/lib/util";

interface Stats {
  you: { email: string; role: string };
  owners: { email: string; role: string }[];
  users: {
    total: number; new1d: number; new7d: number; new30d: number; active1d: number; active7d: number; active30d: number;
    google: number; email: number; unconfirmed: number;
    perDay: { day: string; count: number }[];
    recent: { email: string; created_at: string; last_sign_in_at: string | null; provider: string; confirmed: boolean }[];
  };
  journals: { journals: number; trades: number | null; journals_with_trades: number | null; synced_7d: number | null; synced_30d: number | null };
  reviews: { pending: number; recent: { id: string; display_name: string; rating: number; title: string; status: string; created_at: string }[] };
  signups: { kind: string; name: string; email: string; created_at: string }[];
}

type Load = { kind: "loading" } | { kind: "ok"; stats: Stats } | { kind: "error"; code: string; text: string; missing?: string[] };

const n = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toLocaleString("en-US"));
const ago = (iso: string | null) => {
  if (!iso) return "never";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 60 ? `${Math.max(m, 1)} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

export default function OwnerDashboard() {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  const fetchStats = useCallback(async () => {
    setBusy(true);
    const sb = supabase();
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : undefined;
    if (!token) { setLoad({ kind: "error", code: "signed_out", text: "Log in with an owner account to see this page." }); setBusy(false); return; }
    const res = await fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok) setLoad({ kind: "ok", stats: j as Stats });
    else if (j.error === "not_owner") setLoad({ kind: "error", code: "not_owner", text: "This page is only for the LEDGR owners." });
    else if (j.error === "signed_out") setLoad({ kind: "error", code: "signed_out", text: "Log in with an owner account to see this page." });
    else if (j.error === "not_configured") setLoad({ kind: "error", code: "not_configured", text: "The owner dashboard isn't set up on this server yet.", missing: j.missing });
    else setLoad({ kind: "error", code: "error", text: j.error ?? "Couldn't load the numbers. Try again." });
    setBusy(false);
  }, []);

  useEffect(() => { void fetchStats(); }, [fetchStats]);

  if (load.kind === "loading") return <p className="py-20 text-center text-sm text-muted">Loading the owner dashboard…</p>;
  if (load.kind === "error") {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <ShieldCheck size={28} className="mx-auto text-muted" />
        <h1 className="mt-4 text-xl font-semibold text-text">Owner dashboard</h1>
        <p className="mt-2 text-sm text-text-2">{load.text}</p>
        {load.code === "not_configured" && <p className="mt-3 text-[13px] text-muted">Missing on the server: {load.missing?.join(", ")}.</p>}
        {load.code === "signed_out" && (supabaseConfigured ? <Link href="/login" className="mt-5 inline-block text-sm font-medium text-text underline underline-offset-4">Log in</Link> : null)}
      </div>
    );
  }

  const { stats: s } = load;
  const u = s.users;
  const pct = (a: number) => (u.total ? `${Math.round((a / u.total) * 100)}%` : "—");
  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        title="Owner dashboard"
        sub={<>Signed in as {s.you.email} · <Badge tone="accent">{s.you.role}</Badge></>}
        actions={<Button size="sm" icon={<RefreshCw size={14} className={cx(busy && "animate-spin")} />} onClick={() => void fetchStats()} disabled={busy}>Refresh</Button>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile label="Total users" value={n(u.total)} hint={`+${n(u.new30d)} in 30 days`} big />
        <Tile label="New today" value={n(u.new1d)} hint={`${n(u.new7d)} this week`} />
        <Tile label="Active this week" value={n(u.active7d)} hint={`${n(u.active1d)} today · ${n(u.active30d)} in 30 days`} />
        <Tile label="Synced journals" value={n(s.journals.journals)} hint={s.journals.synced_7d === null ? "Accounts with a cloud journal" : `${n(s.journals.synced_7d)} updated this week`} />
        <Tile label="Trades logged" value={n(s.journals.trades)} hint={s.journals.trades === null ? "Run migration 0003 to see this" : `${n(s.journals.journals_with_trades)} journals with trades`} />
        <Tile label="Google sign-ups" value={n(u.google)} hint={pct(u.google)} />
        <Tile label="Email sign-ups" value={n(u.email)} hint={pct(u.email)} />
        <Tile label="Unconfirmed emails" value={n(u.unconfirmed)} hint="Signed up, didn't click the link" />
      </div>

      <Card>
        <SectionTitle title="Sign-ups per day" sub="Last 30 days" />
        <CountBars data={u.perDay.map((d) => ({ label: d.day.slice(5), value: d.count }))} xLabel="Day" height={220} />
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card pad={false}>
          <div className="px-6 pt-5"><SectionTitle title="Newest users" sub="The 15 most recent accounts" /></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead><tr className="border-y border-line-soft text-left text-xs text-muted"><th className="px-6 py-2.5 font-medium">Email</th><th className="py-2.5 font-medium">Joined</th><th className="py-2.5 font-medium">Last seen</th><th className="px-6 py-2.5 text-right font-medium">Via</th></tr></thead>
              <tbody>
                {u.recent.map((r) => (
                  <tr key={r.email + r.created_at} className="border-b border-line-soft last:border-0">
                    <td className="max-w-[240px] truncate px-6 py-2.5 text-text">{r.email || "—"}{!r.confirmed && <span className="ml-2 text-[11px] text-muted">unconfirmed</span>}</td>
                    <td className="py-2.5 text-text-2">{fmtDate(r.created_at)}</td>
                    <td className="py-2.5 text-text-2">{ago(r.last_sign_in_at)}</td>
                    <td className="px-6 py-2.5 text-right capitalize text-text-2">{r.provider || "—"}</td>
                  </tr>
                ))}
                {!u.recent.length && <tr><td colSpan={4} className="px-6 py-8 text-center text-muted">No accounts yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <SectionTitle title="Reviews" sub={`${n(s.reviews.pending)} waiting for approval`} />
            {s.reviews.recent.length ? (
              <ul className="flex flex-col gap-3">
                {s.reviews.recent.slice(0, 6).map((r) => (
                  <li key={r.id} className="text-[13px]">
                    <div className="flex items-center gap-2"><span className="font-medium text-text">{r.display_name}</span><span className="text-muted">{"★".repeat(r.rating)}</span><Badge tone={r.status === "approved" ? "pos" : r.status === "rejected" ? "neg" : "muted"}>{r.status}</Badge></div>
                    {r.title && <p className="text-text-2">{r.title}</p>}
                  </li>
                ))}
              </ul>
            ) : <p className="text-[13px] text-muted">No reviews yet.</p>}
            <p className="mt-4 text-[11.5px] text-muted">Approve reviews in Supabase: Table Editor → reviews → set status to approved.</p>
          </Card>
          <Card>
            <SectionTitle title="Website sign-ups" sub="Community and affiliate forms" />
            {s.signups.length ? (
              <ul className="flex max-h-[280px] flex-col gap-2 overflow-y-auto pr-1 scroll-thin">
                {s.signups.map((x) => (
                  <li key={x.kind + x.email} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="min-w-0 truncate"><span className="text-text">{x.name}</span> <span className="text-muted">{x.email}</span></span>
                    <Badge tone="muted">{x.kind}</Badge>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[13px] text-muted">No sign-ups yet.</p>}
          </Card>
          <Card>
            <SectionTitle title="Who can see this page" />
            <ul className="flex flex-col gap-1.5 text-[13px]">{s.owners.map((o) => <li key={o.email} className="flex justify-between gap-3"><span className="truncate text-text-2">{o.email}</span><span className="text-muted">{o.role}</span></li>)}</ul>
            <p className="mt-3 text-[11.5px] text-muted">Change it with LEDGR_OWNER_EMAILS in Vercel (owner first, then co-owners).</p>
          </Card>
        </div>
      </div>
      <p className="text-center text-[11.5px] text-muted">People who use LEDGR without an account aren&apos;t counted: their journal stays in their browser.</p>
    </div>
  );
}

function Tile({ label, value, hint, big }: { label: string; value: string; hint?: string; big?: boolean }) {
  return (
    <Card className={cx(big && "border-text-2/30")}>
      <p className="text-[12.5px] text-muted">{label}</p>
      <p className="num mt-2 text-[30px] font-semibold leading-none text-text">{value}</p>
      {hint && <p className="mt-2 text-[12px] text-text-2">{hint}</p>}
    </Card>
  );
}
