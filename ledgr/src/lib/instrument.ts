/**
 * A small badge for an instrument, drawn by Ledgr (no third-party logos).
 * Returns short text (₿, €$, Au, NQ, A) or a named icon for energy markets.
 */
import type { Market } from "./types";

export type MarketGlyph = { text: string; icon?: undefined } | { icon: "oil" | "gas"; text?: undefined };

const CCY: Record<string, string> = { EUR: "€", GBP: "£", USD: "$", JPY: "¥", AUD: "A$", NZD: "N$", CAD: "C$", CHF: "₣", CNH: "¥", MXN: "M$", ZAR: "R", SEK: "kr", NOK: "kr" };
const CRYPTO: Record<string, string> = { BTC: "₿", ETH: "Ξ", SOL: "◎", XRP: "✕", LTC: "Ł", DOGE: "Ð", ADA: "₳" };
const METAL: Record<string, string> = { XAU: "Au", GC: "Au", MGC: "Au", GOLD: "Au", XAG: "Ag", SI: "Ag", SIL: "Ag", SILVER: "Ag", XPT: "Pt", PL: "Pt", XPD: "Pd", PA: "Pd", XCU: "Cu", HG: "Cu", MHG: "Cu", COPPER: "Cu" };
const OIL = new Set(["CL", "MCL", "QM", "BZ", "USOIL", "UKOIL", "WTI", "BRENT"]);
const GAS = new Set(["NG", "QG", "NATGAS"]);
const INDEX_CFD: Record<string, string> = { NAS100: "NQ", US100: "NQ", USTEC: "NQ", US30: "YM", DJ30: "YM", WS30: "YM", SPX500: "ES", US500: "ES", US2000: "RTY", GER40: "DAX", DE40: "DAX", UK100: "FT", JP225: "NK" };

export function marketGlyph(symbol: string, market: Market | null): MarketGlyph {
  const s = (symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s) return { text: "·" };
  const root = market === "Futures" ? s.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, "") || s : s;
  if (OIL.has(root)) return { icon: "oil" };
  if (GAS.has(root)) return { icon: "gas" };
  const metal = METAL[root] ?? METAL[root.slice(0, 3)];
  if (metal && (market !== "Stocks" || root.length > 3)) return { text: metal };
  const crypto = Object.keys(CRYPTO).find((k) => root.startsWith(k));
  if (crypto && (market === "Crypto" || !market || market === "Other")) return { text: CRYPTO[crypto] };
  if (market === "Forex" || (root.length === 6 && CCY[root.slice(0, 3)] && CCY[root.slice(3)])) {
    const a = CCY[root.slice(0, 3)], b = CCY[root.slice(3, 6)];
    if (a && b) return { text: `${a}${b}` };
  }
  if (INDEX_CFD[root]) return { text: INDEX_CFD[root] };
  if (market === "Futures" || market === "Indices") return { text: root.slice(0, 3) };
  return { text: root.slice(0, market === "Stocks" ? 1 : 2) };
}

/**
 * A picture for the symbol, when one exists:
 *  crypto  → coin icon (cryptocurrency-icons, CC0, bundled in /public/symbols/crypto)
 *  forex   → both currencies' flags (flag-icons, MIT, bundled in /public/symbols/flags)
 *  stocks  → the company's logo, via /api/logo
 *  futures / index CFDs → the logo of the index owner or exchange (Nasdaq, S&P, CME Group)
 */
export type SymbolImage = { kind: "single"; src: string } | { kind: "pair"; a: string; b: string };

const COINS = ["btc", "eth", "sol", "xrp", "ltc", "doge", "ada", "bnb", "avax", "link", "dot", "matic", "trx", "bch", "usdt", "usdc", "xlm", "atom", "uni", "etc", "xmr"];
const FLAG: Record<string, string> = { EUR: "eu", GBP: "gb", USD: "us", JPY: "jp", AUD: "au", NZD: "nz", CAD: "ca", CHF: "ch", CNH: "cn", CNY: "cn", MXN: "mx", ZAR: "za", SEK: "se", NOK: "no", HKD: "hk", SGD: "sg", TRY: "tr" };
const FUTURE_OWNER: Record<string, string> = {
  NQ: "NDAQ", MNQ: "NDAQ", NAS100: "NDAQ", US100: "NDAQ", USTEC: "NDAQ", NDX: "NDAQ",
  ES: "SPGI", MES: "SPGI", SPX500: "SPGI", US500: "SPGI", SPX: "SPGI",
  YM: "SPGI", MYM: "SPGI", US30: "SPGI", DJ30: "SPGI", WS30: "SPGI",
  CL: "CME", MCL: "CME", QM: "CME", NG: "CME", QG: "CME", GC: "CME", MGC: "CME", SI: "CME", SIL: "CME", HG: "CME", PL: "CME", PA: "CME",
  RTY: "CME", M2K: "CME", ZB: "CME", ZN: "CME", ZF: "CME", ZT: "CME", "6E": "CME", "6J": "CME", "6B": "CME", "6A": "CME", ZC: "CME", ZS: "CME", ZW: "CME", BTC: "CME", MBT: "CME", ETH: "CME", MET: "CME",
  USOIL: "CME", WTI: "CME", NATGAS: "CME",
};

export function symbolImage(symbol: string, market: Market | null): SymbolImage | null {
  const s = (symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s) return null;
  const root = market === "Futures" ? s.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, "") || s : s;
  if (/^(XAU|XAG|XPT|XPD|XCU)/.test(root)) return metalImage(root.slice(0, 3));
  // Metal futures and names use the same bullion icons.
  const METAL_ROOT: Record<string, string> = { GC: "XAU", MGC: "XAU", GOLD: "XAU", SI: "XAG", SIL: "XAG", SILVER: "XAG", PL: "XPT", PLATINUM: "XPT", PA: "XPD", PALLADIUM: "XPD", HG: "XCU", MHG: "XCU", COPPER: "XCU" };
  if (METAL_ROOT[root] && market !== "Stocks") return metalImage(METAL_ROOT[root]);
  if (market === "Futures" || market === "Indices" || market === "Commodities" || (!market && FUTURE_OWNER[root])) {
    return FUTURE_OWNER[root] ? { kind: "single", src: `/api/logo?s=${FUTURE_OWNER[root]}` } : null;
  }
  if (market === "Crypto" || ((!market || market === "Other") && COINS.some((c) => root.startsWith(c.toUpperCase())))) {
    const coin = COINS.find((c) => root.startsWith(c.toUpperCase()));
    return coin ? { kind: "single", src: `/symbols/crypto/${coin}.svg` } : null;
  }
  if (root.length === 6 && FLAG[root.slice(0, 3)] && FLAG[root.slice(3)]) {
    return { kind: "pair", a: `/symbols/flags/${FLAG[root.slice(0, 3)]}.svg`, b: `/symbols/flags/${FLAG[root.slice(3)]}.svg` };
  }
  if (market === "Stocks" || market === "Options" || ((!market || market === "Other") && /^[A-Z]{1,5}$/.test(root))) {
    return /^[A-Z]{1,5}$/.test(root) ? { kind: "single", src: `/api/logo?s=${root}` } : null;
  }
  return null;
}

/** Spot metals (XAUUSD, XAGUSD …): a Ledgr-drawn bullion icon in the metal's colour. */
function metalImage(root: string): SymbolImage {
  return { kind: "single", src: `/symbols/metals/${root.slice(0, 3).toLowerCase()}.svg` };
}
