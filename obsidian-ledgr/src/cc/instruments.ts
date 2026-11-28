/**
 * Instrument specs, as in the prototype: root → name, $ per point, tick, TradingView futures chart,
 * live proxy symbol (free widgets don't carry CME futures), short label, news currencies.
 */

export interface Instrument {
  code: string; name: string; pv: number; tick: number;
  tv: string; px: string; short: string; ccy: string[]; fut: boolean;
}

type Spec = [name: string, pv: number, tick: number, tv: string, px: string, short: string, ccy: string[]];

export const SPEC: Record<string, Spec> = {
  MGC: ["MICRO GOLD", 10, 0.1, "COMEX:MGC1!", "OANDA:XAUUSD", "GOLD", ["USD"]], GC: ["GOLD", 100, 0.1, "COMEX:GC1!", "OANDA:XAUUSD", "GOLD", ["USD"]],
  SIL: ["MICRO SILVER", 1000, 0.005, "COMEX:SIL1!", "OANDA:XAGUSD", "SILVER", ["USD"]], SI: ["SILVER", 5000, 0.005, "COMEX:SI1!", "OANDA:XAGUSD", "SILVER", ["USD"]],
  MCL: ["MICRO CRUDE", 100, 0.01, "NYMEX:MCL1!", "TVC:USOIL", "CRUDE", ["USD"]], CL: ["CRUDE OIL", 1000, 0.01, "NYMEX:CL1!", "TVC:USOIL", "CRUDE", ["USD"]],
  MNQ: ["MICRO NASDAQ", 2, 0.25, "CME_MINI:MNQ1!", "FOREXCOM:NSXUSD", "NASDAQ", ["USD"]], NQ: ["E-MINI NASDAQ", 20, 0.25, "CME_MINI:NQ1!", "FOREXCOM:NSXUSD", "NASDAQ", ["USD"]],
  MES: ["MICRO S&P", 5, 0.25, "CME_MINI:MES1!", "FOREXCOM:SPXUSD", "S&P 500", ["USD"]], ES: ["E-MINI S&P", 50, 0.25, "CME_MINI:ES1!", "FOREXCOM:SPXUSD", "S&P 500", ["USD"]],
  MYM: ["MICRO DOW", 0.5, 1, "CBOT_MINI:MYM1!", "FOREXCOM:DJI", "DOW", ["USD"]], YM: ["E-MINI DOW", 5, 1, "CBOT_MINI:YM1!", "FOREXCOM:DJI", "DOW", ["USD"]],
  M2K: ["MICRO RUSSELL", 5, 0.1, "CME_MINI:M2K1!", "CME_MINI:M2K1!", "RUSSELL", ["USD"]], RTY: ["E-MINI RUSSELL", 50, 0.1, "CME_MINI:RTY1!", "CME_MINI:RTY1!", "RUSSELL", ["USD"]],
  M6E: ["MICRO EUR/USD", 12500, 0.0001, "CME:M6E1!", "FX:EURUSD", "EURUSD", ["USD", "EUR"]], "6E": ["EURO FX", 125000, 0.00005, "CME:6E1!", "FX:EURUSD", "EURUSD", ["USD", "EUR"]],
  "6B": ["BRITISH POUND", 62500, 0.0001, "CME:6B1!", "FX:GBPUSD", "GBPUSD", ["USD", "GBP"]], "6J": ["JAPANESE YEN", 12500000, 0.0000005, "CME:6J1!", "FX:USDJPY", "USDJPY", ["USD", "JPY"]],
  MBT: ["MICRO BITCOIN", 0.1, 5, "CME:MBT1!", "BITSTAMP:BTCUSD", "BITCOIN", ["USD"]], BTC: ["BITCOIN FUTURES", 5, 5, "CME:BTC1!", "BITSTAMP:BTCUSD", "BITCOIN", ["USD"]],
  MET: ["MICRO ETHER", 0.1, 0.5, "CME:MET1!", "BITSTAMP:ETHUSD", "ETHER", ["USD"]], ZN: ["10Y NOTE", 1000, 0.015625, "CBOT:ZN1!", "CBOT:ZN1!", "10Y NOTE", ["USD"]],
  NG: ["NATURAL GAS", 10000, 0.001, "NYMEX:NG1!", "NYMEX:NG1!", "NAT GAS", ["USD"]], HG: ["COPPER", 25000, 0.0005, "COMEX:HG1!", "COMEX:HG1!", "COPPER", ["USD"]],
};

const ROOTS = Object.keys(SPEC).sort((a, b) => b.length - a.length);
const FXC = ["USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF", "CNH", "SGD", "HKD", "ZAR", "MXN", "SEK", "NOK", "TRY"];

/** "MGCZ6", "COMEX:MGC1!", "mgc" → "MGC"; unknown symbols come back cleaned. */
export function rootOf(sym: string): string {
  const s = String(sym || "").toUpperCase().replace(/^[A-Z_]+:/, "").replace(/[\s/\-.]/g, "");
  for (const r of ROOTS) if (s.startsWith(r) && /^([FGHJKMNQUVXZ]\d{1,2})?(\d!)?$/.test(s.slice(r.length))) return r;
  return s || "—";
}

/** The profile for a root; pvHint (the journal's point value) wins over the default. */
export function prof(root: string, pvHint = 0): Instrument {
  const s = SPEC[root];
  if (s) return { code: root, name: s[0], pv: pvHint || s[1], tick: s[2], tv: s[3], px: s[4], short: s[5], ccy: s[6], fut: true };
  const r = root, a = r.slice(0, 3), b = r.slice(3);
  if (r.length === 6 && (a === "XAU" || a === "XAG")) return { code: r, name: a === "XAU" ? "SPOT GOLD" : "SPOT SILVER", pv: pvHint || 100, tick: 0.01, tv: "OANDA:" + r, px: "OANDA:" + r, short: a === "XAU" ? "GOLD" : "SILVER", ccy: [b], fut: false };
  if (r.length === 6 && FXC.includes(a) && FXC.includes(b)) return { code: r, name: a + "/" + b, pv: pvHint || (b === "JPY" ? 1000 : 100000), tick: b === "JPY" ? 0.001 : 0.00001, tv: "FX:" + r, px: "FX:" + r, short: r, ccy: [a, b], fut: false };
  if (/^(BTC|ETH|SOL|XRP)(USD|USDT)$/.test(r)) return { code: r, name: r.slice(0, 3) + " SPOT", pv: pvHint || 1, tick: 0.01, tv: "BITSTAMP:" + r.replace("USDT", "USD"), px: "BITSTAMP:" + r.replace("USDT", "USD"), short: r.slice(0, 3), ccy: ["USD"], fut: false };
  return { code: r, name: r, pv: pvHint || 1, tick: 0.01, tv: r, px: r, short: r, ccy: ["USD"], fut: false };
}

/** Decimal places in a tick size (0.1 → 1, 0.0000005 → 7). */
export const dec = (x: number): number => { const s = String(x); return s.includes("e-") ? +s.split("e-")[1] : (s.split(".")[1] || "").length; };

/** Map positions for the globe's "local" city marker. */
export const TZXY: Record<string, [number, number] | null> = {
  "Asia/Dubai": [25.2, 55.3], "Asia/Riyadh": [24.7, 46.7], "Asia/Qatar": [25.3, 51.5], "Europe/London": null, "Europe/Paris": [48.9, 2.35], "Europe/Berlin": [52.5, 13.4],
  "Europe/Madrid": [40.4, -3.7], "Europe/Rome": [41.9, 12.5], "Europe/Amsterdam": [52.4, 4.9], "Europe/Zurich": [47.4, 8.5], "Europe/Istanbul": [41, 29], "Europe/Moscow": [55.8, 37.6],
  "Africa/Lagos": [6.5, 3.4], "Africa/Johannesburg": [-26.2, 28], "Africa/Cairo": [30, 31.2], "Asia/Kolkata": [19, 72.8], "Asia/Karachi": [24.9, 67], "Asia/Singapore": [1.35, 103.8],
  "Asia/Hong_Kong": [22.3, 114.2], "Asia/Shanghai": [31.2, 121.5], "Asia/Tokyo": null, "Asia/Seoul": [37.6, 127], "Asia/Manila": [14.6, 121], "Asia/Jakarta": [-6.2, 106.8],
  "Australia/Sydney": [-33.9, 151.2], "Australia/Melbourne": [-37.8, 145], "Pacific/Auckland": [-36.8, 174.8], "America/New_York": null, "America/Chicago": null,
  "America/Toronto": [43.7, -79.4], "America/Los_Angeles": [34, -118.2], "America/Denver": [39.7, -105], "America/Phoenix": [33.4, -112], "America/Mexico_City": [19.4, -99.1],
  "America/Sao_Paulo": [-23.5, -46.6], "America/Bogota": [4.7, -74.1], "America/Argentina/Buenos_Aires": [-34.6, -58.4],
};

export const cityOf = (z: string) => (z === "UTC" || z === "Etc/UTC" ? "UTC" : z.split("/").pop()!.replace(/_/g, " ").toUpperCase());
export const okTZ = (z: string) => { try { new Intl.DateTimeFormat("en-US", { timeZone: z }); return !!z; } catch { return false; } };
