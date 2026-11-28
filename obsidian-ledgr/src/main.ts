import { Modal, normalizePath, Notice, Platform, Plugin, requestUrl, Setting, TFile, type App, type WorkspaceLeaf } from "obsidian";
import { isoDate, LedgrApiError, LedgrClient, type Transport } from "./api";
import { pollConnect, startConnect, waitForKey, type DeviceCode } from "./connect";
import type { CcSettings, SyncOutcome } from "./cc/app";
import { toEvents, type CalendarAnswer, type CalendarState } from "./cc/calendar";
import { EMPTY_CACHE, syncTrades, type TradeCache } from "./cc/sync";
import { LedgrSettingTab } from "./settings";
import type { PublicTrade } from "./notes/build";
import { createStarter, syncNotes, type NoteSyncResult } from "./notes/sync";
import type { LastFetch } from "./state";
import type { MeResponse } from "./types";
import { CommandCenterView, VIEW_TYPE } from "./view";

/** The API key lives in Obsidian's secret storage on this device, never in the vault or data.json. */
export const SECRET_ID = "ledgr-api-key";
export const VIDEO_FILE = "operator.mp4";
/** Where the plugin downloads the intro video from on first run (the plugin's GitHub release). Empty: no download. */
export const VIDEO_URL = "";

export const DEFAULT_SETTINGS: CcSettings = { timezone: "", symbol: "AUTO", sound: true, intro: true, tvWidgets: true, notesFolder: "LEDGR", notesAuto: 0, ownWindow: true };

interface PluginData {
  settings: CcSettings;
  me: MeResponse | null;
  /** Command-center state the prototype kept in localStorage: checklist, guard limits, sizer inputs, instrument. */
  cc: Record<string, unknown>;
  calendar: { answer: CalendarAnswer; at: number } | null;
  /** Account id → name, for trade notes. */
  accounts: Record<string, string>;
  /** The starter-vault question was answered (yes or no), so it isn't asked again. */
  starterAsked: boolean;
}
const DEFAULT_DATA: PluginData = { settings: DEFAULT_SETTINGS, me: null, cc: {}, calendar: null, accounts: {}, starterAsked: false };

/** Obsidian's requestUrl (no CORS, works on desktop and mobile), adapted for the API client. */
const transport: Transport = async (req) => {
  const res = await requestUrl({ url: req.url, method: req.method, headers: req.headers, body: req.body, throw: false });
  let json: unknown = null;
  try { json = res.json; } catch { /* not JSON */ }
  return { status: res.status, headers: res.headers, json };
};

export default class LedgrPlugin extends Plugin {
  data: PluginData = structuredClone(DEFAULT_DATA);
  client!: LedgrClient;
  last: LastFetch | null = null;
  private cache: TradeCache | null = null;
  private running: Promise<SyncOutcome> | null = null;
  private listeners = new Set<(what: "state" | "settings") => void>();
  private saveTimer = 0;

  async onload() {
    const saved = ((await this.loadData()) ?? {}) as Partial<PluginData>;
    this.data = { ...structuredClone(DEFAULT_DATA), ...saved, settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) } };
    this.pruneChecklists();
    this.client = new LedgrClient({ transport, getKey: () => this.getKey() });

    this.registerView(VIEW_TYPE, (leaf: WorkspaceLeaf) => new CommandCenterView(leaf, this));
    this.addRibbonIcon("activity", "Open LEDGR Command Center", () => void this.openView());
    this.addCommand({ id: "open-command-center", name: "Open Command Center", callback: () => void this.openView() });
    this.addCommand({ id: "sync", name: "Sync trades now", callback: () => void this.sync(true) });
    this.addCommand({ id: "sync-notes", name: "Sync trades to notes", callback: () => void this.syncToNotes(true) });
    this.addCommand({ id: "create-starter", name: "Create starter trading vault", callback: () => void this.starter() });
    this.scheduleNotes();
    this.addSettingTab(new LedgrSettingTab(this.app, this));
  }

  onunload() { this.listeners.clear(); window.clearTimeout(this.saveTimer); window.clearInterval(this.notesTimer); }

  // ------------------------------------------------------------------ key

  getKey(): string | null {
    const v = this.app.secretStorage?.getSecret(SECRET_ID);
    return v && v.trim() ? v.trim() : null;
  }

  setKey(key: string | null) {
    this.app.secretStorage.setSecret(SECRET_ID, key ?? "");
    this.client.clear();
    this.last = null;
    this.emit("state");
  }

  /** Forget the key and everything downloaded from LEDGR (trades cache, profile, calendar). */
  async disconnect() {
    this.app.secretStorage.setSecret(SECRET_ID, "");
    this.client.clear();
    this.last = null;
    this.data.me = null;
    this.data.calendar = null;
    this.cache = { ...EMPTY_CACHE };
    await this.saveData(this.data);
    const p = this.cachePath();
    if (await this.app.vault.adapter.exists(p)) await this.app.vault.adapter.remove(p);
    this.emit("state");
  }

  // ------------------------------------------------------------------ settings and small state

  cfg() { return this.data.settings; }
  async updateSettings(patch: Partial<CcSettings>) {
    this.data.settings = { ...this.data.settings, ...patch };
    await this.saveData(this.data);
    if ("notesAuto" in patch) this.scheduleNotes();
    this.emit("settings");
  }

  /** Command-center state, saved shortly after each change. */
  store = {
    get: <T>(key: string, fallback: T): T => (key in this.data.cc ? (structuredClone(this.data.cc[key]) as T) : fallback),
    set: (key: string, value: unknown) => {
      this.data.cc[key] = structuredClone(value);
      window.clearTimeout(this.saveTimer);
      this.saveTimer = window.setTimeout(() => void this.saveData(this.data), 400);
    },
  };

  /** The checklist keeps one entry per day; only the last week is kept. */
  private pruneChecklists() {
    const cutoff = isoDate(new Date(Date.now() - 7 * 86_400_000));
    for (const k of Object.keys(this.data.cc)) if (k.startsWith("cc_ck_") && k !== "cc_ck_items" && k.slice(6) < cutoff) delete this.data.cc[k];
  }

  // ------------------------------------------------------------------ trades

  private cachePath() { return normalizePath(`${this.manifest.dir}/trades-cache.json`); }

  private async readCache(): Promise<TradeCache> {
    if (this.cache) return this.cache;
    try {
      const raw = await this.app.vault.adapter.read(this.cachePath());
      this.cache = { ...EMPTY_CACHE, ...(JSON.parse(raw) as TradeCache) };
    } catch {
      this.cache = { ...EMPTY_CACHE };
    }
    return this.cache;
  }

  /** Cached trades for an instant render (null before the first sync). */
  cachedTrades(): { trades: TradeCache["trades"]; at: number } | null {
    return this.cache && this.cache.lastSync ? { trades: this.cache.trades, at: this.cache.lastSync } : null;
  }
  async loadCache() { await this.readCache(); }

  /** Syncs /me and the trades (new ones only, unless full). Several callers share one run. */
  sync(full = false): Promise<SyncOutcome> {
    if (this.running) return this.running;
    this.running = (async (): Promise<SyncOutcome> => {
      const cache = await this.readCache();
      const before = this.last;
      try {
        this.data.me = await this.client.me({ fresh: true });
        const next = await syncTrades((p) => this.client.get(p, { fresh: true }), cache, Date.now(), isoDate(new Date()), full);
        this.cache = next;
        await this.app.vault.adapter.write(this.cachePath(), JSON.stringify(next));
        await this.saveData(this.data);
        this.last = { ok: true, at: Date.now() };
        return { ok: true, trades: next.trades, at: next.lastSync };
      } catch (e) {
        const err = e instanceof LedgrApiError ? e : new LedgrApiError("server", "Something went wrong.");
        this.last = { ok: false, at: Date.now(), errorKind: err.kind, message: err.message };
        if (full && err.kind === "rate_limited") new Notice("LEDGR: too many requests. Try again in a minute.");
        return { ok: false, kind: err.kind, message: err.message, trades: cache.lastSync ? cache.trades : null, at: cache.lastSync || null };
      } finally {
        this.running = null;
        // Only views care when the lock state changes (locked ↔ unlocked).
        const was = before && !before.ok ? before.errorKind : null, now = this.last && !this.last.ok ? this.last.errorKind : null;
        if (was !== now) this.emit("state");
      }
    })();
    return this.running;
  }

  // ------------------------------------------------------------------ trades as notes

  private notesTimer = 0;
  private notesRunning: Promise<NoteSyncResult | null> | null = null;

  /** Automatic note sync every N minutes (setting), while Obsidian is open. */
  private scheduleNotes() {
    window.clearInterval(this.notesTimer);
    const m = this.data.settings.notesAuto;
    if (m > 0) { this.notesTimer = window.setInterval(() => void this.syncToNotes(false), m * 60_000); this.registerInterval(this.notesTimer); }
  }

  private notesFolder() { return normalizePath(this.data.settings.notesFolder.trim() || "LEDGR"); }

  private async noteCtx() {
    try {
      const a = await this.client.get<{ accounts: { id: string; name: string }[] }>("/accounts", { fresh: true });
      this.data.accounts = Object.fromEntries(a.accounts.map((x) => [x.id, x.name]));
    } catch { /* offline: last known names */ }
    const tz = this.data.settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    return { root: this.notesFolder(), tz, accounts: this.data.accounts, currency: this.data.me?.journal?.currency ?? "USD" };
  }

  /** Syncs trades from LEDGR, then writes them as notes. loud: show a notice with the result. */
  syncToNotes(loud: boolean): Promise<NoteSyncResult | null> {
    if (this.notesRunning) return this.notesRunning;
    this.notesRunning = (async () => {
      try {
        if (!this.getKey()) { if (loud) new Notice("LEDGR: connect your API key in Settings → LEDGR first."); return null; }
        const s = await this.sync(false);
        if (!s.ok && !s.trades) { if (loud) new Notice(`LEDGR: ${s.message}`); return null; }
        const trades = (s.ok ? s.trades : s.trades!) as unknown as PublicTrade[];
        const ctx = await this.noteCtx();
        const today = isoDate(new Date());
        const r = await syncNotes(this.app, trades, ctx, today);
        await this.saveData(this.data);
        if (loud) new Notice(`LEDGR: ${r.trades} trades · ${r.created} notes created, ${r.updated} updated${r.deleted ? `, ${r.deleted} marked deleted` : ""}${s.ok ? "" : " (from the offline copy)"}.`);
        if (loud && !this.data.starterAsked) { this.data.starterAsked = true; await this.saveData(this.data); new StarterModal(this.app, () => void this.starter()).open(); }
        return r;
      } catch (e) {
        if (loud) new Notice(`LEDGR: couldn't write the notes (${(e as Error).message}).`);
        return null;
      } finally {
        this.notesRunning = null;
      }
    })();
    return this.notesRunning;
  }

  /** Creates the starter vault (asks first when run from the command palette). */
  async starter() {
    const ctx = await this.noteCtx();
    const trades = (this.cachedTrades()?.trades ?? []) as unknown as PublicTrade[];
    const made = await createStarter(this.app, trades, ctx, isoDate(new Date()));
    this.data.starterAsked = true;
    await this.saveData(this.data);
    new Notice(made.length ? `LEDGR: created ${made.join(", ")}. Set Settings → Templates → Template folder location to "${ctx.root}/Templates" to use the daily template.` : "LEDGR: the starter files are already there.");
  }

  // ------------------------------------------------------------------ calendar

  /** GET /api/v1/calendar. 404 means LEDGR doesn't serve one yet. Last good answer is reused offline. */
  async calendar(): Promise<CalendarState> {
    const saved = this.data.calendar;
    const fromSaved = (stale: boolean): CalendarState | null => (saved ? { kind: "ok", events: toEvents(saved.answer), updatedAt: saved.answer.updatedAt ?? new Date(saved.at).toISOString(), source: saved.answer.source ?? null, stale } : null);
    try {
      const answer = await this.client.get<CalendarAnswer>("/calendar", { fresh: true });
      this.data.calendar = { answer, at: Date.now() };
      await this.saveData(this.data);
      return { kind: "ok", events: toEvents(answer), updatedAt: answer.updatedAt ?? new Date().toISOString(), source: answer.source ?? null, stale: false };
    } catch (e) {
      const err = e as LedgrApiError;
      if (err.status === 404) return { kind: "missing" };
      return fromSaved(true) ?? { kind: "error", message: err.message ?? "Couldn't load the calendar." };
    }
  }

  // ------------------------------------------------------------------ intro video (separate file in the plugin folder)

  private videoPath() { return normalizePath(`${this.manifest.dir}/${VIDEO_FILE}`); }

  /** The statue video's URL, downloading it once if it isn't in the plugin folder yet (and a download URL is set). */
  async videoUrl(): Promise<string | null> {
    const p = this.videoPath(), a = this.app.vault.adapter;
    if (!(await a.exists(p)) && VIDEO_URL) {
      try {
        const res = await requestUrl({ url: VIDEO_URL });
        if (res.status === 200 && res.arrayBuffer.byteLength > 1000) await a.writeBinary(p, res.arrayBuffer);
      } catch { /* offline: the panel shows without the statue */ }
    }
    return (await a.exists(p)) ? a.getResourcePath(p) : null;
  }

  // ------------------------------------------------------------------ helpers for the view

  subscribe(fn: (what: "state" | "settings") => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit(what: "state" | "settings") { this.listeners.forEach((fn) => fn(what)); }

  /**
   * Opens the Command Center clean, like the standalone version: on desktop in its own window with no tabs or
   * sidebars (setting "Open in its own window"); otherwise as a tab with the side panels folded away.
   */
  async openView() {
    const ws = this.app.workspace, existing = ws.getLeavesOfType(VIEW_TYPE)[0];
    if (existing) { await ws.revealLeaf(existing); return; }
    const ownWindow = Platform.isDesktopApp && this.data.settings.ownWindow;
    const leaf = ws.getLeaf(ownWindow ? "window" : "tab");
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    if (!ownWindow) { ws.leftSplit.collapse(); ws.rightSplit.collapse(); }
    await ws.revealLeaf(leaf);
  }

  openSettings() {
    // The settings window isn't in Obsidian's public API; this is the usual way plugins open their own tab.
    const setting = (this.app as unknown as { setting?: { open(): void; openTabById(id: string): void } }).setting;
    setting?.open();
    setting?.openTabById(this.manifest.id);
  }

  /** VAULT button: the vault's home note, if there is one. */
  async openVaultHome() {
    for (const path of ["LEDGR/Home.md", "Home.md", "00 Home.md"]) {
      const f = this.app.vault.getAbstractFileByPath(path);
      if (f instanceof TFile) { await this.app.workspace.getLeaf(false).openFile(f); return; }
    }
    new Notice("No Home note in this vault yet.");
  }

  /** "Connect with LEDGR": shows a code, opens LEDGR to approve it, and saves the key it gets. Resolves true when connected. */
  connectWithLedgr(): Promise<boolean> {
    return new Promise((resolve) => new ConnectModal(this.app, this, resolve).open());
  }

  /** Steps of the connect flow, for the modal. */
  connectSteps = {
    start: () => startConnect(transport, `Obsidian (${this.app.vault.getName()})`.slice(0, 40)),
    wait: (code: DeviceCode, cancelled: () => boolean) =>
      waitForKey({ code, poll: (d) => pollConnect(transport, d), sleep: (ms) => new Promise((r) => window.setTimeout(r, ms)), now: Date.now, cancelled }),
    finish: async (key: string) => {
      this.setKey(key);
      this.data.me = await this.client.me({ fresh: true });
      await this.saveData(this.data);
      void this.sync(false);
    },
  };

  ask(title: string): Promise<string | null> {
    return new Promise((resolve) => new AskModal(this.app, title, resolve).open());
  }
}

/** A one-line text prompt (Obsidian has no window.prompt). */
class AskModal extends Modal {
  private value = "";
  private done = false;
  constructor(app: App, private title: string, private resolve: (v: string | null) => void) { super(app); }
  onOpen() {
    this.setTitle(this.title);
    const submit = () => { this.done = true; this.resolve(this.value); this.close(); };
    new Setting(this.contentEl).addText((t) => {
      t.onChange((v) => (this.value = v));
      t.inputEl.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
      window.setTimeout(() => t.inputEl.focus(), 0);
    }).addButton((b) => b.setButtonText("Add").setCta().onClick(submit));
  }
  onClose() { if (!this.done) this.resolve(null); this.contentEl.empty(); }
}

/** Asked once, after the first note sync. */
class StarterModal extends Modal {
  constructor(app: App, private onYes: () => void) { super(app); }
  onOpen() {
    this.setTitle("Set up a trading vault?");
    this.contentEl.createEl("p", { text: "LEDGR can add a starter structure: a Home dashboard that updates on every sync, PARA folders (Projects, Areas, Resources, Archive) and a daily trading-note template. Nothing that already exists is changed." });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText("Create it").setCta().onClick(() => { this.close(); this.onYes(); }))
      .addButton((b) => b.setButtonText("No thanks").onClick(() => this.close()));
    this.contentEl.createEl("p", { cls: "setting-item-description", text: "You can create it later with the command \"LEDGR: Create starter trading vault\"." });
  }
  onClose() { this.contentEl.empty(); }
}

/** Shows the code to approve in LEDGR and waits for the approval. */
class ConnectModal extends Modal {
  private cancelled = false;
  private ok = false;
  constructor(app: App, private plugin: LedgrPlugin, private resolve: (ok: boolean) => void) { super(app); }

  async onOpen() {
    this.setTitle("Connect with LEDGR");
    const el = this.contentEl;
    const status = el.createEl("p", { text: "Getting a code…" });
    try {
      const code = await this.plugin.connectSteps.start();
      if (this.cancelled) return;
      status.setText("Approve this code in LEDGR. It's opening in your browser now:");
      const box = el.createDiv({ cls: "ledgr-connect-code", text: code.user_code });
      box.setAttr("aria-label", `Code ${code.user_code.split("").join(" ")}`);
      const waiting = el.createEl("p", { cls: "setting-item-description", text: "Waiting for you to approve… (the code works for 15 minutes)" });
      new Setting(el)
        .addButton((b) => b.setButtonText("Open LEDGR again").onClick(() => window.open(code.verification_uri_complete)))
        .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
      window.open(code.verification_uri_complete);
      const key = await this.plugin.connectSteps.wait(code, () => this.cancelled);
      if (!key) return;
      waiting.setText("Approved. Connecting…");
      await this.plugin.connectSteps.finish(key);
      this.ok = true;
      new Notice("LEDGR: connected.");
      this.close();
    } catch (e) {
      if (this.cancelled) return;
      status.setText((e as Error).message || "Couldn't connect.");
      status.addClass("mod-warning");
    }
  }

  onClose() { this.cancelled = true; this.contentEl.empty(); this.resolve(this.ok); }
}
