import { ItemView, setIcon, type WorkspaceLeaf } from "obsidian";
import { UPGRADE_URL } from "./api";
import { CommandCenter } from "./cc/app";
import type LedgrPlugin from "./main";
import { mode, type Mode } from "./state";

export const VIEW_TYPE = "ledgr-command-center";

/** Hosts the command center, or the connect / locked screens around it. */
export class CommandCenterView extends ItemView {
  private cc: CommandCenter | null = null;
  private shown: Mode["kind"] | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: LedgrPlugin) { super(leaf); }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "LEDGR Command Center"; }
  getIcon() { return "activity"; }

  async onOpen() {
    await this.plugin.loadCache();
    this.register(this.plugin.subscribe((what) => {
      if (what === "settings") this.cc?.applySettings();
      else this.render();
    }));
    this.render();
  }

  async onClose() { this.unmountCc(); this.contentEl.empty(); }

  private render() {
    const m = mode(!!this.plugin.getKey(), this.plugin.last);
    if (m.kind === "cc" && this.shown === "cc") return; // already running; it updates itself
    this.unmountCc();
    this.shown = m.kind;
    const el = this.contentEl;
    el.empty();
    el.removeClass("ledgr-cc");
    if (m.kind === "cc") {
      this.cc = new CommandCenter(el, {
        settings: () => this.plugin.cfg(),
        setSound: (on) => void this.plugin.updateSettings({ sound: on }),
        store: this.plugin.store,
        name: () => this.plugin.data.me?.journal?.displayName ?? null,
        cached: () => this.plugin.cachedTrades(),
        sync: (full) => this.plugin.sync(full),
        calendar: () => this.plugin.calendar(),
        videoUrl: () => this.plugin.videoUrl(),
        openSettings: () => this.plugin.openSettings(),
        openVaultHome: () => void this.plugin.openVaultHome(),
        ask: (t) => this.plugin.ask(t),
      });
      this.cc.mount();
      return;
    }
    const box = el.createDiv({ cls: "ledgr-lock" });
    if (m.kind === "connect") return this.screen(box, "plug", "Connect LEDGR", "Connect your LEDGR account to load your journal into the Command Center.", [["Connect with LEDGR", () => void this.plugin.connectWithLedgr().then(() => this.render())], ["Open settings", () => this.plugin.openSettings()]]);
    if (m.kind === "no_journal") return this.screen(box, "cloud-off", "No journal in the cloud yet", m.message, [["Try again", () => void this.retry()]]);
    const invalid = m.reason === "invalid_key";
    this.screen(box, "lock", invalid ? "API key not accepted" : "LEDGR Pro required",
      invalid ? `${m.message} Create a new key in LEDGR → Settings → API.` : `${m.message} The Command Center comes with LEDGR Pro.`,
      invalid ? [["Open settings", () => this.plugin.openSettings()], ["Try again", () => void this.retry()]] : [["Upgrade to LEDGR Pro", () => window.open(UPGRADE_URL)], ["Try again", () => void this.retry()]],
      "locked");
  }

  private async retry() { await this.plugin.sync(false); this.render(); }

  private unmountCc() { this.cc?.unmount(); this.cc = null; this.shown = null; }

  private screen(el: HTMLElement, icon: string, title: string, body: string, actions: [string, () => void][], cls = "") {
    const box = el.createDiv({ cls: `ledgr-lock-screen ${cls}` });
    setIcon(box.createDiv({ cls: "ledgr-lock-screen-icon" }), icon);
    box.createEl("h3", { text: title });
    if (body) box.createEl("p", { text: body });
    const row = box.createDiv({ cls: "ledgr-lock-actions" });
    actions.forEach(([label, fn], i) => { const b = row.createEl("button", { text: label, cls: i === 0 ? "mod-cta" : "" }); b.onclick = fn; });
  }
}
