"use client";
import { ArrowDown, ArrowUp, Bookmark, ChevronLeft, ChevronRight, Download, Filter, LayoutGrid, List, NotebookPen, Plus, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { PageIntro, ResultBadge } from "@/components/blocks";
import { Badge, Button, Card, EmptyState, Field, IconButton, Input, Modal, Segmented, Select, useFeedback } from "@/components/ui";
import { PageVerse } from "@/components/VerseCard";
import { deleteFilter, saveFilter } from "@/lib/actions";
import { computeStats, type EnrichedTrade } from "@/lib/calc";
import { useEnriched } from "@/lib/hooks";
import { openEditor, openImport, openQuickLog } from "@/lib/overlays";
import { useLedgr } from "@/lib/store";
import { EMOTIONS, MARKETS, SESSIONS, type TradeFilter } from "@/lib/types";
import { cx, download, fmtDate, fmtMoney, fmtNum, fmtPct, fmtR, gradeLabel, inRange, toCSV, today, uid } from "@/lib/util";

const EMPTY: TradeFilter = { q: "", accountId: "all", market: "all", direction: "all", result: "all", setup: "all", session: "all", emotion: "all", from: "", to: "" };
type SortKey = "number" | "symbol" | "market" | "direction" | "setup" | "date" | "session" | "net" | "r" | "grade" | "account";
const PAGE = 25;

export default function JournalPage() {
  return <Suspense><Journal /></Suspense>;
}

function Journal() {
  const params = useSearchParams();
  const router = useRouter();
  const all = useEnriched();
  const accounts = useLedgr((s) => s.accounts);
  const setups = useLedgr((s) => s.settings.setups);
  const saved = useLedgr((s) => s.savedFilters);
  const { toast, confirm } = useFeedback();
  const [f, setF] = useState<TradeFilter>(() => ({ ...EMPTY, result: (params.get("result") as TradeFilter["result"]) ?? "all", from: params.get("from") ?? "", to: params.get("to") ?? "", accountId: params.get("account") ?? "all", setup: params.get("setup") ?? "all" }));
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: -1 });
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [view, setViewState] = useState<"table" | "cards">(() => { try { return (localStorage.getItem("ledgr.journalView") as "table" | "cards") || "table"; } catch { return "table"; } });
  const setView = (v: "table" | "cards") => { setViewState(v); try { localStorage.setItem("ledgr.journalView", v); } catch { /* ignore */ } };
  const [saving, setSaving] = useState(false);
  const [filterName, setFilterName] = useState("");
  const acctName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const currencyOf = (id: string | null) => accounts.find((a) => a.id === id)?.currency ?? "USD";

  useEffect(() => setPage(0), [f, sort]);

  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return all.filter((x) => {
      const t = x.trade;
      if (q && ![t.symbol, t.setup, t.entryNotes, t.exitNotes, t.reflection.learned, `#${t.number}`, ...t.tags, ...t.confluences].some((s) => s.toLowerCase().includes(q))) return false;
      if (f.accountId !== "all" && t.accountId !== f.accountId) return false;
      if (f.market !== "all" && t.market !== f.market) return false;
      if (f.direction !== "all" && t.direction !== f.direction) return false;
      if (f.setup !== "all" && t.setup !== f.setup) return false;
      if (f.session !== "all" && t.session !== f.session) return false;
      if (f.emotion !== "all" && !t.emotions.includes(f.emotion)) return false;
      if (f.result === "draft" ? x.m.status !== "draft" : f.result !== "all" && x.m.result !== f.result) return false;
      return inRange(t.date, f.from, f.to);
    });
  }, [all, f]);

  const sorted = useMemo(() => {
    const val = (x: EnrichedTrade): string | number => {
      switch (sort.key) {
        case "net": return x.m.net ?? -Infinity;
        case "r": return x.m.r ?? -Infinity;
        case "grade": return x.trade.grade ? ["F", "D", "C", "B", "A", "A+"].indexOf(x.trade.grade) : -1;
        case "account": return acctName.get(x.trade.accountId ?? "") ?? "";
        case "date": return x.trade.date + (x.m.firstTime ?? "") + String(x.trade.number).padStart(6, "0");
        case "number": return x.trade.number;
        default: return (x.trade[sort.key] as string | null) ?? "";
      }
    };
    return [...filtered].sort((a, b) => { const va = val(a), vb = val(b); return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir; });
  }, [filtered, sort, acctName]);

  const stats = useMemo(() => computeStats(filtered), [filtered]);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const rows = sorted.slice(page * PAGE, page * PAGE + PAGE);
  const activeCount = (Object.keys(EMPTY) as (keyof TradeFilter)[]).filter((k) => k !== "q" && f[k] !== EMPTY[k]).length;
  const singleCurrency = new Set(filtered.map((x) => currencyOf(x.trade.accountId))).size <= 1;
  const cur = filtered[0] ? currencyOf(filtered[0].trade.accountId) : "USD";

  const exportCSV = () => {
    const header = ["Trade #", "Date", "Symbol", "Market", "Direction", "Account", "Setup", "Session", "Status", "Result", "Net", "Fees", "R", "Grade", "Emotions", "Mistakes", "Followed plan", "Lesson"];
    const body = sorted.map((x) => [x.trade.number, x.trade.date, x.trade.symbol, x.trade.market, x.trade.direction, acctName.get(x.trade.accountId ?? "") ?? "", x.trade.setup, x.trade.session, x.m.status, x.m.result, x.m.net === null ? null : x.m.net.toFixed(2), x.m.totalFees.toFixed(2), x.m.r === null ? null : x.m.r.toFixed(3), x.trade.grade, x.trade.emotions.join("; "), x.trade.mistakes.join("; "), x.trade.reflection.followedPlan, x.trade.reflection.learned]);
    download(`ledgr-trades-${today()}.csv`, toCSV([header, ...body]), "text/csv");
    toast(`Exported ${sorted.length} trades`);
  };

  const th = (key: SortKey, label: string, className?: string) => (
    <th className={cx("px-3 py-2.5 font-medium", className)} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-text" onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : key === "date" || key === "net" || key === "r" ? -1 : 1 }))}>
        {label}
        {sort.key === key && (sort.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </button>
    </th>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        title="Trade journal"
        sub="Every record, searchable and honest. Drafts and open positions are kept separate from your statistics."
        actions={<>
          <Button icon={<Download size={14} />} onClick={exportCSV} disabled={!sorted.length}>Export CSV</Button>
          <Button icon={<Upload size={14} />} onClick={openImport}>Import CSV</Button>
          <Button variant="accent" icon={<Plus size={15} />} onClick={() => openEditor(null)}>New trade</Button>
        </>}
      />
      <PageVerse page="journal" compact />

      <section className="card grid grid-cols-2 gap-px overflow-hidden bg-line-soft sm:grid-cols-4 xl:grid-cols-7" aria-label="Journal overview">
        {[
          ["Total records", fmtNum(stats.total, 0)],
          ["Winning", fmtNum(stats.wins, 0)],
          ["Losing", fmtNum(stats.losses, 0)],
          ["Break-even", fmtNum(stats.breakeven, 0)],
          ["Simulated P&L", singleCurrency ? fmtMoney(stats.net, cur, { sign: true }) : "Mixed currencies"],
          ["Average R", fmtR(stats.avgR)],
          ["Average grade", stats.avgGrade === null ? "—" : gradeLabel(stats.avgGrade)],
        ].map(([l, v], i) => (
          <div key={l} className="bg-card px-4 py-3.5">
            <p className="text-xs text-muted">{l}</p>
            <p className={cx("num mt-1 text-[17px]", i === 1 && "pos", i === 2 && "neg", i === 4 && singleCurrency && (stats.net > 0 ? "pos" : stats.net < 0 ? "neg" : ""))}>{v}</p>
          </div>
        ))}
      </section>

      <Card pad={false}>
        <div className="flex flex-col gap-3 border-b border-line-soft p-4 lg:flex-row lg:items-center">
          <Input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Search symbol, setup, notes, tags or #number" className="lg:max-w-sm" aria-label="Search trades" />
          <Select value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value })} className="lg:w-48" aria-label="Account">
            <option value="all">All accounts</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <div className="flex items-center gap-2">
            <Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} aria-label="From date" className="w-[150px]" />
            <span className="text-muted">–</span>
            <Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} aria-label="To date" className="w-[150px]" />
          </div>
          <div className="flex items-center gap-2 lg:ml-auto">
            <Segmented size="sm" ariaLabel="Journal view" value={view} onChange={setView} options={[{ value: "table", label: <List size={14} aria-label="Table" /> }, { value: "cards", label: <LayoutGrid size={14} aria-label="Cards" /> }]} />
            <Button size="sm" icon={<Filter size={14} />} onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>Filters{activeCount ? ` · ${activeCount}` : ""}</Button>
            <Button size="sm" icon={<Bookmark size={14} />} onClick={() => { setFilterName(""); setSaving(true); }}>Save view</Button>
            {(activeCount > 0 || f.q) && <Button size="sm" variant="ghost" onClick={() => setF(EMPTY)}>Reset</Button>}
          </div>
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 gap-3 border-b border-line-soft bg-bg-2/40 p-4 md:grid-cols-3 xl:grid-cols-6">
            <Field label="Result"><Select value={f.result} onChange={(e) => setF({ ...f, result: e.target.value as TradeFilter["result"] })}><option value="all">All</option><option value="win">Winning</option><option value="loss">Losing</option><option value="breakeven">Break-even</option><option value="draft">Drafts</option></Select></Field>
            <Field label="Market"><Select value={f.market} onChange={(e) => setF({ ...f, market: e.target.value as TradeFilter["market"] })}><option value="all">All</option>{MARKETS.map((m) => <option key={m}>{m}</option>)}</Select></Field>
            <Field label="Direction"><Select value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value as TradeFilter["direction"] })}><option value="all">All</option><option value="long">Long</option><option value="short">Short</option></Select></Field>
            <Field label="Setup"><Select value={f.setup} onChange={(e) => setF({ ...f, setup: e.target.value })}><option value="all">All</option>{setups.map((s) => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="Session"><Select value={f.session} onChange={(e) => setF({ ...f, session: e.target.value as TradeFilter["session"] })}><option value="all">All</option>{SESSIONS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="Emotion"><Select value={f.emotion} onChange={(e) => setF({ ...f, emotion: e.target.value as TradeFilter["emotion"] })}><option value="all">All</option>{EMOTIONS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          </div>
        )}
        {saved.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-2.5">
            <span className="text-xs text-muted">Saved views</span>
            {saved.map((s) => (
              <span key={s.id} className="inline-flex items-center rounded-full border border-line">
                <button type="button" className="h-7 pl-3 pr-1 text-xs text-text-2 hover:text-text" onClick={() => setF(s.filter)}>{s.name}</button>
                <button type="button" aria-label={`Delete saved view ${s.name}`} className="grid h-7 w-7 place-items-center text-muted hover:text-neg" onClick={async () => { if (await confirm({ title: `Delete “${s.name}”?`, confirm: "Delete view", danger: true })) deleteFilter(s.id); }}><X size={12} /></button>
              </span>
            ))}
          </div>
        )}

        {all.length === 0 ? (
          <div className="p-6"><EmptyState icon={<NotebookPen size={18} />} title="Your journal is empty" body="Log your first trade with Quick Log, or open the full editor for every detail." action={<Button variant="accent" onClick={openQuickLog}>Quick Log a trade</Button>} /></div>
        ) : sorted.length === 0 ? (
          <p className="px-4 py-12 text-center text-[13px] text-muted">No trades match these filters.</p>
        ) : (
          <>
            {view === "cards" ? (
              <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((x) => {
                  const shown = x.m.status === "closed";
                  const tone = (x.m.net ?? 0) > 0 ? "pos" : (x.m.net ?? 0) < 0 ? "neg" : "text-muted";
                  return (
                    <li key={x.trade.id}>
                      <Link href={`/journal/${x.trade.id}`} className="card-2 group flex h-full flex-col gap-3 p-4 transition-colors hover:border-muted/60">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-semibold">{x.trade.symbol || "Untitled"} <span className="font-normal text-muted">#{x.trade.number}</span></p>
                            <p className="truncate text-xs text-muted">{fmtDate(x.trade.date)} · {x.trade.session ?? "No session"}</p>
                          </div>
                          <ResultBadge x={x} />
                        </div>
                        <div className="flex items-end justify-between gap-2">
                          <div>
                            <p className={cx("num text-[20px] leading-none", shown ? tone : "text-muted")}>{shown ? fmtMoney(x.m.net, currencyOf(x.trade.accountId), { sign: true }) : "—"}</p>
                            <p className="num mt-1 text-xs text-muted">{fmtR(x.m.r)}</p>
                          </div>
                          <span className={cx("rounded-md px-2 py-0.5 text-[11px] capitalize", x.trade.direction === "long" ? "bg-pos/10 text-pos" : x.trade.direction === "short" ? "bg-neg/10 text-neg" : "bg-card text-muted")}>{x.trade.direction ?? "—"}</span>
                        </div>
                        <div className="mt-auto flex flex-wrap gap-1.5 border-t border-line-soft pt-3 text-[11.5px] text-text-2">
                          <span className="truncate">{x.trade.setup || "No setup"}</span>
                          {x.trade.grade && <span className="text-muted">· grade {x.trade.grade}</span>}
                          {x.trade.emotions[0] && <span className="text-muted">· {x.trade.emotions.join(", ")}</span>}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (<>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1080px] text-[13px]">
                <thead className="text-left text-xs text-muted">
                  <tr className="border-b border-line-soft">
                    {th("number", "#", "pl-4")}{th("symbol", "Symbol")}{th("market", "Market")}{th("direction", "Direction")}{th("setup", "Setup")}{th("date", "Date")}{th("session", "Session")}
                    <th className="px-3 py-2.5 font-medium">Result</th>{th("net", "Net", "text-right")}{th("r", "R", "text-right")}{th("grade", "Grade")}<th className="px-3 py-2.5 font-medium">Emotion</th>{th("account", "Account", "pr-4")}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((x) => (
                    <tr key={x.trade.id} className="cursor-pointer border-b border-line-soft transition-colors last:border-0 hover:bg-card-2/50" onClick={() => router.push(`/journal/${x.trade.id}`)}>
                      <td className="num py-2.5 pl-4 pr-3 text-muted"><Link href={`/journal/${x.trade.id}`} onClick={(e) => e.stopPropagation()} className="hover:text-text">{x.trade.number}</Link></td>
                      <td className="px-3 py-2.5 font-medium text-text">{x.trade.symbol || <span className="text-muted">—</span>}</td>
                      <td className="px-3 py-2.5 text-text-2">{x.trade.market ?? "—"}</td>
                      <td className={cx("px-3 py-2.5 capitalize", x.trade.direction === "long" ? "pos" : x.trade.direction === "short" ? "neg" : "text-muted")}>{x.trade.direction ?? "—"}</td>
                      <td className="max-w-[180px] truncate px-3 py-2.5 text-text-2">{x.trade.setup || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-text-2">{fmtDate(x.trade.date)}</td>
                      <td className="px-3 py-2.5 text-text-2">{x.trade.session ?? "—"}</td>
                      <td className="px-3 py-2.5"><ResultBadge x={x} /></td>
                      <td className={cx("num px-3 py-2.5 text-right", (x.m.net ?? 0) > 0 && x.m.status === "closed" ? "pos" : (x.m.net ?? 0) < 0 && x.m.status === "closed" ? "neg" : "text-muted")}>{x.m.status === "closed" ? fmtMoney(x.m.net, currencyOf(x.trade.accountId), { sign: true }) : "—"}</td>
                      <td className="num px-3 py-2.5 text-right text-text-2">{fmtR(x.m.r)}</td>
                      <td className="px-3 py-2.5 text-text-2">{x.trade.grade ?? "—"}</td>
                      <td className="max-w-[140px] truncate px-3 py-2.5 text-text-2">{x.trade.emotions.join(", ") || "—"}</td>
                      <td className="max-w-[160px] truncate py-2.5 pl-3 pr-4 text-text-2">{acctName.get(x.trade.accountId ?? "") ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-line-soft md:hidden">
              {rows.map((x) => (
                <li key={x.trade.id}>
                  <Link href={`/journal/${x.trade.id}`} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium">{x.trade.symbol || "Untitled"} <span className="text-muted">#{x.trade.number}</span> <span className={cx("text-xs capitalize", x.trade.direction === "long" ? "pos" : "neg")}>{x.trade.direction}</span></p>
                      <p className="truncate text-xs text-muted">{fmtDate(x.trade.date)} · {x.trade.setup || "No setup"} · {acctName.get(x.trade.accountId ?? "") ?? "No account"}</p>
                    </div>
                    <div className="text-right">
                      <p className={cx("num text-[13px]", (x.m.net ?? 0) > 0 ? "pos" : (x.m.net ?? 0) < 0 ? "neg" : "text-muted")}>{x.m.status === "closed" ? fmtMoney(x.m.net, currencyOf(x.trade.accountId), { sign: true }) : <ResultBadge x={x} />}</p>
                      <p className="num text-xs text-muted">{fmtR(x.m.r)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            </>)}
            <div className="flex items-center justify-between gap-3 border-t border-line-soft px-4 py-3 text-xs text-muted">
              <span>{page * PAGE + 1}–{Math.min(sorted.length, (page + 1) * PAGE)} of {sorted.length} records{stats.closed !== stats.total && ` · ${stats.closed} closed`}</span>
              <div className="flex items-center gap-1">
                <IconButton label="Previous page" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={15} /></IconButton>
                <span className="num px-2">{page + 1} / {pages}</span>
                <IconButton label="Next page" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}><ChevronRight size={15} /></IconButton>
              </div>
            </div>
          </>
        )}
      </Card>
      {stats.total > 0 && <p className="text-xs text-muted">Win rate in this view: <span className="num text-text-2">{fmtPct(stats.winRate)}</span> (wins ÷ wins + losses). P&L figures are simulated records.</p>}

      <Modal open={saving} onClose={() => setSaving(false)} title="Save this view" size="sm" footer={<><Button variant="ghost" onClick={() => setSaving(false)}>Cancel</Button><Button variant="accent" disabled={!filterName.trim()} onClick={() => { saveFilter({ id: uid("flt"), name: filterName.trim().slice(0, 40), filter: f }); setSaving(false); toast("View saved"); }}>Save view</Button></>}>
        <Field label="Name"><Input value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="e.g. London losses" maxLength={40} /></Field>
        <p className="mt-3 text-xs text-muted">Saves the search text, date range and filters currently applied.{activeCount === 0 && !f.q && " No filters are applied yet."}</p>
        {activeCount > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{(Object.keys(EMPTY) as (keyof TradeFilter)[]).filter((k) => k !== "q" && f[k] !== EMPTY[k]).map((k) => <Badge key={k}>{k}: {k === "accountId" ? acctName.get(f[k]) : String(f[k])}</Badge>)}</div>}
      </Modal>
    </div>
  );
}
