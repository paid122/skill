"use client";
import { Download, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { PageIntro, Stat } from "@/components/blocks";
import { EquityChart } from "@/components/charts";
import { Button, Card, EmptyState, Field, IconButton, Input, Modal, NotEnoughData, NumberInput, SectionTitle, Select, useFeedback } from "@/components/ui";
import { PageVerse } from "@/components/VerseCard";
import { deleteAdjustment, saveAdjustment, ValidationError } from "@/lib/actions";
import { accountSummary } from "@/lib/accounts";
import { useEnriched } from "@/lib/hooks";
import { useLedgr } from "@/lib/store";
import { cx, download, fmtDate, fmtMoney, toCSV, today, uid } from "@/lib/util";

export default function AccountHistoryPage() {
  return <Suspense><History /></Suspense>;
}

function History() {
  const params = useSearchParams();
  const router = useRouter();
  const accounts = useLedgr((s) => s.accounts);
  const adjustments = useLedgr((s) => s.adjustments);
  const all = useEnriched();
  const id = params.get("account") ?? accounts.find((a) => a.status !== "archived")?.id ?? accounts[0]?.id;
  const account = accounts.find((a) => a.id === id) ?? null;
  const s = useMemo(() => (account ? accountSummary(account, all, adjustments) : null), [account, all, adjustments]);
  const [adding, setAdding] = useState(false);
  const [adj, setAdj] = useState({ amount: null as number | null, date: today(), note: "" });
  const [error, setError] = useState<string | null>(null);
  const { confirm, toast } = useFeedback();

  if (!accounts.length) return <EmptyState title="No accounts yet" action={<Link href="/accounts" className="text-accent">Create an account</Link>} />;
  if (!account || !s) return null;
  const rows = [...s.ledger].reverse();

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        title="Account history"
        sub="A running ledger of every closed trade and virtual adjustment."
        actions={<>
          <Select aria-label="Account" value={account.id} onChange={(e) => router.replace(`/account-history?account=${e.target.value}`)} className="w-56">
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.status === "archived" ? " (archived)" : ""}</option>)}
          </Select>
          <Button icon={<Download size={14} />} onClick={() => download(`ledgr-${account.name.replace(/\W+/g, "-").toLowerCase()}-history.csv`, toCSV([["Date", "Type", "Description", "Amount", "Balance"], ...s.ledger.map((e) => [e.date, e.kind, e.label, e.amount.toFixed(2), e.balance.toFixed(2)])]), "text/csv")}>Export CSV</Button>
          <Button variant="accent" icon={<Plus size={15} />} onClick={() => { setError(null); setAdj({ amount: null, date: today(), note: "" }); setAdding(true); }}>Adjustment</Button>
        </>}
      />
      <PageVerse page="history" compact />

      <Card className="grid grid-cols-2 gap-5 sm:grid-cols-5">
        <Stat label="Calculated balance" value={fmtMoney(s.balance, account.currency)} />
        <Stat label="Starting balance" value={fmtMoney(account.startingBalance, account.currency)} />
        <Stat label="From trades" value={fmtMoney(s.tradeNet, account.currency, { sign: true })} tone={s.tradeNet} />
        <Stat label="Adjustments" value={fmtMoney(s.adjustments, account.currency, { sign: true })} />
        <Stat label="Peak balance" value={fmtMoney(s.peak, account.currency)} hint={`Now ${fmtMoney(s.currentDD, account.currency)} from peak`} />
      </Card>

      <Card>
        <SectionTitle title="Balance" />
        {s.ledger.length > 2 ? <EquityChart data={s.ledger.map((e, i) => ({ label: `${i}`, date: e.date, value: e.balance, net: e.kind === "start" ? undefined : e.amount }))} currency={account.currency} baseline={account.startingBalance} series="Balance" height={260} /> : <NotEnoughData />}
      </Card>

      <Card pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="text-left text-xs text-muted"><tr className="border-b border-line-soft"><th className="px-4 py-2.5 font-medium">Date</th><th className="px-3 py-2.5 font-medium">Activity</th><th className="px-3 py-2.5 text-right font-medium">Amount</th><th className="px-3 py-2.5 text-right font-medium">Balance</th><th className="w-12" /></tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-line-soft last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 text-text-2">{fmtDate(e.date)}</td>
                  <td className="px-3 py-2.5">{e.kind === "trade" ? <Link href={`/journal/${e.refId}`} className="hover:text-accent">{e.label}</Link> : <span className={e.kind === "start" ? "text-muted" : "text-text-2"}>{e.label}</span>}</td>
                  <td className={cx("num px-3 py-2.5 text-right", e.kind === "start" ? "text-muted" : e.amount > 0 ? "pos" : e.amount < 0 ? "neg" : "")}>{e.kind === "start" ? fmtMoney(e.amount, account.currency) : fmtMoney(e.amount, account.currency, { sign: true })}</td>
                  <td className="num px-3 py-2.5 text-right">{fmtMoney(e.balance, account.currency)}</td>
                  <td className="pr-2 text-right">{e.kind === "adjustment" && <IconButton label="Delete adjustment" onClick={async () => { if (await confirm({ title: "Delete this adjustment?", confirm: "Delete", danger: true })) { deleteAdjustment(e.id); toast("Adjustment deleted"); } }}><Trash2 size={14} /></IconButton>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Virtual balance adjustment" description="Record a simulated deposit (positive) or withdrawal (negative). No money moves." size="sm"
        footer={<><Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button><Button variant="accent" onClick={() => { try { saveAdjustment({ id: uid("adj"), accountId: account.id, amount: adj.amount ?? 0, date: adj.date, note: adj.note.trim().slice(0, 80) }); setAdding(false); toast("Adjustment recorded"); } catch (e) { setError(e instanceof ValidationError ? e.message : "Could not save."); } }}>Record adjustment</Button></>}>
        <div className="grid gap-4">
          <Field label={`Amount (${account.currency})`}><NumberInput value={adj.amount} onChange={(n) => setAdj({ ...adj, amount: n })} placeholder="e.g. 5000 or -1000" /></Field>
          <Field label="Date"><Input type="date" value={adj.date} onChange={(e) => setAdj({ ...adj, date: e.target.value })} /></Field>
          <Field label="Note"><Input value={adj.note} maxLength={80} onChange={(e) => setAdj({ ...adj, note: e.target.value })} placeholder="Reset after evaluation practice" /></Field>
          {error && <p className="text-[13px] text-neg">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}
