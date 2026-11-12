"use client";
import { AlertTriangle, ChevronDown, FileUp, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { importTrades } from "@/lib/actions";
import { tradeMetrics } from "@/lib/calc";
import { buildTrades, defaultPointValue, detect, inferPointValue, parseCsv, type ImportedTrade, type Mapping, type Mode } from "@/lib/csvImport";
import { blankTrade } from "@/lib/defaults";
import { closeImport, useOverlays } from "@/lib/overlays";
import { useLedgr } from "@/lib/store";
import type { Trade } from "@/lib/types";
import { cx, fmtMoney, fmtNum, nowISO, uid } from "@/lib/util";
import { Badge, Button, Field, Modal, NumberInput, Segmented, Select, Toggle, useFeedback } from "./ui";

const MAX_BYTES = 10 * 1024 * 1024;
const FIELDS: Record<Mode, { key: keyof Mapping; label: string; required?: boolean }[]> = {
  fills: [
    { key: "time", label: "Time (or date & time)", required: true }, { key: "date", label: "Date (if separate)" }, { key: "symbol", label: "Symbol", required: true },
    { key: "side", label: "Buy / Sell", required: true }, { key: "qty", label: "Quantity", required: true }, { key: "price", label: "Price", required: true },
    { key: "fees", label: "Commission / fees" }, { key: "status", label: "Order status" },
  ],
  trades: [
    { key: "symbol", label: "Symbol", required: true }, { key: "direction", label: "Long / Short" }, { key: "qty", label: "Quantity", required: true },
    { key: "entryPrice", label: "Entry price", required: true }, { key: "exitPrice", label: "Exit price", required: true },
    { key: "entryTime", label: "Entry time", required: true }, { key: "exitTime", label: "Exit time" }, { key: "pnl", label: "P&L (to check sizes)" }, { key: "fees", label: "Commission / fees" },
  ],
};

const localDate = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

function toTrade(x: ImportedTrade, pointValue: number, accountId: string | null, file: string): Trade {
  const t = blankTrade(0, accountId);
  return {
    ...t,
    id: uid("trd"),
    symbol: x.symbol, market: x.market, direction: x.direction, date: localDate(x.executions[0].time),
    executions: x.executions.map((e) => ({ id: uid("ex"), kind: e.kind, price: e.price, quantity: Number(e.quantity.toFixed(8)), time: e.time, fees: Number(e.fees.toFixed(4)) })),
    pointValue, isDraft: false, importKey: x.key,
    activity: [{ at: nowISO(), message: `Imported from ${file}` }],
  };
}

export function ImportCsv() {
  const { importCsv } = useOverlays();
  const router = useRouter();
  const { toast } = useFeedback();
  const accounts = useLedgr((s) => s.accounts.filter((a) => a.status !== "archived"));
  const currencyOf = useLedgr((s) => (id: string | null) => s.accounts.find((a) => a.id === id)?.currency ?? "USD");
  const existingKeys = useLedgr((s) => new Set(s.trades.map((t) => t.importKey).filter(Boolean) as string[]));
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<string | null>(null);
  const [table, setTable] = useState<string[][] | null>(null);
  const [format, setFormat] = useState("");
  const [mode, setMode] = useState<Mode>("fills");
  const [mapping, setMapping] = useState<Mapping>({});
  const [buySell, setBuySell] = useState(false);
  const [dayFirst, setDayFirst] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [includeOpen, setIncludeOpen] = useState(true);
  const [pv, setPv] = useState<Record<string, number | null>>({});
  const [showCols, setShowCols] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!importCsv) return;
    setFile(null); setTable(null); setError(null); setPv({}); setShowCols(false);
    setAccountId(accounts.find((a) => a.status === "active")?.id ?? accounts[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importCsv]);

  const load = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    if (f.size > MAX_BYTES) return setError("That file is larger than 10 MB. Export a shorter date range.");
    const text = await f.text();
    const rows = parseCsv(text);
    if (rows.length < 2) return setError("That file has no rows to import. Check it's a CSV export of trades or fills.");
    const d = detect(rows[0]);
    setFile(f.name); setTable(rows); setFormat(d.format); setMode(d.mode); setMapping(d.mapping); setBuySell(d.buySell); setPv({});
    // Day-first dates (e.g. 25/11/2026) if any slash date has a first part above 12
    setDayFirst(rows.slice(1, 200).some((r) => r.some((c) => { const m = c.match(/^(\d{1,2})[./](\d{1,2})[./]\d{2,4}/); return !!m && Number(m[1]) > 12; })));
    const missing = FIELDS[d.mode].filter((x) => x.required && d.mapping[x.key] === undefined);
    setShowCols(missing.length > 0);
  };

  const headers = table?.[0] ?? [];
  const result = useMemo(() => (table ? buildTrades(table.slice(1), mode, mapping, { dayFirst, buySell }) : null), [table, mode, mapping, dayFirst, buySell]);
  const missing = FIELDS[mode].filter((x) => x.required && mapping[x.key] === undefined);

  // Contract size per symbol: from the file's own P&L when it has one, else the built-in table.
  const symbols = useMemo(() => {
    if (!result) return [];
    const by = new Map<string, ImportedTrade[]>();
    result.trades.forEach((t) => { if (!by.has(t.symbol)) by.set(t.symbol, []); by.get(t.symbol)!.push(t); });
    return [...by.entries()].map(([symbol, list]) => {
      const inferred = inferPointValue(list);
      const market = list[0].market;
      return { symbol, market, count: list.length, inferred, fallback: defaultPointValue(symbol, market, list[0].executions[0].quantity) };
    });
  }, [result]);
  const pointValue = (sym: string) => { const s = symbols.find((x) => x.symbol === sym); return pv[sym] ?? s?.inferred ?? s?.fallback ?? 1; };

  const rows = useMemo(() => {
    if (!result) return [];
    return result.trades.map((x) => {
      const t = toTrade(x, pointValue(x.symbol), accountId, file ?? "CSV");
      return { x, t, m: tradeMetrics(t), dup: existingKeys.has(x.key) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, pv, symbols, accountId, existingKeys]);
  const toImport = rows.filter((r) => !r.dup && (includeOpen || !r.x.open));
  const dups = rows.filter((r) => r.dup).length;
  const openCount = rows.filter((r) => r.x.open && !r.dup).length;
  const net = toImport.reduce((s, r) => s + (r.m.net ?? 0), 0);
  const currency = currencyOf(accountId);

  const doImport = () => {
    try {
      const n = importTrades(toImport.map((r) => r.t));
      toast(`Imported ${n} trade${n === 1 ? "" : "s"} from ${file}`);
      closeImport();
      router.push("/journal");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import these trades.");
    }
  };

  return (
    <Modal open={importCsv} onClose={closeImport} size="xl" title="Import trades from CSV"
      description="Export your trades or fills from your platform as CSV, then drop the file here. Nothing is imported until you confirm."
      footer={table && result ? (
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => { setTable(null); setFile(null); }}>Choose another file</Button>
          <Button variant="accent" icon={<Upload size={15} />} onClick={doImport} disabled={toImport.length === 0 || missing.length > 0}>
            Import {toImport.length} trade{toImport.length === 1 ? "" : "s"}
          </Button>
        </div>
      ) : undefined}>
      {!table ? (
        <div className="grid gap-4">
          <button type="button" onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); load(e.dataTransfer.files?.[0]); }}
            className={cx("grid place-items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors", dragging ? "border-accent bg-accent/5" : "border-line hover:border-text-2")}>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-card-2"><FileUp size={22} /></span>
            <span className="text-[15px] font-medium">Drop your CSV here, or click to choose</span>
            <span className="text-[13px] text-muted">.csv or .txt · up to 10 MB</span>
          </button>
          <input ref={fileRef} type="file" accept=".csv,.txt,text/csv" hidden aria-label="Choose CSV file" onChange={(e) => { load(e.target.files?.[0]); e.target.value = ""; }} />
          {error && <p role="alert" className="text-[13px] text-neg">{error}</p>}
          <div className="rounded-2xl border border-line-soft p-4 text-[13px] leading-relaxed text-text-2">
            <p className="font-medium text-text">Works with</p>
            <p className="mt-1">Tradovate (Performance report, or Orders/Fills), NinjaTrader executions, TradingView, Interactive Brokers, MetaTrader and most brokers — any CSV with a symbol, buy/sell, quantity, price and time per fill, or entry and exit prices per trade. Fills are joined into complete trades, including partial exits.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-5">
          {/* summary */}
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <Badge tone="neutral">{file}</Badge>
            <Badge tone="neutral">{format}</Badge>
            <span className="text-text-2">{table.length - 1} rows → <b className="text-text">{rows.length}</b> trades</span>
            {dups > 0 && <Badge tone="neutral">{dups} already imported — skipped</Badge>}
            {result!.problems.length > 0 && <Badge tone="neutral">{result!.problems.length} rows skipped</Badge>}
          </div>

          {missing.length > 0 && (
            <p role="alert" className="flex items-start gap-2 rounded-xl border border-neg/40 bg-neg/10 px-3.5 py-2.5 text-[13px]"><AlertTriangle size={15} className="mt-0.5 shrink-0" />Choose a column for: {missing.map((m) => m.label).join(", ")}.</p>
          )}

          {/* columns */}
          <div className="rounded-2xl border border-line-soft">
            <button type="button" onClick={() => setShowCols(!showCols)} className="flex w-full items-center justify-between px-4 py-3 text-[14px] font-medium">
              Columns <ChevronDown size={16} className={cx("transition-transform", showCols && "rotate-180")} />
            </button>
            {showCols && (
              <div className="grid gap-4 border-t border-line-soft p-4">
                <Segmented value={mode} onChange={(v) => { setMode(v); setBuySell(false); setMapping(detect(headers).mode === v ? detect(headers).mapping : {}); }}
                  options={[{ value: "fills", label: "Each row is a fill" }, { value: "trades", label: "Each row is a trade" }]} ariaLabel="File layout" />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {FIELDS[mode].map((f) => (
                    <Field key={f.key} label={`${f.label}${f.required ? "" : " (optional)"}`}>
                      <Select value={mapping[f.key] ?? ""} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value === "" ? undefined : Number(e.target.value) })}>
                        <option value="">—</option>
                        {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                      </Select>
                    </Field>
                  ))}
                </div>
                <Toggle label="Dates are day-first (25/11/2026)" checked={dayFirst} onChange={setDayFirst} />
              </div>
            )}
          </div>

          {/* contract sizes + account */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="rounded-2xl border border-line-soft p-4">
              <p className="text-[14px] font-medium">Contract size per symbol</p>
              <p className="mt-0.5 text-[12.5px] text-muted">Money per 1.0 price move per unit (e.g. MNQ $2, NQ $20, ES $50). Checked against your file's P&L where it has one.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {symbols.map((s) => (
                  <label key={s.symbol} className="flex items-center gap-3 rounded-xl border border-line-soft px-3 py-2">
                    <span className="min-w-0 flex-1"><span className="font-medium">{s.symbol}</span> <span className="text-[12px] text-muted">{s.market} · {s.count} trade{s.count === 1 ? "" : "s"}{s.inferred ? " · from your P&L" : ""}</span></span>
                    <NumberInput aria-label={`Contract size for ${s.symbol}`} value={pv[s.symbol] ?? s.inferred ?? s.fallback} onChange={(n) => setPv({ ...pv, [s.symbol]: n && n > 0 ? n : null })} className="w-24 text-right" />
                  </label>
                ))}
              </div>
            </div>
            <div className="grid content-start gap-4 rounded-2xl border border-line-soft p-4">
              <Field label="Into account">
                <Select value={accountId ?? ""} onChange={(e) => setAccountId(e.target.value || null)}>
                  <option value="">No account</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </Field>
              {openCount > 0 && <Toggle label={`Include ${openCount} open position${openCount === 1 ? "" : "s"}`} description="Still open at the end of the file" checked={includeOpen} onChange={setIncludeOpen} />}
              <div className="text-[13px] text-text-2">Net of trades to import <p className={cx("font-mono text-[18px]", net >= 0 ? "text-pos" : "text-neg")}>{fmtMoney(net, currency, { sign: true })}</p></div>
            </div>
          </div>

          {/* preview */}
          <div className="overflow-hidden rounded-2xl border border-line-soft">
            <div className="max-h-[320px] overflow-auto">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-card text-left text-[12px] text-muted"><tr>{["Date", "Symbol", "Side", "Qty", "Entry", "Exit", "Net", ""].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {rows.slice(0, 300).map(({ x, t, m, dup }) => (
                    <tr key={x.key + t.id} className={cx("border-t border-line-soft", dup && "opacity-45")}>
                      <td className="px-3 py-1.5 font-mono">{t.date}</td>
                      <td className="px-3 py-1.5 font-medium">{t.symbol}</td>
                      <td className="px-3 py-1.5 capitalize">{t.direction}</td>
                      <td className="px-3 py-1.5 font-mono">{fmtNum(m.entryQty, m.entryQty % 1 ? 2 : 0)}</td>
                      <td className="px-3 py-1.5 font-mono">{fmtNum(m.avgEntry, m.avgEntry !== null && m.avgEntry < 10 ? 5 : 2)}</td>
                      <td className="px-3 py-1.5 font-mono">{x.open ? "—" : fmtNum(m.avgExit, m.avgExit !== null && m.avgExit < 10 ? 5 : 2)}</td>
                      <td className={cx("px-3 py-1.5 font-mono", (m.net ?? 0) >= 0 ? "text-pos" : "text-neg")}>{x.open ? "Open" : fmtMoney(m.net, currency, { sign: true })}</td>
                      <td className="px-3 py-1.5 text-[12px] text-muted">{dup ? "Already imported" : x.open ? "Open" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && <p className="p-6 text-center text-[13px] text-muted">No trades found with these columns. Open “Columns” and check the matches.</p>}
            </div>
            {rows.length > 300 && <p className="border-t border-line-soft px-3 py-2 text-[12px] text-muted">Showing the first 300 of {rows.length}. All will be imported.</p>}
          </div>

          {result!.problems.length > 0 && (
            <details className="rounded-2xl border border-line-soft px-4 py-3 text-[13px]">
              <summary className="cursor-pointer font-medium">{result!.problems.length} row{result!.problems.length === 1 ? "" : "s"} skipped — see why</summary>
              <ul className="mt-2 grid max-h-40 gap-1 overflow-auto text-text-2">{result!.problems.slice(0, 200).map((p, i) => <li key={i}>Row {p.row}: {p.reason}</li>)}</ul>
            </details>
          )}
          {error && <p role="alert" className="text-[13px] text-neg">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
