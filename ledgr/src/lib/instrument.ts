/**
 * A small badge for an instrument, drawn by Ledgr (no third-party logos).
 * Returns short text (₿, €$, Au, NQ, A) or a named icon for energy markets.
 */
import type { Market } from "./types";

export type MarketGlyph = { text: string; icon?: undefined } | { icon: "oil" | "gas"; text?: undefined };

const CCY: Record<string, string> = { EUR: "€", GBP: "£", USD: "$", JPY: "¥", AUD: "A$", NZD: "N$", CAD: "C$", CHF: "₣", CNH: "¥", MXN: "M$", ZAR: "R", SEK: "kr", NOK: "kr" };
const CRYPTO: Record<string, string> = { BTC: "₿", ETH: "Ξ", SOL: "◎", XRP: "✕", LTC: "Ł", DOGE: "Ð", ADA: "₳" };
const METAL: Record<string, string> = { XAU: "Au", GC: "Au", MGC: "Au", GOLD: "Au", XAG: "Ag", SI: "Ag", SIL: "Ag", SILVER: "Ag", XPT: "Pt", PL: "Pt", XPD: "Pd", PA: "Pd", HG: "Cu", COPPER: "Cu" };
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
