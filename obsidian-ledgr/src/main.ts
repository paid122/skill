import { Notice, Plugin, requestUrl, type WorkspaceLeaf } from "obsidian";
import { LedgrApiError, LedgrClient, type Transport } from "./api";
import { LedgrSettingTab } from "./settings";
import type { LastFetch } from "./state";
import type { Snapshot } from "./types";
import { CommandCenterView, VIEW_TYPE } from "./view";

/** The API key lives in Obsidian's secret storage on this device, never in the vault or data.json. */
export const SECRET_ID = "ledgr-api-key";

interface PluginData { snapshot: Snapshot | null }
const DEFAULT_DATA: PluginData = { snapshot: null };

/** Obsidian's requestUrl (no CORS, works on desktop and mobile), adapted for the API client. */
const transport: Transport = async (req) => {
  const res = await requestUrl({ url: req.url, method: req.method, headers: req.headers, body: req.body, throw: false });
  let json: unknown = null;
  try { json = res.json; } catch { /* not JSON */ }
  return { status: res.status, headers: res.headers, json };
};

export default class LedgrPlugin extends Plugin {
  data: PluginData = { ...DEFAULT_DATA };
  client!: LedgrClient;
  last: LastFetch | null = null;
  loading = false;
  private running: Promise<void> | null = null;
  private listeners = new Set<() => void>();

  async onload() {
    this.data = { ...DEFAULT_DATA, ...((await this.loadData()) as Partial<PluginData> | null) };
    this.client = new LedgrClient({ transport, getKey: () => this.getKey() });

    this.registerView(VIEW_TYPE, (leaf: WorkspaceLeaf) => new CommandCenterView(leaf, this));
    this.addRibbonIcon("activity", "Open LEDGR Command Center", () => void this.openView());
    this.addCommand({ id: "open-command-center", name: "Open Command Center", callback: () => void this.openView() });
    this.addCommand({ id: "refresh", name: "Refresh data", callback: () => void this.refresh(true) });
    this.addSettingTab(new LedgrSettingTab(this.app, this));
  }

  onunload() { this.listeners.clear(); }

  // ------------------------------------------------------------------ key

  getKey(): string | null {
    const v = this.app.secretStorage?.getSecret(SECRET_ID);
    return v && v.trim() ? v.trim() : null;
  }

  setKey(key: string | null) {
    this.app.secretStorage.setSecret(SECRET_ID, key ?? "");
    this.client.clear();
    this.last = null;
  }

  /** Forget the key and the saved data. */
  async disconnect() {
    this.setKey(null);
    this.data.snapshot = null;
    await this.saveData(this.data);
    this.emit();
  }

  // ------------------------------------------------------------------ data

  /** Fetches everything (fresh = skip the 60-second cache). Several callers share one fetch. */
  refresh(fresh = false): Promise<void> {
    if (this.running) return this.running;
    if (!this.getKey()) { this.emit(); return Promise.resolve(); }
    this.loading = true;
    this.emit();
    this.running = (async () => {
      try {
        const data = await this.client.dashboard(new Date(), { fresh });
        this.data.snapshot = { data, fetchedAt: Date.now() };
        this.last = { ok: true, at: Date.now() };
        await this.saveData(this.data);
      } catch (e) {
        const err = e instanceof LedgrApiError ? e : new LedgrApiError("server", "Something went wrong.");
        this.last = { ok: false, at: Date.now(), errorKind: err.kind, message: err.message };
        if (fresh && err.kind === "rate_limited") new Notice("LEDGR: too many requests. Try again in a minute.");
      } finally {
        this.loading = false;
        this.running = null;
        this.emit();
      }
    })();
    return this.running;
  }

  subscribe(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit() { this.listeners.forEach((fn) => fn()); }

  async openView() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf("tab");
    if (!existing) await leaf.setViewState({ type: VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }
}
