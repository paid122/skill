"use client";
import { Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageIntro } from "@/components/blocks";
import { MarketChart, type ChartMark } from "@/components/markets/MarketChart";
import { SymbolIcon } from "@/components/SymbolIcon";
import { Badge, Button, Card, Input, Segmented } from "@/components/ui";
import { PageVerse } from "@/components/VerseCard";
import type { CandleInterval } from "@/lib/candles";
import { useEnriched } from "@/lib/hooks";
import { ALL_MARKETS, lookupSymbol, sameMarket, WATCHLIST, type MarketSymbol } from "@/lib/markets";
import { openQuickLog } from "@/lib/overlays";
import { cx } from "@/lib/util";

const KEY = "ledgr.markets";
const INTERVALS: { value: CandleInterval; label: string }[] = [
  { value: "1m", label: "1m" }, { value: "5m", label: "5m" }, { value: "15m", label: "15m" }, { value: "1h", label: "1H" }, { value: "1d", label: "1D" },
];

type Quote = { price: number; prevClose: number | null };

/** Price with sensible decimals for each market (5 for most forex, 2 for futures and stocks). */
function fmtPrice(m: MarketSymbol, p: number | undefined) {
  if (p === undefined || !Number.isFinite(p)) return "—";
  const dp = m.market === "Forex" ? (m.symbol.includes("JPY") ? 3 : 5) : p < 1 ? 5 : p < 10 ? 4 : 2;
  return p.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
const pct = (q?: Quote) => (q && q.prevClose ? ((q.price - q.prevClose) / q.prevClose) * 100 : null);

/** Watchlist prices: crypto from Binance's public 24h tickers, everything else from /api/quotes (delayed). */
function useQuotes() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  useEffect(() => {
    let live = true;
    const crypto = ALL_MARKETS.filter((m) => m.provider === "binance").map((m) => m.dataSymbol);
    const other = ALL_MARKETS.filter((m) => m.provider !== "binance").map((m) => m.dataSymbol);
    const load = async () => {
      const next: Record<string, Quote> = {};
      await Promise.all([
        fetch(`https://data-api.binance.vision/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(crypto))}`)
          .then((r) => r.json()).then((rows: { symbol: string; lastPrice: string; prevClosePrice: string; openPrice: string }[]) => {
            rows.forEach((x) => { next[x.symbol] = { price: +x.lastPrice, prevClose: +x.openPrice || null }; });
          }).catch(() => undefined),
        fetch(`/api/quotes?s=${other.join(",")}`).then((r) => r.json()).then((j: { quotes?: Record<string, Quote | null> }) => {
          Object.entries(j.quotes ?? {}).forEach(([k, v]) => { if (v) next[k] = v; });
        }).catch(() => undefined),
      ]);
      if (live) setQuotes((q) => ({ ...q, ...next }));
    };
    load();
    const id = setInterval(load, 20_000);
    return () => { live = false; clearInterval(id); };
  }, []);
  return quotes;
}

export default function MarketsPage() {
  const [market, setMarket] = useState<MarketSymbol>(WATCHLIST[0].items[0]);
  const [interval, setInterval_] = useState<CandleInterval>("5m");
  const [search, setSearch] = useState("");
  const [livePrice, setLivePrice] = useState<{ price: number; at: number } | null>(null);
  const quotes = useQuotes();
  const all = useEnriched();

  // Remember the last chart and timeframe.
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as { symbol?: string; interval?: CandleInterval } | null;
      if (s?.symbol) { const m = lookupSymbol(s.symbol); if (m) setMarket(m); }
      if (s?.interval && INTERVALS.some((i) => i.value === s.interval)) setInterval_(s.interval);
    } catch { /* first visit */ }
  }, []);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify({ symbol: market.symbol, interval })); } catch { /* ignore */ } }, [market, interval]);
  useEffect(() => setLivePrice(null), [market]);

  // This market's entries and exits from your journal.
  const { marks, tradeCount } = useMemo(() => {
    const trades = all.filter((x) => x.trade.symbol && sameMarket(market, x.trade.symbol, x.trade.market));
    const out: ChartMark[] = [];
    for (const x of trades) for (const e of x.trade.executions) {
      const t = Date.parse(e.time);
      if (Number.isFinite(t) && Number.isFinite(e.price)) out.push({ time: t, price: e.price, kind: e.kind, long: x.trade.direction !== "short", label: `#${x.trade.number}` });
    }
    return { marks: out, tradeCount: trades.length };
  }, [all, market]);

  const q = quotes[market.dataSymbol];
  const price = livePrice?.price ?? q?.price;
  const change = q?.prevClose && price !== undefined ? ((price - q.prevClose) / q.prevClose) * 100 : null;

  const go = () => { const m = lookupSymbol(search); if (m) { setMarket(m); setSearch(""); } };

  return (
    <div className="flex flex-col gap-6">
      <PageIntro title="Markets" sub="Charts for every market you trade, with your own entries and exits marked. Crypto is live; futures, forex and stocks use free delayed data." />
      <PageVerse page="markets" compact />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[290px_minmax(0,1fr)]">
        {/* Watchlist */}
        <Card pad={false} className="overflow-hidden lg:sticky lg:top-20">
          <form onSubmit={(e) => { e.preventDefault(); go(); }} className="relative border-b border-line-soft p-2">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Any symbol: MNQ, AMD, GBPJPY…" aria-label="Search a symbol" style={{ paddingLeft: 32 }} className="h-9 text-[13px]" />
          </form>
          <div className="max-h-[70vh] overflow-y-auto scroll-thin">
            {WATCHLIST.map((g) => (
              <div key={g.group}>
                <p className="sticky top-0 z-[1] bg-card px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{g.group}</p>
                {g.items.map((m) => {
                  const qq = quotes[m.dataSymbol], ch = pct(qq), on = m.symbol === market.symbol;
                  return (
                    <button key={m.symbol} type="button" onClick={() => setMarket(m)} aria-pressed={on}
                      className={cx("flex w-full items-center gap-3 px-4 py-2 text-left transition-colors", on ? "bg-card-2" : "hover:bg-card-2/60")}>
                      <SymbolIcon symbol={m.symbol} market={m.market} size={26} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-semibold text-text">{m.symbol}{m.micro && <span className="ml-1.5 text-[11px] font-normal text-muted">{m.micro}</span>}</span>
                        <span className="block truncate text-[11.5px] text-muted">{m.name}</span>
                      </span>
                      <span className="text-right">
                        <span className="num block text-[12.5px] text-text">{fmtPrice(m, qq?.price)}</span>
                        <span className={cx("num block text-[11px]", ch === null ? "text-muted" : ch >= 0 ? "pos" : "neg")}>{ch === null ? "" : `${ch >= 0 ? "+" : ""}${ch.toFixed(2)}%`}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>

        {/* Chart */}
        <Card className="min-w-0 !p-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line-soft px-5 py-4">
            <SymbolIcon symbol={market.symbol} market={market.market} size={34} />
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[17px] font-semibold text-text">
                {market.symbol}
                {market.live
                  ? <span className="inline-flex items-center gap-1.5 rounded-full bg-pos/10 px-2 py-0.5 text-[11px] font-semibold text-pos"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pos" /> Live</span>
                  : <Badge tone="muted">Delayed</Badge>}
              </p>
              <p className="text-[12px] text-muted">{market.name}{market.micro ? ` · ${market.micro} follows this chart` : ""}</p>
            </div>
            <div className="ml-1">
              <p className="num text-[22px] font-semibold leading-none text-text">{fmtPrice(market, price)}</p>
              <p className={cx("num mt-1 text-[12px]", change === null ? "text-muted" : change >= 0 ? "pos" : "neg")}>{change === null ? " " : `${change >= 0 ? "+" : ""}${change.toFixed(2)}% ${market.live ? "24h" : "today"}`}</p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Segmented ariaLabel="Candle size" size="sm" value={interval} onChange={setInterval_} options={INTERVALS} />
              <Button size="sm" variant="accent" icon={<Plus size={14} />} onClick={openQuickLog}>Log trade</Button>
            </div>
          </div>
          <div className="h-[440px] px-2 pb-2 pt-3 sm:h-[560px]">
            <MarketChart key={`${market.dataSymbol}`} market={market} interval={interval} marks={marks} onPrice={(p, at) => setLivePrice({ price: p, at })} />
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line-soft px-5 py-3 text-[12px] text-muted">
            <span>{tradeCount ? `${tradeCount} of your trades on ${market.symbol} are marked (↑ buy, ↓ sell)` : `No journal trades on ${market.symbol} yet`}</span>
            <span className="ml-auto">{market.live ? "Live from Binance" : "Delayed data from Yahoo Finance (futures about 10 min)"} · Charts by TradingView Lightweight Charts</span>
          </div>
        </Card>
      </div>
      <p className="text-[12px] text-muted">Prices are for reference while you journal and may be delayed or differ slightly from your broker. Not financial advice.</p>
    </div>
  );
}
