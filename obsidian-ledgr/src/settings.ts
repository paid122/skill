import { type App, PluginSettingTab, Setting } from "obsidian";
import { KEYS_URL, LedgrApiError, UPGRADE_URL } from "./api";
import { okTZ, SPEC } from "./cc/instruments";
import type LedgrPlugin from "./main";

export const KEY_PATTERN = /^ledgr_sk_[A-Za-z0-9_-]{20,}$/;

export class LedgrSettingTab extends PluginSettingTab {
  private draft = "";
  private status: { tone: "ok" | "bad" | "info"; text: string } | null = null;

  constructor(app: App, private plugin: LedgrPlugin) { super(app, plugin); }

  display() {
    const { containerEl: el } = this;
    el.empty();
    const connected = !!this.plugin.getKey();
    const s = this.plugin.cfg();

    new Setting(el).setName("Connect LEDGR").setHeading();
    el.createEl("p", {
      cls: "setting-item-description",
      text: "Paste an API key from LEDGR → Settings → API (needs LEDGR Pro). The key is kept in Obsidian's secret storage on this device. It isn't written into your vault, and it's only sent to ledgrjournal.app.",
    });

    const me = this.plugin.data.me;
    const statusEl = el.createDiv({ cls: "ledgr-settings-status" });
    const line = this.status ?? (connected
      ? me ? { tone: "ok" as const, text: `Connected · key "${me.key.name}" · ${me.plan.name}${me.plan.until ? ` until ${new Date(me.plan.until).toLocaleDateString()}` : ""}` } : { tone: "info" as const, text: "Key saved. Press Test connection." }
      : { tone: "info" as const, text: "Not connected." });
    statusEl.addClass(`is-${line.tone}`);
    statusEl.setText(line.text);

    new Setting(el)
      .setName("API key")
      .setDesc(connected ? "A key is saved. Paste a new one to replace it." : "Starts with ledgr_sk_.")
      .addText((t) => {
        t.inputEl.type = "password";
        t.inputEl.autocomplete = "off";
        t.setPlaceholder(connected ? "ledgr_sk_… (saved)" : "ledgr_sk_…").setValue(this.draft).onChange((v) => { this.draft = v.trim(); });
      })
      .addButton((b) => b.setButtonText("Test connection").setCta().onClick(() => void this.test()))
      .addButton((b) => b.setButtonText("Disconnect").setWarning().setDisabled(!connected).onClick(async () => {
        await this.plugin.disconnect();
        this.draft = "";
        this.status = { tone: "info", text: "Disconnected. The key and the downloaded trades were removed from this device." };
        this.display();
      }));

    new Setting(el).setName("Get an API key").setDesc("Create and revoke keys in LEDGR.")
      .addButton((b) => b.setButtonText("Open LEDGR → API").onClick(() => window.open(KEYS_URL)))
      .addButton((b) => b.setButtonText("Upgrade to LEDGR Pro").onClick(() => window.open(UPGRADE_URL)));

    // ------------------------------------------------------------------ command center
    new Setting(el).setName("Command Center").setHeading();
    const sysTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    let tzWarn: HTMLElement;
    new Setting(el).setName("Time zone").setDesc(`Clocks, the session radar, today's trades and the calendar. Leave empty to use this device's (${sysTz}).`)
      .addText((t) => t.setPlaceholder(sysTz).setValue(s.timezone).onChange(async (v) => {
        v = v.trim();
        if (v && !okTZ(v)) { tzWarn.setText(`Unknown time zone "${v}". Use a name like Asia/Dubai or America/New_York.`); return; }
        tzWarn.setText("");
        await this.plugin.updateSettings({ timezone: v });
      }));
    tzWarn = el.createDiv({ cls: "setting-item-description mod-warning" });

    new Setting(el).setName("Default instrument").setDesc("AUTO uses the instrument you trade most. The ACCOUNT panel's menu switches it any time.")
      .addDropdown((d) => {
        d.addOption("AUTO", "AUTO (most traded)");
        Object.entries(SPEC).forEach(([k, v]) => d.addOption(k, `${k} · ${v[0]}`));
        d.setValue(s.symbol || "AUTO").onChange(async (v) => { await this.plugin.updateSettings({ symbol: v }); this.plugin.store.set("cc_ins", v); });
      });

    new Setting(el).setName("Sound").setDesc("Interface sounds, news alerts and the risk-guard alarm (made in the app, no audio files).")
      .addToggle((t) => t.setValue(s.sound).onChange((v) => void this.plugin.updateSettings({ sound: v })));
    new Setting(el).setName("Intro").setDesc("Play the ENGAGE intro when the Command Center opens. The BOOT button plays it any time.")
      .addToggle((t) => t.setValue(s.intro).onChange((v) => void this.plugin.updateSettings({ intro: v })));
    new Setting(el).setName("Live TradingView widgets").setDesc("Ticker tape, quote, charts, news and sentiment from tradingview.com, in sandboxed frames. Off: no connection to TradingView.")
      .addToggle((t) => t.setValue(s.tvWidgets).onChange((v) => void this.plugin.updateSettings({ tvWidgets: v })));
  }

  private async test() {
    if (this.draft) {
      if (!KEY_PATTERN.test(this.draft)) { this.status = { tone: "bad", text: "That doesn't look like a LEDGR key. Keys start with ledgr_sk_." }; return this.display(); }
      this.plugin.setKey(this.draft);
      this.draft = "";
    }
    if (!this.plugin.getKey()) { this.status = { tone: "bad", text: "Paste your API key first." }; return this.display(); }
    this.status = { tone: "info", text: "Testing…" };
    this.display();
    try {
      const me = await this.plugin.client.me({ fresh: true });
      this.plugin.data.me = me;
      this.status = { tone: "ok", text: `Connected · key "${me.key.name}" · ${me.plan.name}${me.journal ? ` · ${me.journal.trades} trades` : " · no journal synced yet"}` };
      void this.plugin.sync(false);
    } catch (e) {
      const err = e instanceof LedgrApiError ? e : null;
      this.status = { tone: "bad", text: err?.message ?? "Couldn't connect." };
    }
    this.display();
  }
}
