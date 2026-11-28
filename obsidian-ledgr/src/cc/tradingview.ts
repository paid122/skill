/**
 * TradingView widgets as plain iframes on TradingView's own domains. No TradingView <script> ever runs in the
 * plugin's page: the iframe URLs below are exactly what TradingView's embed scripts generate
 * (checked against embed-widget-*.js and tv.js).
 *
 * Sandbox: allow-same-origin is needed because the widgets call TradingView's APIs and refuse an opaque ("null")
 * origin. Because the src is cross-origin, it only grants TradingView's own origin: the frame still can't reach
 * the plugin's DOM, storage, the vault or Node.
 */

export const TV_SANDBOX = "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox";
export const TV_ATTRIBUTION = "https://www.tradingview.com/";
const EMBED = "https://www.tradingview-widget.com/embed-widget/";

type Cfg = Record<string, unknown>;

/** Defaults the embed script adds, per widget (width/height when the config doesn't give them). */
const SIZE: Record<string, { width: string | number; height: string | number }> = {
  "ticker-tape": { width: "100%", height: 84 },
  "single-quote": { width: "100%", height: 101 },
  "advanced-chart": { width: "100%", height: "100%" },
  timeline: { width: "100%", height: "100%" },
  "technical-analysis": { width: "100%", height: "100%" },
};
/** Height of the iframe element itself, as the embed script sets it. */
const FRAME_HEIGHT: Record<string, string> = { "ticker-tape": "86px", "single-quote": "69px" };

/** The embed URL for a widget. Key order matches the script: the config, then size, then utm fields. */
export function embedUrl(name: string, cfg: Cfg): string {
  const { locale, ...rest } = cfg as Cfg & { locale?: string };
  const full: Cfg = { ...rest };
  if (name === "timeline") delete full.feedMode; // the script moves the symbol feed into the query string
  const size = SIZE[name] ?? { width: "100%", height: "100%" };
  if (full.width === undefined) full.width = size.width;
  if (full.height === undefined) full.height = size.height;
  Object.assign(full, { utm_source: "", utm_medium: "widget", utm_campaign: name, "page-uri": "__NHTTP__" });
  if (full.autosize) { full.width = "100%"; full.height = "100%"; }
  const query = name === "timeline" ? `?symbol=${encodeURIComponent(String(cfg.symbol ?? ""))}` : `?locale=${locale ?? "en"}`;
  return EMBED + name + "/" + query + "#" + encodeURIComponent(JSON.stringify(full));
}

/** The full advanced chart (tv.js's TradingView.widget), used on the CHART tab. */
export function chartUrl(o: { symbol: string; interval: string; timezone: string; theme: string; style: string; locale: string; backgroundColor: string; gridColor: string; hide_side_toolbar: boolean; allow_symbol_change: boolean; withdateranges: boolean; overrides: Record<string, string>; frameId: string }): string {
  const hash: Cfg = {
    symbol: o.symbol, frameElementId: o.frameId, interval: o.interval, hide_side_toolbar: o.hide_side_toolbar ? "1" : "0",
    allow_symbol_change: o.allow_symbol_change ? "1" : "0", save_image: "1", backgroundColor: o.backgroundColor, gridColor: o.gridColor,
    studies: "[]", theme: o.theme, style: o.style, timezone: o.timezone, withdateranges: o.withdateranges ? "1" : "0", studies_overrides: "{}",
    utm_medium: "widget", utm_campaign: "chart", utm_term: o.symbol, "page-uri": "__NHTTP__",
  };
  const q = `hideideas=1&overrides=${encodeURIComponent(JSON.stringify(o.overrides))}&enabled_features=${encodeURIComponent("[]")}&disabled_features=${encodeURIComponent("[]")}&locale=${o.locale}`;
  return `https://s.tradingview.com/widgetembed/?${q}#${encodeURIComponent(JSON.stringify(hash))}`;
}

/** Puts a sandboxed TradingView iframe into el, laid out like the embed script's container. */
export function mountWidget(el: HTMLElement, name: string, cfg: Cfg): HTMLIFrameElement {
  el.empty();
  const wrap = el.createDiv({ cls: "tradingview-widget-container" });
  const h = FRAME_HEIGHT[name];
  wrap.setCssStyles({ width: "100%", height: h ?? "100%" });
  const f = frame(wrap, embedUrl(name, cfg), `${name.replace(/-/g, " ")} TradingView widget`);
  f.setCssStyles({ height: h ?? "100%" });
  return f;
}

export function mountChart(el: HTMLElement, url: string, frameId: string): HTMLIFrameElement {
  el.empty();
  const wrap = el.createDiv();
  wrap.setCssStyles({ position: "relative", boxSizing: "content-box", width: "100%", height: "100%", margin: "0 auto", padding: "0" });
  const f = frame(wrap, url, "advanced chart TradingView widget");
  f.id = frameId;
  f.setAttribute("allowfullscreen", "true");
  return f;
}

function frame(parent: HTMLElement, src: string, title: string): HTMLIFrameElement {
  const f = parent.createEl("iframe");
  f.setAttribute("sandbox", TV_SANDBOX);
  f.setAttribute("referrerpolicy", "no-referrer");
  f.setAttribute("scrolling", "no");
  f.setAttribute("allowtransparency", "true");
  f.setAttribute("frameborder", "0");
  f.setAttribute("loading", "lazy");
  f.title = title;
  f.lang = "en";
  f.setCssStyles({ userSelect: "none", boxSizing: "border-box", display: "block", width: "100%", height: "100%", border: "0" });
  f.src = src;
  return f;
}
