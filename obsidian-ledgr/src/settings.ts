import { type App, PluginSettingTab, Setting } from "obsidian";
import { KEYS_URL, LedgrApiError, UPGRADE_URL } from "./api";
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

    new Setting(el).setName("Connect LEDGR").setHeading();
    el.createEl("p", {
      cls: "setting-item-description",
      text: "Paste an API key from LEDGR → Settings → API (needs LEDGR Pro). The key is kept in Obsidian's secret storage on this device. It isn't written into your vault, and it's only sent to ledgrjournal.app.",
    });

    const snap = this.plugin.data.snapshot;
    const me = snap?.data.me;
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
        this.status = { tone: "info", text: "Disconnected. The key and saved data were removed from this device." };
        this.display();
      }));

    new Setting(el).setName("Get an API key").setDesc("Create and revoke keys in LEDGR.")
      .addButton((b) => b.setButtonText("Open LEDGR → API").onClick(() => window.open(KEYS_URL)))
      .addButton((b) => b.setButtonText("Upgrade to LEDGR Pro").onClick(() => window.open(UPGRADE_URL)));
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
      this.status = { tone: "ok", text: `Connected · key "${me.key.name}" · ${me.plan.name}${me.journal ? ` · ${me.journal.trades} trades` : " · no journal synced yet"}` };
      void this.plugin.refresh(true);
    } catch (e) {
      const err = e instanceof LedgrApiError ? e : null;
      this.status = { tone: "bad", text: err?.message ?? "Couldn't connect." };
    }
    this.display();
  }
}
