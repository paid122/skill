import { ItemView, setIcon, type WorkspaceLeaf } from "obsidian";
import { UPGRADE_URL } from "./api";
import { money, num, pct, r, tone } from "./format";
import type LedgrPlugin from "./main";
import { ago, viewState, type ViewState } from "./state";
import type { Dashboard } from "./types";

export const VIEW_TYPE = "ledgr-command-center";
const REFRESH_MS = 5 * 60_000;

export class CommandCenterView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private plugin: LedgrPlugin) { super(leaf); }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "LEDGR Command Center"; }
  getIcon() { return "activity"; }

  async onOpen() {
    this.register(this.plugin.subscribe(() => this.render()));
    // Refresh every 5 minutes while open; redraw every 30 s so "updated … ago" stays right.
    this.registerInterval(window.setInterval(() => void this.plugin.refresh(), REFRESH_MS));
    this.registerInterval(window.setInterval(() => this.render(), 30_000));
    this.render();
    void this.plugin.refresh();
  }

  async onClose() { this.contentEl.empty(); }

  private state(): ViewState {
    const p = this.plugin;
    return viewState(!!p.getKey(), p.data.snapshot, p.last, p.loading, Date.now());
  }

  render() {
    const el = this.contentEl;
    el.empty();
    el.addClass("ledgr-cc");
    const s = this.state();
    this.header(el, s);
    if (s.kind === "connect") return this.screen(el, "plug", "Connect LEDGR", "Add your LEDGR API key to see your journal here.", [["Open settings", () => this.openSettings()]]);
    if (s.kind === "loading") return this.screen(el, "loader", "Loading your journal…", "", []);
    if (s.kind === "locked") {
      const invalid = s.reason === "invalid_key";
      return this.screen(el, "lock", invalid ? "API key not accepted" : "LEDGR Pro required",
        invalid ? `${s.message} Create a new key in LEDGR → Settings → API.` : `${s.message} The Command Center comes with LEDGR Pro.`,
        invalid ? [["Open settings", () => this.openSettings()]] : [["Upgrade to LEDGR Pro", () => window.open(UPGRADE_URL)], ["Open settings", () => this.openSettings()]],
        "locked");
    }
    if (s.kind === "no_journal") return this.screen(el, "cloud-off", "No journal in the cloud yet", `${s.message}`, [["Refresh", () => void this.plugin.refresh(true)]]);
    if (s.kind === "error") return this.screen(el, "alert-triangle", "Couldn't load LEDGR", s.message, [["Try again", () => void this.plugin.refresh(true)]]);
    this.dashboard(el, s.data, s);
  }

  // ------------------------------------------------------------------ parts

  private header(el: HTMLElement, s: ViewState) {
    const h = el.createDiv({ cls: "ledgr-cc-header" });
    const title = h.createDiv({ cls: "ledgr-cc-title" });
    title.createSpan({ cls: "ledgr-cc-logo", text: "LEDGR" });
    title.createSpan({ cls: "ledgr-cc-sub", text: "// COMMAND CENTER" });
    const right = h.createDiv({ cls: "ledgr-cc-header-right" });
    if (s.kind === "data") {
      const chip = right.createSpan({ cls: `ledgr-cc-chip ${s.live ? "is-live" : "is-stale"}` });
      chip.setText(s.live ? "LIVE" : "STALE");
      right.createSpan({ cls: "ledgr-cc-muted", text: `updated ${ago(s.fetchedAt, Date.now())}` });
    }
    const btn = right.createEl("button", { cls: "ledgr-cc-btn", attr: { "aria-label": "Refresh" } });
    setIcon(btn, "refresh-cw");
    if (this.plugin.loading) btn.addClass("is-spinning");
    btn.onclick = () => void this.plugin.refresh(true);
  }

  private screen(el: HTMLElement, icon: string, title: string, body: string, actions: [string, () => void][], cls = "") {
    const box = el.createDiv({ cls: `ledgr-cc-screen ${cls}` });
    setIcon(box.createDiv({ cls: "ledgr-cc-screen-icon" }), icon);
    box.createEl("h3", { text: title });
    if (body) box.createEl("p", { text: body });
    const row = box.createDiv({ cls: "ledgr-cc-actions" });
    actions.forEach(([label, fn], i) => { const b = row.createEl("button", { text: label, cls: i === 0 ? "mod-cta" : "" }); b.onclick = fn; });
  }

  private dashboard(el: HTMLElement, d: Dashboard, s: Extract<ViewState, { kind: "data" }>) {
    const cur = d.me.journal?.currency ?? "USD";
    if (s.warning) el.createDiv({ cls: "ledgr-cc-warning", text: `${s.warning} Last updated ${ago(s.fetchedAt, Date.now())}.` });

    const sec = (name: string) => { const box = el.createDiv({ cls: "ledgr-cc-panel" }); box.createDiv({ cls: "ledgr-cc-panel-title", text: name }); return box; };
    const tiles = (box: HTMLElement, items: [string, string, string?][]) => {
      const grid = box.createDiv({ cls: "ledgr-cc-tiles" });
      for (const [label, value, t] of items) {
        const tile = grid.createDiv({ cls: "ledgr-cc-tile" });
        tile.createDiv({ cls: "ledgr-cc-tile-label", text: label });
        tile.createDiv({ cls: `ledgr-cc-tile-value ${t ?? ""}`, text: value });
      }
    };

    const a = d.stats;
    tiles(sec("ALL TIME"), [
      ["NET P&L", money(a.net, cur, { sign: true }), tone(a.net)],
      ["WIN RATE", pct(a.winRate)],
      ["PROFIT FACTOR", num(a.profitFactor)],
      ["AVG R", r(a.avgR), tone(a.avgR)],
      ["MAX DRAWDOWN", money(a.maxDrawdown, cur), tone(a.maxDrawdown)],
      ["TRADES", String(a.closed)],
    ]);
    const m = d.stats30;
    tiles(sec("LAST 30 DAYS"), [
      ["NET P&L", money(m.net, cur, { sign: true }), tone(m.net)],
      ["WIN RATE", pct(m.winRate)],
      ["PROFIT FACTOR", num(m.profitFactor)],
      ["AVG R", r(m.avgR), tone(m.avgR)],
      ["TRADING DAYS", String(m.tradingDays)],
      ["TRADES", String(m.closed)],
    ]);

    const acc = sec("ACCOUNTS");
    if (!d.accounts.length) acc.createDiv({ cls: "ledgr-cc-muted", text: "No active accounts." });
    for (const x of d.accounts) {
      const row = acc.createDiv({ cls: "ledgr-cc-row" });
      const left = row.createDiv();
      left.createDiv({ cls: "ledgr-cc-row-name", text: x.name });
      left.createDiv({ cls: "ledgr-cc-muted", text: [x.type, x.propFirm].filter(Boolean).join(" · ") });
      const right = row.createDiv({ cls: "ledgr-cc-row-right" });
      right.createDiv({ cls: "ledgr-cc-row-value", text: money(x.balance, x.currency) });
      right.createDiv({ cls: `ledgr-cc-small ${tone(x.netPnl)}`, text: money(x.netPnl, x.currency, { sign: true }) });
    }

    const foot = el.createDiv({ cls: "ledgr-cc-footer" });
    const j = d.me.journal;
    foot.createSpan({ text: j ? `Journal synced ${ago(Date.parse(j.syncedAt), Date.now())} · ${j.trades} trades` : "" });
    foot.createSpan({ text: `${d.me.plan.name}${d.me.plan.until ? ` until ${new Date(d.me.plan.until).toLocaleDateString()}` : ""}` });
  }

  private openSettings() {
    // The settings window isn't in Obsidian's public API; this is the common way plugins open their own tab.
    const setting = (this.app as unknown as { setting?: { open(): void; openTabById(id: string): void } }).setting;
    setting?.open();
    setting?.openTabById(this.plugin.manifest.id);
  }
}
