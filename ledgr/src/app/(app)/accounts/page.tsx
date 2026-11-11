"use client";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AccountEditor } from "@/components/AccountEditor";
import { PageIntro } from "@/components/blocks";
import { MultiLine, Sparkline } from "@/components/charts";
import { Badge, Button, Card, EmptyState, IconButton, NotEnoughData, Progress, SectionTitle, Segmented, useFeedback } from "@/components/ui";
import { PageVerse } from "@/components/VerseCard";
import { deleteAccount, newAccount, setAccountStatus, ValidationError } from "@/lib/actions";
import { accountSummary } from "@/lib/accounts";
import { useEnriched } from "@/lib/hooks";
import { useLedgr } from "@/lib/store";
import type { Account } from "@/lib/types";
import { cx, fmtMoney, fmtNum } from "@/lib/util";

export default function AccountsPage() {
  const accounts = useLedgr((s) => s.accounts);
  const adjustments = useLedgr((s) => s.adjustments);
  const all = useEnriched();
  const [editing, setEditing] = useState<Account | null>(null);
  const [view, setView] = useState<"active" | "archived">("active");
  const summaries = useMemo(() => accounts.map((a) => ({ a, s: accountSummary(a, all, adjustments) })), [accounts, all, adjustments]);
  const shown = summaries.filter((x) => (view === "archived" ? x.a.status === "archived" : x.a.status !== "archived"));
  const evals = summaries.filter((x) => x.a.status !== "archived" && x.a.type === "Hypothetical evaluation");

  const compare = useMemo(() => {
    const act = summaries.filter((x) => x.a.status !== "archived" && x.s.closedCount > 0 && x.a.startingBalance > 0).slice(0, 5);
    const dates = [...new Set(act.flatMap((x) => x.s.ledger.filter((e) => e.kind !== "start").map((e) => e.date)))].sort();
    const last: Record<string, number> = {};
    const rows = dates.map((d) => {
      const row: Record<string, number | string | null> = { label: d.slice(5) };
      for (const x of act) {
        const evs = x.s.ledger.filter((e) => e.kind === "trade" && e.date <= d);
        const net = evs.reduce((s, e) => s + e.amount, 0);
        last[x.a.id] = (net / x.a.startingBalance) * 100;
        row[x.a.id] = last[x.a.id];
      }
      return row;
    });
    return { act, rows };
  }, [summaries]);

  return (
    <div className="flex flex-col gap-6">
      <PageIntro title="Account desk" sub="Separate virtual accounts keep your records organised. Balances are calculated from your journal — nothing here is connected to a broker." actions={<Button variant="accent" icon={<Plus size={15} />} onClick={() => setEditing(newAccount())}>New account</Button>} />
      <PageVerse page="accounts" compact />

      {accounts.length === 0 ? (
        <EmptyState icon={<Wallet size={18} />} title="No accounts yet" body="Create a simulated account to start logging trades against it." action={<Button variant="accent" onClick={() => setEditing(newAccount())}>Create account</Button>} />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <Segmented ariaLabel="Account status" value={view} onChange={setView} options={[{ value: "active", label: `Active (${summaries.filter((x) => x.a.status !== "archived").length})` }, { value: "archived", label: `Archived (${summaries.filter((x) => x.a.status === "archived").length})` }]} />
            <Link href="/account-history" className="text-[13px] text-text-2 hover:text-text">Account history</Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shown.map(({ a, s }) => <AccountCard key={a.id} a={a} s={s} onEdit={() => setEditing(a)} />)}
            {shown.length === 0 && <p className="text-[13px] text-muted">No {view} accounts.</p>}
          </div>

          <Card>
            <SectionTitle title="Compare accounts" sub="Return on virtual starting balance from closed trades (%). Adjustments excluded." />
            {compare.act.length >= 1 && compare.rows.length >= 2 ? <MultiLine data={compare.rows} keys={compare.act.map((x) => x.a.id)} labels={Object.fromEntries(compare.act.map((x) => [x.a.id, x.a.name]))} currency="" /> : <NotEnoughData note="Log closed trades in at least one account." />}
          </Card>

          {evals.length > 0 && (
            <Card>
              <SectionTitle title="Evaluation practice tracker" sub="Educational progress against the rules you set. Simulated records do not represent a verified or funded status." />
              <div className="grid gap-6 lg:grid-cols-2">
                {evals.map(({ a, s }) => {
                  const r = a.rules;
                  const items = [
                    r.profitTarget ? { label: "Profit target", value: `${fmtMoney(s.tradeNet, a.currency)} of ${fmtMoney(r.profitTarget, a.currency)}`, pct: Math.max(0, (s.tradeNet / r.profitTarget) * 100), ok: s.tradeNet >= r.profitTarget, tone: "pos" as const } : null,
                    r.maxDrawdown ? { label: "Drawdown used (from peak)", value: `${fmtMoney(Math.abs(s.maxDD), a.currency)} of ${fmtMoney(r.maxDrawdown, a.currency)}`, pct: (Math.abs(s.maxDD) / r.maxDrawdown) * 100, ok: Math.abs(s.maxDD) < r.maxDrawdown, tone: "neg" as const } : null,
                    r.dailyLossLimit ? { label: "Worst day vs daily limit", value: `${fmtMoney(Math.min(0, s.worstDay ?? 0), a.currency)} of −${fmtMoney(r.dailyLossLimit, a.currency)}`, pct: (Math.abs(Math.min(0, s.worstDay ?? 0)) / r.dailyLossLimit) * 100, ok: Math.abs(Math.min(0, s.worstDay ?? 0)) < r.dailyLossLimit, tone: "neg" as const } : null,
                    r.minTradingDays ? { label: "Trading days", value: `${s.tradingDays} of ${r.minTradingDays}`, pct: (s.tradingDays / r.minTradingDays) * 100, ok: s.tradingDays >= r.minTradingDays, tone: "pos" as const } : null,
                  ].filter(Boolean) as { label: string; value: string; pct: number; ok: boolean; tone: "pos" | "neg" }[];
                  return (
                    <div key={a.id} className="rounded-xl border border-line-soft p-4">
                      <p className="mb-4 text-[14px] font-medium">{a.name}</p>
                      {items.length ? (
                        <ul className="flex flex-col gap-4">
                          {items.map((it) => (
                            <li key={it.label}>
                              <div className="mb-1.5 flex justify-between gap-3 text-[13px]"><span className="text-text-2">{it.label}</span><span className="num text-text">{it.value}</span></div>
                              <Progress value={it.pct} tone={it.tone === "neg" ? (it.pct >= 80 ? "neg" : "accent") : it.ok ? "pos" : "accent"} />
                              {it.tone === "neg" && !it.ok && <p className="mt-1 text-xs text-neg">Practice limit exceeded in your records.</p>}
                            </li>
                          ))}
                        </ul>
                      ) : <p className="text-[13px] text-muted">No practice rules set. Edit the account to add them.</p>}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
      {editing && <AccountEditor initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function AccountCard({ a, s, onEdit }: { a: Account; s: ReturnType<typeof accountSummary>; onEdit: () => void }) {
  const [menu, setMenu] = useState(false);
  const { confirm, toast } = useFeedback();
  const tone = s.tradeNet > 0 ? "pos" : s.tradeNet < 0 ? "neg" : "";
  return (
    <Card className="relative flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: a.color }} />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{a.name}</p>
            <p className="text-xs text-muted">{a.type} · {a.currency}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {a.status !== "active" && <Badge tone="muted">{a.status === "paused" ? "Paused" : "Archived"}</Badge>}
          <div className="relative">
            <IconButton label="Account actions" onClick={() => setMenu((m) => !m)} aria-expanded={menu}><MoreHorizontal size={16} /></IconButton>
            {menu && (
              <div className="animate-modal absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-xl border border-line bg-card-2 py-1 shadow-2xl" onMouseLeave={() => setMenu(false)}>
                <MenuItem icon={<Pencil size={14} />} onClick={() => { setMenu(false); onEdit(); }}>Edit</MenuItem>
                {a.status === "archived"
                  ? <MenuItem icon={<ArchiveRestore size={14} />} onClick={() => { setMenu(false); setAccountStatus(a.id, "active"); toast("Account restored"); }}>Restore</MenuItem>
                  : <MenuItem icon={<Archive size={14} />} onClick={() => { setMenu(false); setAccountStatus(a.id, "archived"); toast("Account archived"); }}>Archive</MenuItem>}
                <MenuItem icon={<Trash2 size={14} />} danger onClick={async () => {
                  setMenu(false);
                  if (await confirm({ title: `Delete ${a.name}?`, body: "Only accounts without trades can be deleted.", confirm: "Delete account", danger: true })) {
                    try { deleteAccount(a.id); toast("Account deleted"); } catch (e) { toast(e instanceof ValidationError ? e.message : "Could not delete", "error"); }
                  }
                }}>Delete</MenuItem>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-5">
        <p className="text-xs text-muted">Calculated balance</p>
        <p className="num mt-1 text-[26px] leading-none">{fmtMoney(s.balance, a.currency)}</p>
        <p className="mt-1.5 text-xs text-muted"><span className={cx("num", tone)}>{fmtMoney(s.tradeNet, a.currency, { sign: true })}</span>{s.returnPct !== null && <span className={cx("num ml-1", tone)}>({s.returnPct >= 0 ? "+" : "−"}{fmtNum(Math.abs(s.returnPct), 2)}%)</span>} from trades · started at {fmtMoney(a.startingBalance, a.currency)}</p>
      </div>
      <div className="mt-3">{s.ledger.length > 2 ? <Sparkline data={s.ledger.map((e) => e.balance)} tone={s.tradeNet >= 0 ? "pos" : "neg"} /> : <div className="h-9" />}</div>
      <div className="mt-3 grid grid-cols-3 gap-3 border-t border-line-soft pt-3 text-xs">
        <div><p className="text-muted">Trades</p><p className="num mt-0.5 text-[13px]">{s.closedCount}</p></div>
        <div><p className="text-muted">Max DD</p><p className="num mt-0.5 text-[13px]">{fmtMoney(s.maxDD, a.currency, { compact: true })}</p></div>
        <div><p className="text-muted">Adjustments</p><p className="num mt-0.5 text-[13px]">{fmtMoney(s.adjustments, a.currency, { compact: true })}</p></div>
      </div>
      {a.goals && <p className="mt-3 line-clamp-2 text-xs text-text-2">{a.goals}</p>}
      <div className="mt-4 flex gap-2">
        <Link href={`/journal?account=${a.id}`} className="flex-1 rounded-[10px] border border-line py-1.5 text-center text-[13px] text-text-2 hover:text-text">Trades</Link>
        <Link href={`/account-history?account=${a.id}`} className="flex-1 rounded-[10px] border border-line py-1.5 text-center text-[13px] text-text-2 hover:text-text">History</Link>
      </div>
    </Card>
  );
}

function MenuItem({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return <button type="button" onClick={onClick} className={cx("flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-card", danger ? "text-neg" : "text-text-2 hover:text-text")}>{icon}{children}</button>;
}
