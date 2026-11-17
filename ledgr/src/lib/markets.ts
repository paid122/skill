/**
 * Markets page: the watchlist, and where each symbol's prices come from.
 * Crypto streams live from Binance's public feed. Everything else comes from Yahoo Finance's
 * free data, which is delayed (CME futures by about 10 minutes); the page labels it so.
 * Real-time futures need a paid, licensed feed.
 */
import { guessSource, type CandleProvider } from "./candles";
import type { Market } from "./types";

export interface MarketSymbol {
  /** What the trader sees and types (NQ, BTCUSD, EURUSD, AAPL). */
  symbol: string;
  name: string;
  market: Market;
  provider: CandleProvider;
  dataSymbol: string;
  /** Streams tick by tick (crypto); otherwise refreshed and labelled delayed. */
  live: boolean;
  /** Micro contracts that follow this chart. */
  micro?: string;
}

const make = (symbol: string, name: string, market: Market, micro?: string): MarketSymbol => {
  const { provider, dataSymbol } = guessSource({ symbol, market });
  return { symbol, name, market, provider, dataSymbol, live: provider === "binance", micro };
};

export const WATCHLIST: { group: string; items: MarketSymbol[] }[] = [
  {
    group: "Futures",
    items: [
      make("NQ", "Nasdaq 100", "Futures", "MNQ"),
      make("ES", "S&P 500", "Futures", "MES"),
      make("YM", "Dow Jones", "Futures", "MYM"),
      make("RTY", "Russell 2000", "Futures", "M2K"),
      make("GC", "Gold", "Futures", "MGC"),
      make("SI", "Silver", "Futures", "SIL"),
      make("CL", "Crude oil", "Futures", "MCL"),
      make("NG", "Natural gas", "Futures"),
      make("HG", "Copper", "Futures"),
    ],
  },
  {
    group: "Crypto",
    items: [
      make("BTCUSD", "Bitcoin", "Crypto"),
      make("ETHUSD", "Ethereum", "Crypto"),
      make("SOLUSD", "Solana", "Crypto"),
      make("XRPUSD", "XRP", "Crypto"),
      make("DOGEUSD", "Dogecoin", "Crypto"),
    ],
  },
  {
    group: "Forex",
    items: [
      make("EURUSD", "Euro / US dollar", "Forex"),
      make("GBPUSD", "Pound / US dollar", "Forex"),
      make("USDJPY", "US dollar / Yen", "Forex"),
      make("AUDUSD", "Aussie / US dollar", "Forex"),
      make("USDCAD", "US dollar / Loonie", "Forex"),
    ],
  },
  {
    group: "Stocks",
    items: [
      make("SPY", "S&P 500 ETF", "Stocks"),
      make("QQQ", "Nasdaq 100 ETF", "Stocks"),
      make("AAPL", "Apple", "Stocks"),
      make("NVDA", "Nvidia", "Stocks"),
      make("TSLA", "Tesla", "Stocks"),
      make("MSFT", "Microsoft", "Stocks"),
    ],
  },
];

export const ALL_MARKETS = WATCHLIST.flatMap((g) => g.items);

/** A symbol the trader typed (MNQ, NQZ6, BTC, EURUSD, AMD…) → where to chart it. */
export function lookupSymbol(input: string): MarketSymbol | null {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s) return null;
  const known = ALL_MARKETS.find((m) => m.symbol === s || m.micro === s || m.symbol === s.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, "") || m.micro === s.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, ""));
  if (known) return known;
  if (/^(BTC|ETH|SOL|XRP|DOGE|BNB|ADA|AVAX|LTC|LINK)/.test(s)) return make(s.endsWith("USD") || s.endsWith("USDT") ? s : `${s}USD`, s, "Crypto");
  if (/^[A-Z]{6}$/.test(s) && /^(EUR|GBP|USD|JPY|AUD|NZD|CAD|CHF)/.test(s) && /(EUR|GBP|USD|JPY|AUD|NZD|CAD|CHF)$/.test(s)) return make(s, s, "Forex");
  return make(s, s, "Stocks");
}

/** The chart that matches a journal trade's symbol (so its entries and exits can be marked). */
export function sameMarket(m: MarketSymbol, tradeSymbol: string, tradeMarket: Market | null): boolean {
  const { provider, dataSymbol } = guessSource({ symbol: tradeSymbol, market: tradeMarket ?? (m.market === "Futures" ? "Futures" : null) });
  return provider === m.provider && dataSymbol === m.dataSymbol;
}
