/**
 * The LEDGR Command Center, ported from command-center.html into an Obsidian view.
 * Same markup and CSS (scoped under .ledgr-cc), same panels and behaviour; differences from the prototype:
 *   - data comes from the plugin (cached, synced incrementally) instead of fetch + localStorage
 *   - settings and per-panel state are saved in the plugin's data, the API key in Obsidian's secret storage
 *   - TradingView widgets are sandboxed iframes (src on TradingView), never scripts in this page
 *   - the calendar comes from LEDGR instead of Forex Factory
 *   - everything stops when the view closes, and keyboard shortcuts only work while the view has focus
 */
import { calendarText } from "./calendarText";
import type { CalendarState } from "./calendar";
import { barChart, lineChart } from "./canvas/charts";
import { createBrain } from "./canvas/brain";
import { createFigure } from "./canvas/figure";
import { createGlobe } from "./canvas/globe";
import { createIntro } from "./canvas/intro";
import { createRadar } from "./canvas/radar";
import { cityOf, dec, okTZ, prof, type Instrument } from "./instruments";
import { Life } from "./life";
import {
  behaviour, brainLabels, cd, closedOf, cls, crossed, esc, fmtT, focusOf, groupBy, GUARD_DEFAULT, guardState, instrumentsOf, money, newsClear, norm, S,
  sessOf, sizeFor, SIZING_DEFAULT, smoney, zone, type ApiTrade, type CalEvent, type Guard, type Trade, type Zone,
} from "./logic";
import { cmeNext, cmeOpen } from "./market";
import { Sound } from "./sound";
import { TEMPLATE } from "./template";
import { chartUrl, mountChart, mountWidget, TV_ATTRIBUTION } from "./tradingview";

export interface CcSettings {
  timezone: string; symbol: string; sound: boolean; intro: boolean; tvWidgets: boolean;
  /** Trades as notes: vault folder, and minutes between automatic note syncs (0 = only when asked). */
  notesFolder: string; notesAuto: number;
  /** Desktop: open the Command Center in its own window, with no Obsidian tabs or sidebars around it. */
  ownWindow: boolean;
}

export type SyncOutcome =
  | { ok: true; trades: ApiTrade[]; at: number }
  | { ok: false; kind: string; message: string; trades: ApiTrade[] | null; at: number | null };

export interface Host {
  settings(): CcSettings;
  setSound(on: boolean): void;
  store: { get<T>(key: string, fallback: T): T; set(key: string, value: unknown): void };
  /** The trader's first name from LEDGR (/me), if known. */
  name(): string | null;
  /** Cached trades from the last sync, for an instant offline-first render. */
  cached(): { trades: ApiTrade[]; at: number } | null;
  sync(full: boolean): Promise<SyncOutcome>;
  calendar(): Promise<CalendarState>;
  videoUrl(): Promise<string | null>;
  openSettings(): void;
  openVaultHome(): void;
  ask(title: string): Promise<string | null>;
}

/** Smallest layout size before the command center is scaled down (the prototype was built for 1600x900). */
const DESIGN_H = 900, DESIGN_W = 1400;
const TABS = ["main", "markets", "journal", "perf", "chart", "risk", "news", "brain"];
const CK_DEF = ["Higher-timeframe bias marked", "Key levels drawn", "Setup is in my playbook", "Stop and target set before entry", "Size from the calculator, not a guess", "Calm, not chasing or revenge trading"];
const TV_LINK = `<a class="tvattr" href="${TV_ATTRIBUTION}" target="_blank" rel="noopener">TRADINGVIEW</a>`;

export class CommandCenter {
  readonly life: Life;
  private sound = new Sound();
  private $ = (id: string) => this.root.querySelector<HTMLElement>("#" + id)!;

  // state, as in the prototype
  private TZN: string;
  private Z: Zone;
  private NAME = "TRADER";
  private ALLTR: Trade[] = [];
  private TR: Trade[] = [];
  private INSSEL: string;
  private INSLIST: string[] = [];
  private CUR: Instrument = prof("MGC");
  private calM: [number, number] | null = null;
  private LOG = ["LEDGR KERNEL 1.0 ............ OK", "MOUNT /journal ............... OK", "CME GLOBEX FEED .............. LINKED", "RISK ENGINE .................. ARMED", "NEURAL MAP ................... 7 NODES", "DECRYPTING OPERATOR .......... TRADER"];
  private FF: CalEvent[] | null = null;
  private cal: CalendarState = { kind: "missing" };
  private FFC = "USD";
  private FFI = 2;
  private ffRunKey = "";
  private ALERT_PREV: Record<string, number> = {};
  private RG: Guard;
  private PS: typeof SIZING_DEFAULT;
  private CK: string[];
  private lastLevel = "";
  private widgetsLoaded = false;
  private newsLoaded = false;
  private chartLoaded = false;
  private loading = false;
  private loadedEarly = false;
  private brain!: ReturnType<typeof createBrain>;
  private drawGlobe!: (t: number) => void;
  private drawRadar!: (t: number) => void;
  private drawFig!: (t: number) => void;
  private intro!: ReturnType<typeof createIntro>;

  constructor(private root: HTMLElement, private host: Host) {
    this.life = new Life(root.ownerDocument.defaultView ?? window);
    const s = host.settings();
    this.TZN = s.timezone && okTZ(s.timezone) ? s.timezone : Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    this.Z = zone(this.TZN);
    this.INSSEL = host.store.get("cc_ins", s.symbol || "AUTO");
    this.RG = { ...GUARD_DEFAULT, ...host.store.get<Partial<Guard>>("cc_guard", {}) };
    this.PS = { ...SIZING_DEFAULT, ...host.store.get<Partial<typeof SIZING_DEFAULT>>("cc_pos", {}) };
    this.CK = host.store.get("cc_ck_items", CK_DEF.slice());
    this.sound.pref = s.sound;
    this.setName(host.name());
  }

  // ================================================================== mount / unmount

  mount() {
    const { root, life } = this;
    root.empty();
    root.addClass("ledgr-cc");
    root.tabIndex = -1; // focusable, so keyboard shortcuts only apply while the command center has focus
    // Everything sits on a "stage" laid out at the design size or larger, and scaled down to fit smaller windows,
    // so every panel fits its frame like the 1600x900 original instead of being cut off.
    this.stage = root.createDiv({ cls: "ledgr-cc-stage" });
    const doc = new DOMParser().parseFromString(`<div>${TEMPLATE}</div>`, "text/html");
    for (const n of Array.from(doc.body.firstElementChild!.childNodes)) this.stage.appendChild(root.ownerDocument.adoptNode(n));
    this.fitStage();
    ["figCv", "brainCv", "globeCv", "eqCv", "sessCv", "setupCv"].forEach((id) => (this.$(id).dataset.flex = "1"));

    const tipEl = this.$("tip");
    const tip = {
      show: (e: MouseEvent, html: string) => {
        const r = this.stage.getBoundingClientRect(), k = r.width / (this.stage.offsetWidth || r.width);
        tipEl.innerHTML = html; // callers escape journal text
        tipEl.style.display = "block";
        tipEl.style.left = Math.min(this.stage.offsetWidth - 220, (e.clientX - r.left) / k + 12) + "px";
        tipEl.style.top = (e.clientY - r.top) / k + 12 + "px";
      },
      hide: () => { tipEl.style.display = "none"; },
    };
    this.brain = createBrain(this.$("brainCv") as HTMLCanvasElement, this.$("brainChips"), life, tip);
    this.drawGlobe = createGlobe(this.$("globeCv") as HTMLCanvasElement, () => this.TZN);
    this.drawRadar = createRadar(this.$("radarCv") as HTMLCanvasElement, () => this.Z);
    this.drawFig = createFigure(this.$("figCv") as HTMLCanvasElement, this.$("figVid") as HTMLVideoElement, life);

    void this.host.videoUrl().then((url) => {
      if (!url || !life.alive) return;
      (this.$("figVid") as HTMLVideoElement).src = url;
      (this.$("introVid") as HTMLVideoElement).src = url;
    });

    this.wire();
    this.initRisk();
    this.intro = createIntro({
      $: this.$, root, life, sound: this.sound, log: () => this.LOG, name: () => this.NAME, cur: () => this.CUR,
      stats: () => this.introStats(), session: () => sessOf(new Date()), powerOn: () => this.powerOn(),
      onStart: () => { if (!this.loadedEarly) { this.loadedEarly = true; void this.load(false); } },
      onFly: () => this.loadWidgets(),
      onEnd: () => { this.loadWidgets(); if (!this.loadedEarly) { this.loadedEarly = true; void this.load(false); } this.renderData(); },
    });

    // offline-first: show cached trades straight away
    const c = this.host.cached();
    if (c) { this.ALLTR = c.trades.map(norm); this.buildIns(); this.setLink(false, "CACHED"); this.syncPanel("STALE", "down", `${this.TR.length} trades · cached ${new Date(c.at).toLocaleString("en-GB")}`); }
    else this.buildIns();
    this.applyLabels();
    this.setSndBtn();
    this.renderData();
    this.tick();
    life.every(1000, () => this.tick());
    void this.calLoad();
    life.every(10 * 60e3, () => void this.calLoad());
    life.every(1000, () => { this.ffRender(); this.checkAlerts(); });
    life.every(5 * 60e3, () => void this.load(false)); // new trades every 5 minutes while open
    life.frame((t) => this.loop(t));

    if (this.host.settings().intro) this.intro.showGate();
    else this.intro.skip();
  }

  unmount() {
    this.disconnectObserver?.();
    this.life.dispose();
    this.sound.close();
    this.root.empty();
  }

  /** Settings changed in the plugin's settings tab. */
  applySettings() {
    const s = this.host.settings();
    const tz = s.timezone && okTZ(s.timezone) ? s.timezone : Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    if (tz !== this.TZN) { this.TZN = tz; this.Z = zone(tz); this.calM = null; this.renderData(); }
    this.sound.pref = s.sound;
    if (!s.sound) this.sound.on = false;
    this.setSndBtn();
    this.refreshMarket(true);
    this.applyLabels();
  }

  setName(n: string | null) {
    const first = String(n ?? "").trim().split(/\s+/)[0];
    this.NAME = (first || "TRADER").toUpperCase();
    this.LOG[5] = this.padL("DECRYPTING OPERATOR", this.NAME);
  }

  // ================================================================== data

  private async load(full: boolean) {
    if (this.loading) return;
    this.loading = true;
    this.setLink(null, "SYNCING…");
    try {
      const r = await this.host.sync(full);
      if (!this.life.alive) return;
      this.setName(this.host.name());
      if (r.ok) {
        this.ALLTR = r.trades.map(norm);
        this.buildIns();
        this.setLink(true, "LINK ONLINE");
        this.syncPanel("ONLINE", "up", `${this.TR.length} trades · as of LEDGR's last sync`);
        this.$("syncT").textContent = new Date(r.at).toLocaleTimeString("en-GB");
      } else {
        if (r.trades) { this.ALLTR = r.trades.map(norm); this.buildIns(); }
        const rejected = r.kind === "invalid_key" || r.kind === "not_pro";
        this.setLink(false, rejected ? "KEY REJECTED" : r.trades ? "LINK LOST · CACHED" : "LINK LOST");
        this.syncPanel(r.trades ? "STALE" : "OFFLINE", "down", r.trades && r.at ? `${r.message} Showing trades cached ${new Date(r.at).toLocaleString("en-GB")}.` : r.message);
      }
    } finally {
      this.loading = false;
    }
    this.renderData();
  }

  private syncPanel(state: string, tone: string, sub: string) {
    this.$("syncState").textContent = state;
    this.$("syncState").className = "big " + tone;
    this.$("syncSub").textContent = sub;
  }

  private buildIns() {
    const { list, cnt } = instrumentsOf(this.ALLTR);
    this.INSLIST = list;
    const sel = this.$("insSel") as HTMLSelectElement;
    sel.empty();
    const opt = (v: string, t: string) => sel.createEl("option", { value: v, text: t });
    opt("AUTO", `AUTO · ${list[0] || "—"}`);
    list.forEach((k) => opt(k, `${k} · ${cnt[k]}`));
    if (list.length > 1) opt("ALL", `ALL SYMBOLS · ${this.ALLTR.length}`);
    if (this.INSSEL !== "AUTO" && this.INSSEL !== "ALL" && !list.includes(this.INSSEL)) this.INSSEL = "AUTO";
    if (this.INSSEL === "ALL" && list.length < 2) this.INSSEL = "AUTO";
    sel.value = this.INSSEL;
    this.setIns(this.INSSEL, true);
  }

  private setIns(v: string, quiet?: boolean) {
    this.INSSEL = v;
    this.host.store.set("cc_ins", v);
    const { trades, cur } = focusOf(this.ALLTR, this.INSLIST, v, this.host.settings().symbol && this.host.settings().symbol !== "AUTO" ? this.host.settings().symbol : "MGC");
    this.TR = trades;
    const changed = cur.px !== this.CUR.px || cur.tv !== this.CUR.tv;
    this.CUR = cur;
    this.applyLabels();
    if (changed) this.refreshMarket();
    if (!quiet) { this.renderData(); this.renderRisk(); }
  }

  private closed() { return closedOf(this.TR); }

  private introStats() {
    const c = this.closed();
    if (!c.length) return null;
    const s = S(c);
    return { net: smoney(s.net), win: isFinite(s.win) ? (s.win * 100).toFixed(1) + "%" : "—", pf: s.pf === Infinity ? "∞" : isFinite(s.pf) ? s.pf.toFixed(2) : "—", n: String(s.n), dd: s.dd ? "-" + money(s.dd).replace("-", "") : "—", r: isFinite(s.avgR) ? (s.avgR > 0 ? "+" : "") + s.avgR.toFixed(2) + "R" : "—" };
  }

  // ================================================================== labels

  private padL(a: string, b: string) { return a + " " + ".".repeat(Math.max(3, 29 - a.length - b.length)) + " " + b; }

  private setTZLabels() {
    const c = cityOf(this.TZN);
    this.root.querySelectorAll<HTMLElement>("[data-tzl]").forEach((e) => (e.textContent = e.dataset.tzl!.replace("@", c)));
  }

  private applyLabels() {
    const set = (id: string, h: string) => { const e = this.$(id); if (e) e.innerHTML = h; };
    const C = this.CUR, pvTxt = money(C.pv).replace(".00", ""), tk = C.tick, tkD = Math.max(0, dec(tk));
    set("opSub", esc(this.NAME) + " · " + esc(C.code));
    set("chartHd", `${esc(C.fut ? C.code + "1!" : C.code)} · ${esc(C.name)} <span>${TV_LINK}</span>`);
    set("liveHd", `LIVE ${esc(C.short)} · ${esc(C.px.split(":").pop())} <span>5M · ${TV_LINK}</span>`);
    set("quoteHd", `${esc(C.short)} · LIVE <span>${esc(C.px.replace(":", " · "))}</span>`);
    set("newsHd", `${esc(C.short)} NEWS FEED <span>${TV_LINK} · LIVE</span>`);
    set("sentHd", `SENTIMENT · ${esc(C.px.split(":").pop())} <span>TECHNICAL RATING</span>`);
    set("posHd", `POSITION SIZE · ${esc(C.code)} <span>${esc(pvTxt)} / POINT</span>`);
    set("specK", `<span class="k">CONTRACT</span><span class="v">${esc(C.code)} · ${esc(C.name)}</span><span class="k">TICK</span><span class="v">${tk.toFixed(tkD)} = ${money(tk * C.pv)}</span><span class="k">POINT</span><span class="v">${esc(pvTxt)} / ${C.fut ? "CONTRACT" : "UNIT"}</span>`);
    ["pEn", "pSt"].forEach((id) => { const e = this.$(id) as HTMLInputElement; if (e) e.step = String(tk); });
    this.LOG[1] = this.padL("MOUNT /journal/" + C.code.toLowerCase(), "OK");
    this.LOG[5] = this.padL("DECRYPTING OPERATOR", this.NAME);
    this.setTZLabels();
  }

  private setLink(ok: boolean | null, t: string) {
    this.$("linkDot").className = "dot" + (ok === true ? " ok" : ok === false ? " bad" : "");
    this.$("linkTxt").textContent = t;
  }

  // ================================================================== panels

  private renderData() {
    this.life.after(0, () => this.renderGuard());
    const $ = this.$, c = this.closed(), s = S(c), Z = this.Z;
    $("kNet").textContent = smoney(s.net); $("kNet").className = "big " + cls(s.net);
    $("kWin").textContent = isFinite(s.win) ? (s.win * 100).toFixed(1) + "%" : "—";
    $("kPF").textContent = s.pf === Infinity ? "∞" : isFinite(s.pf) ? s.pf.toFixed(2) : "—";
    $("kR").textContent = isFinite(s.avgR) ? (s.avgR > 0 ? "+" : "") + s.avgR.toFixed(2) + "R" : "—";
    $("kDD").textContent = s.dd ? "-" + money(s.dd).replace("-", "") : "—";
    $("kN").textContent = s.n ? String(s.n) : "—";
    const L = S(c.filter((t) => t.dir === "long")), Sh = S(c.filter((t) => t.dir === "short"));
    $("lsL").innerHTML = `<span class="${cls(L.net)}">${smoney(L.net)}</span> · ${L.n}`;
    $("lsS").innerHTML = `<span class="${cls(Sh.net)}">${smoney(Sh.net)}</span> · ${Sh.n}`;
    const tot = L.n + Sh.n || 1;
    $("lsBarL").style.width = (L.n / tot) * 100 + "%"; $("lsBarS").style.width = (Sh.n / tot) * 100 + "%";
    const tk = Z.dayKey(new Date()), td = c.filter((t) => Z.dayKey(t.time!) === tk), tr = td.map((t) => t.r).filter(isFinite);
    $("tdN").textContent = String(td.length);
    const tn = td.reduce((a, t) => a + t.net, 0);
    $("tdNet").textContent = smoney(tn); $("tdNet").className = "v " + cls(tn);
    $("tdR").textContent = tr.length ? tr.reduce((a, b) => a + b, 0).toFixed(2) + "R" : "—";
    const recent = [...c].reverse().slice(0, 7);
    $("feed").innerHTML = recent.length
      ? recent.map((t) => `<div><span class="t">${Z.local(t.time!).toISOString().slice(11, 16)}</span><span>${t.dir === "long" ? "▲" : "▼"} ${esc(t.sym)} ×${isFinite(t.qty) ? t.qty : 1}</span><span class="${cls(t.net)}">${smoney(t.net)}</span></div>`).join("")
      : '<div class="note">No trades yet.</div>';
    $("logCount").textContent = c.length + " CLOSED";
    $("logT").innerHTML = `<tr><th>TIME (LOCAL)</th><th>SIDE</th><th class="n">QTY</th><th class="n">ENTRY</th><th class="n">EXIT</th><th class="n">PTS</th><th class="n">R</th><th>SETUP</th><th class="n">NET</th></tr>` +
      [...c].reverse().slice(0, 150).map((t) => `<tr><td>${Z.local(t.time!).toISOString().slice(5, 16).replace("T", " ")}</td><td>${t.dir.toUpperCase()}</td><td class="n">${isFinite(t.qty) ? t.qty : "—"}</td><td class="n">${isFinite(t.en) ? t.en.toFixed(1) : "—"}</td><td class="n">${isFinite(t.ex) ? t.ex.toFixed(1) : "—"}</td><td class="n ${cls(t.pts)}">${isFinite(t.pts) ? t.pts.toFixed(1) : "—"}</td><td class="n ${cls(t.r)}">${isFinite(t.r) ? t.r.toFixed(2) : "—"}</td><td>${esc(t.setup)}</td><td class="n ${cls(t.net)}">${smoney(t.net)}</td></tr>`).join("");
    this.renderCal();
    this.renderPsyche();
    this.brain.setLabels(brainLabels(c));
    this.drawStatic();
  }

  private renderCal() {
    const c = this.closed(), Z = this.Z, days: Record<string, number> = {}, cnt: Record<string, number> = {};
    c.forEach((t) => { const k = Z.dayKey(t.time!); days[k] = (days[k] || 0) + t.net; cnt[k] = (cnt[k] || 0) + 1; });
    if (!this.calM) { const d = c.length ? Z.local(c[c.length - 1].time!) : Z.local(new Date()); this.calM = [d.getUTCFullYear(), d.getUTCMonth()]; }
    const [y, m] = this.calM;
    this.$("calTitle").textContent = new Date(Date.UTC(y, m, 1)).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).toUpperCase();
    let h = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d) => `<div style="min-height:0;border:0;text-align:center">${d}</div>`).join("");
    const f = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7, n = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    for (let i = 0; i < f; i++) h += '<div style="border:0"></div>';
    for (let d = 1; d <= n; d++) {
      const k = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, v = days[k];
      h += `<div class="${v > 0 ? "g" : v < 0 ? "r" : ""}">${d}${v != null ? `<b class="${cls(v)}">${smoney(v).replace(".00", "")}</b>${cnt[k]}T` : ""}</div>`;
    }
    this.$("cal").innerHTML = h;
  }

  private renderPsyche() {
    const c = this.closed(), Z = this.Z;
    if (!c.length) { this.$("psyche").innerHTML = '<div class="note">Connect your LEDGR key to build the report from your trades.</div>'; return; }
    const sess = groupBy(c, (t) => sessOf(t.tin || t.time!)), setups = groupBy(c, (t) => t.setup);
    const hours = groupBy(c, (t) => String(Z.local(t.tin || t.time!).getUTCHours()).padStart(2, "0") + ":00");
    const dows = groupBy(c, (t) => ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][Z.local(t.time!).getUTCDay()]);
    const { tilt, bigL } = behaviour(c);
    const line = (lbl: string, val: string | number, txt?: string) => `<tr><td style="color:var(--mut);width:160px">${lbl}</td><td>${val}</td><td style="color:var(--mut)">${txt || ""}</td></tr>`;
    const last = <T>(a: T[]) => a[a.length - 1];
    this.$("psyche").innerHTML = `<table>${line("STRONGEST SESSION", `<span class="up">${sess[0].k}</span>`, smoney(sess[0].net) + " · " + sess[0].n + " trades")}${line("WEAKEST SESSION", `<span class="down">${last(sess).k}</span>`, smoney(last(sess).net))}
    ${line("BEST SETUP", `<span class="up">${esc(setups[0].k)}</span>`, smoney(setups[0].net) + " · win " + (isFinite(setups[0].win) ? (setups[0].win * 100).toFixed(0) : "—") + "%")}${line("WORST SETUP", `<span class="down">${esc(last(setups).k)}</span>`, smoney(last(setups).net))}
    ${line("BEST HOUR (LOCAL)", hours[0].k, smoney(hours[0].net))}${line("WORST HOUR (LOCAL)", last(hours).k, smoney(last(hours).net))}${line("BEST DAY", dows[0].k, smoney(dows[0].net))}
    ${line("QUICK RE-ENTRIES AFTER A LOSS", tilt, "trades within 20 min of a losing trade")}${line("LOSSES BEYOND -1.2R", bigL, "stops not respected")}</table>
    <div class="note" style="margin-top:12px">Worked out from your LEDGR trades. Patterns need a decent sample, so read these as hints rather than verdicts.</div>`;
  }

  private drawStatic() {
    const c = this.closed(), Z = this.Z;
    let eq = 0;
    const all = c.map((t) => (eq += t.net));
    const since = Date.now() - 30 * 864e5;
    let e2 = 0;
    const last30 = c.filter((t) => +t.time! >= since).map((t) => (e2 += t.net));
    lineChart(this.$("spark") as HTMLCanvasElement, last30.length > 1 ? last30 : all.slice(-40));
    if (this.$("v-perf").classList.contains("on")) {
      lineChart(this.$("eqCv") as HTMLCanvasElement, all, c.length ? [Z.dayKey(c[0].time!), Z.dayKey(c[c.length - 1].time!)] : null);
      const grp = (f: (t: Trade) => string) => { const m: Record<string, number> = {}; c.forEach((t) => { const k = f(t); m[k] = (m[k] || 0) + t.net; }); return Object.entries(m).map(([k, v]) => ({ k, v })); };
      const bySess = grp((t) => sessOf(t.tin || t.time!));
      barChart(this.$("sessCv") as HTMLCanvasElement, ["ASIA", "LONDON", "NEW YORK"].map((k) => ({ k, v: (bySess.find((r) => r.k === k) || { v: 0 }).v })).filter(() => c.length > 0));
      barChart(this.$("setupCv") as HTMLCanvasElement, grp((t) => t.setup).sort((a, b) => b.v - a.v).slice(0, 8));
    }
  }

  // ================================================================== tabs, clock, loop

  private wire() {
    const { root, life, $ } = this;
    $("tabs").onclick = (e) => { const t = (e.target as HTMLElement).closest<HTMLElement>(".tab"); if (t) this.openTab(t); };
    $("calPrev").onclick = () => { const m = this.calM!; this.calM = m[1] ? [m[0], m[1] - 1] : [m[0] - 1, 11]; this.renderCal(); };
    $("calNext").onclick = () => { const m = this.calM!; this.calM = m[1] < 11 ? [m[0], m[1] + 1] : [m[0] + 1, 0]; this.renderCal(); };
    ($("insSel") as HTMLSelectElement).onchange = () => this.setIns(($("insSel") as HTMLSelectElement).value);
    $("refreshBtn").onclick = () => void this.load(true);
    $("replayBtn").onclick = () => this.intro.showGate();
    $("keyBtn").onclick = () => this.host.openSettings();
    root.querySelector<HTMLElement>('[data-action="vault"]')!.onclick = (e) => { e.preventDefault(); this.host.openVaultHome(); };
    $("guardChip").onclick = () => this.openTab(root.querySelector<HTMLElement>('.tab[data-v="risk"]')!);
    $("sndBtn").onclick = () => {
      const on = !this.sound.pref;
      this.sound.pref = on; this.host.setSound(on);
      this.sound.on = on && !!this.sound.AC;
      this.setSndBtn();
      if (on) { this.sound.audio(); void this.sound.AC?.resume(); this.sound.on = true; this.sound.blip(); }
    };
    // calendar dropdown
    $("ffBtn").onclick = $("ffTick").onclick = $("ffLogo").onclick = (e) => { e.preventDefault(); $("ffPanel").classList.toggle("on"); this.ffList(); };
    life.on(root, "click", (e) => {
      const t = e.target as HTMLElement;
      if ($("ffPanel").classList.contains("on") && !t.closest("#ffPanel,#ff")) $("ffPanel").classList.remove("on");
      if (t.closest(".ic,.chip,.btn,.ck")) this.sound.blip();
    });
    root.querySelectorAll<HTMLElement>(".fffil .chip[data-c]").forEach((c) => (c.onclick = () => { this.FFC = c.dataset.c!; root.querySelectorAll(".fffil .chip[data-c]").forEach((x) => x.classList.toggle("on", x === c)); this.ffRunKey = ""; this.ffRender(); this.ffList(); }));
    root.querySelectorAll<HTMLElement>(".fffil .chip[data-i]").forEach((c) => (c.onclick = () => { this.FFI = +c.dataset.i!; root.querySelectorAll(".fffil .chip[data-i]").forEach((x) => x.classList.toggle("on", x === c)); this.ffRunKey = ""; this.ffRender(); this.ffList(); }));
    // sound unlocks on the first gesture; focus so the number keys work
    life.on(root, "pointerdown", () => { this.sound.unlock(); if (!root.contains(root.ownerDocument.activeElement)) root.focus({ preventScroll: true }); }, true);
    life.on(root, "keydown", (e) => {
      const target = e.target as HTMLElement;
      if (target.closest("input,textarea,select") || this.intro.isRunning() || e.metaKey || e.ctrlKey || e.altKey) return;
      const tabs = Array.from(root.querySelectorAll<HTMLElement>(".tab")), i = +e.key - 1;
      if (i >= 0 && i < tabs.length) { e.preventDefault(); this.openTab(tabs[i]); }
    });
    // redraw charts when the pane changes size; widgets back when the connection returns
    let rz = 0;
    const ro = new (life.win as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver(() => { this.fitStage(); life.clear(rz); rz = life.after(150, () => this.drawStatic()); });
    ro.observe(root);
    life.on(life.win, "online", () => this.refreshMarket(true));
    life.on(life.win, "offline", () => this.refreshMarket(true));
    this.disconnectObserver = () => ro.disconnect();
  }
  private disconnectObserver: (() => void) | null = null;
  private stage!: HTMLElement;

  /** Scale the stage so the layout never gets shorter than 900 px or narrower than 1400 px. */
  private fitStage() {
    const W = this.root.clientWidth, H = this.root.clientHeight;
    if (!W || !H) return;
    const k = Math.min(1, H / DESIGN_H, W / DESIGN_W);
    this.stage.setCssStyles({ width: `${W / k}px`, height: `${H / k}px`, transform: k < 1 ? `scale(${k})` : "" });
  }

  private openTab(t: HTMLElement) {
    const { root } = this;
    root.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x === t));
    root.querySelectorAll(".view").forEach((v) => v.classList.toggle("on", v.id === "v-" + t.dataset.v));
    if (t.dataset.v === "chart") this.loadChart();
    if (t.dataset.v === "news") this.loadNews();
    if (t.dataset.v === "risk") this.renderRisk();
    this.drawStatic();
    this.sound.blip();
  }

  private tick() {
    const $ = this.$, now = new Date(), Z = this.Z;
    $("clock").textContent = fmtT(this.TZN);
    $("nyT").textContent = fmtT("America/New_York"); $("ldT").textContent = fmtT("Europe/London"); $("tkT").textContent = fmtT("Asia/Tokyo");
    $("dateTxt").textContent = Z.local(now).toISOString().slice(0, 10).split("-").reverse().join(".");
    $("todayDate").textContent = $("dateTxt").textContent;
    $("mkLocal").textContent = "LOCAL " + fmtT(this.TZN) + " · NY " + fmtT("America/New_York");
    const o = cmeOpen();
    $("cmeState").textContent = o ? "OPEN" : "CLOSED"; $("cmeState").className = "big " + (o ? "up" : "down");
    $("cmeNext").textContent = cmeNext();
    this.$("sessNow").textContent = sessOf(new Date());
  }

  private loop(t: number) {
    const shown = this.root.getClientRects().length > 0; // pause drawing while the pane is hidden
    if (shown) {
      if (this.$("v-main").classList.contains("on")) { this.brain.draw(t); this.drawFig(t); }
      if (this.$("v-markets").classList.contains("on")) this.drawGlobe(t);
      this.drawRadar(t);
    }
    this.life.frame((x) => this.loop(x));
  }

  private powerOn() {
    const els = Array.from(this.root.querySelectorAll<HTMLElement>(".panel:not(#ffPanel),.tab,.ic,.brand")).filter((el) => el.offsetParent !== null);
    els.forEach((el, i) => { el.classList.remove("pwr"); void el.offsetWidth; el.style.animationDelay = i * 38 + "ms"; el.classList.add("pwr"); });
    this.life.after(els.length * 38 + 700, () => els.forEach((el) => { el.classList.remove("pwr"); el.style.animationDelay = ""; }));
  }

  private setSndBtn() { this.$("sndBtn").textContent = this.sound.pref ? "SND ON" : "SND OFF"; }

  // ================================================================== economic calendar

  private async calLoad() {
    const s = await this.host.calendar();
    if (!this.life.alive) return;
    this.cal = s;
    this.FF = s.kind === "ok" ? s.events : null;
    const src = this.$("calSrc") as HTMLAnchorElement;
    if (s.kind === "ok" && s.source) { src.textContent = `${s.source.name.toUpperCase()} ↗`; src.href = s.source.url; src.style.display = ""; }
    this.ffRunKey = "";
    this.ffRender(); this.ffList(); this.renderHi();
  }

  private ffPass = (e: CalEvent) => (this.FFC === "ALL" || e.country === this.FFC) && e.i >= this.FFI;
  private hhmm = (d: Date) => this.Z.local(d).toISOString().slice(11, 16);

  private ffRender() {
    const tick = this.$("ffTick");
    if (!this.FF) { const t = calendarText(this.cal).ticker; if (tick.textContent !== t) { tick.empty(); tick.createSpan({ cls: "ffmut", text: t }); } return; }
    const now = Date.now(), ev = this.FF.filter(this.ffPass), next = ev.find((e) => +e.t > now), just = ev.filter((e) => now - +e.t < 30 * 60e3 && +e.t <= now);
    const impDots = (n: number) => "●".repeat(n) + "○".repeat(3 - n);
    let head = "";
    if (next) { const ms = +next.t - now, warn = next.i === 3 && ms < 15 * 60e3; head = `<span class="ffnext ${warn ? "ffwarn" : ""}">${warn ? "⚠ " : ""}NEXT <b>${esc(next.country)} ${esc(next.title)}</b> <span class="imp">${impDots(next.i)}</span> IN <b>${cd(ms)}</b>${next.forecast ? ` · F ${esc(next.forecast)}` : ""}${next.previous ? ` · P ${esc(next.previous)}` : ""}</span>`; }
    else head = '<span class="ffnext ffmut">NO MORE EVENTS THIS WEEK</span>';
    const today = this.Z.dayKey(new Date()), rest = ev.filter((e) => this.Z.dayKey(e.t) === today && e !== next);
    const runKey = rest.map((e) => e.title + e.date).join("|") + just.length;
    const items = [
      ...just.map((e) => `<span style="margin-right:28px">JUST RELEASED · <b>${esc(e.country)} ${esc(e.title)}</b> ${this.hhmm(e.t)}</span>`),
      ...rest.map((e) => `<span style="margin-right:28px" class="${+e.t < now ? "ffmut" : ""}">${this.hhmm(e.t)} <span class="imp">${impDots(e.i)}</span><b>${esc(e.country)}</b> ${esc(e.title)}${e.forecast ? " · F " + esc(e.forecast) : ""}</span>`),
    ];
    let hd = tick.querySelector<HTMLElement>(".ffhead");
    if (!hd) { tick.innerHTML = '<span class="ffhead" style="position:relative;z-index:1;background:rgba(14,14,14,.95);padding-right:10px"></span><span class="ffrunwrap" style="position:absolute;left:0;right:0;top:0;bottom:0;overflow:hidden"></span>'; hd = tick.querySelector<HTMLElement>(".ffhead")!; }
    hd.innerHTML = head;
    const wrap = tick.querySelector<HTMLElement>(".ffrunwrap")!;
    wrap.style.left = hd.offsetWidth + 8 + "px";
    if (runKey !== this.ffRunKey) { this.ffRunKey = runKey; wrap.innerHTML = items.length ? `<span class="ffrun">${items.join("")}</span>` : '<span class="ffmut" style="line-height:28px">TODAY: NOTHING ELSE SCHEDULED</span>'; wrap.style.lineHeight = "28px"; }
    const up = this.cal.kind === "ok" ? this.cal.updatedAt : null;
    this.$("ffUpd").textContent = up ? "UPDATED " + this.Z.local(new Date(up)).toISOString().slice(5, 16).replace("T", " ") + (this.cal.kind === "ok" && this.cal.stale ? " · STALE" : "") : "";
  }

  private ffList() {
    const list = this.$("ffList");
    if (!this.FF) { list.empty(); list.createDiv({ cls: "note", text: calendarText(this.cal).list }); return; }
    const now = Date.now(), ev = this.FF.filter(this.ffPass), impDots = (n: number) => "●".repeat(n) + "○".repeat(3 - n);
    let h = '<div class="ev hd"><span>TIME</span><span>CUR</span><span>IMP</span><span>EVENT</span><span>FCST</span><span>PREV</span></div>', day = "";
    ev.forEach((e) => {
      const d = this.Z.local(e.t).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).toUpperCase();
      if (d !== day) { day = d; h += `<div class="day">${d}</div>`; }
      const ms = +e.t - now;
      h += `<div class="ev ${ms < 0 ? "past" : ms < 60 * 60e3 ? "soon" : ""}"><span>${this.hhmm(e.t)}</span><span>${esc(e.country)}</span><span class="imp">${impDots(e.i)}</span><span>${esc(e.title)}</span><span>${esc(e.forecast || "")}</span><span>${esc(e.previous || "")}</span></div>`;
    });
    list.innerHTML = ev.length ? h : '<div class="note">No events match these filters.</div>';
  }

  private renderHi() {
    const el = this.$("hiList");
    if (!el) return;
    if (!this.FF) { el.empty(); el.createDiv({ cls: "note", text: calendarText(this.cal).list }); return; }
    const now = Date.now(), ev = this.FF.filter((e) => e.i === 3 && +e.t > now - 30 * 60e3).slice(0, 14);
    el.innerHTML = ev.length
      ? ev.map((e) => { const ms = +e.t - now; return `<div class="feed"><div><span class="t">${this.Z.local(e.t).toISOString().slice(5, 16).replace("T", " ")}</span><span><b style="font-weight:400;color:#fff">${esc(e.country)}</b> ${esc(e.title)}</span><span class="${ms < 3600e3 && ms > 0 ? "ffwarn" : ""}">${ms > 0 ? cd(ms) : "OUT"}</span></div></div>`; }).join("")
      : '<div class="note">No high-impact events left this week.</div>';
  }

  // ================================================================== toasts + news alerts

  private toast(title: string, bodyHtml: string, hi: boolean) {
    const box = this.$("toasts"), d = box.createDiv({ cls: "toast" + (hi ? " hi" : "") });
    d.createEl("b", { text: title });
    d.insertAdjacentHTML("beforeend", bodyHtml); // callers escape journal and calendar text
    d.onclick = () => d.remove();
    box.prepend(d);
    this.life.after(hi ? 20000 : 12000, () => d.remove());
    while (box.children.length > 4) box.lastChild!.remove();
  }

  private checkAlerts() {
    if (!this.FF) return;
    const now = Date.now();
    this.FF.forEach((e) => {
      if (e.i < 3) return;
      if (!(this.CUR.ccy.includes(e.country) || this.FFC === "ALL" || e.country === this.FFC)) return;
      const k = e.title + e.date, rem = +e.t - now, prev = this.ALERT_PREV[k];
      this.ALERT_PREV[k] = rem;
      for (const m of crossed(prev, rem)) {
        const det = `<span class="ffmut">${esc(e.country)}</span> ${esc(e.title)}${e.forecast ? ` · F ${esc(e.forecast)}` : ""}${e.previous ? ` · P ${esc(e.previous)}` : ""}`;
        if (m) this.toast(`HIGH IMPACT IN ${m} MIN`, det, m <= 5); else this.toast("RELEASED NOW", det, true);
        this.sound.alarm(m ? (m <= 5 ? 3 : 2) : 4);
      }
    });
  }

  // ================================================================== risk: guard, checklist, sizing

  private todayTrades() { const k = this.Z.dayKey(new Date()); return this.closed().filter((t) => this.Z.dayKey(t.time!) === k); }

  private bar(label: string, val: number, max: number, txt: string) {
    const f = Math.max(0, Math.min(1, max ? val / max : 0));
    return `<div class="gbar ${f >= 1 ? "bad" : f >= 0.7 ? "warn" : ""}"><div class="l"><span>${label}</span><span>${txt}</span></div><div class="t"><i style="width:${(f * 100).toFixed(0)}%"></i></div></div>`;
  }

  private renderGuard() {
    const $ = this.$, RG = this.RG, g = guardState(this.todayTrades(), RG, Date.now());
    $("guardChip").className = "gchip " + g.lvl.toLowerCase();
    $("guardChip").textContent = "GUARD · " + g.lvl;
    $("gMini").textContent = g.lvl === "OK" ? "CLEAR" : g.lvl;
    $("rgSub").textContent = g.why[0] ? g.why[0].toUpperCase() : "TODAY";
    const bars = this.bar("LOSS TODAY", Math.max(0, -g.net), RG.loss, `${money(Math.max(0, -g.net))} / ${money(RG.loss)}`) + this.bar("TRADES", g.n, RG.trades, `${g.n} / ${RG.trades}`) +
      this.bar("LOSSES IN A ROW", g.consec, RG.consec, `${g.consec} / ${RG.consec}`) + (RG.cool ? this.bar("COOL-DOWN", g.coolLeft, RG.cool * 60e3, g.coolLeft ? cd(g.coolLeft) : "READY") : "");
    $("gMiniBars").innerHTML = bars;
    if ($("v-risk").classList.contains("on")) {
      $("gBig").textContent = g.lvl === "OK" ? "CLEAR" : g.lvl; $("gBig").className = "gbig " + (g.lvl === "STOP" ? "stop" : "");
      $("gWhy").textContent = g.why.join(" · ") || "Within your limits"; $("gBars").innerHTML = bars;
    }
    if (this.lastLevel && g.lvl !== this.lastLevel && g.lvl === "STOP") { this.toast("STOP TRADING", esc(g.why.join(" · ")), true); this.sound.alarm(5); }
    else if (this.lastLevel === "OK" && g.lvl === "CAUTION") { this.toast("CAUTION", esc(g.why.join(" · ")), false); this.sound.alarm(1); }
    this.lastLevel = g.lvl;
  }

  private ckKey() { return "cc_ck_" + this.Z.dayKey(new Date()); }

  private renderCk() {
    const day = this.ckKey(), st = this.host.store.get<Record<string, boolean>>(day, {}), nc = newsClear(this.FF, this.CUR.ccy, Date.now());
    const note = nc === null ? calendarText(this.cal).checklist : "";
    let h = `<div class="ck auto ${nc ? "on" : ""}"><span class="b">${nc ? "✓" : nc === null ? "?" : "✕"}</span><span class="t">No high-impact ${esc(this.CUR.ccy.join("/"))} news in the next 30 min${esc(note)}</span><span class="x" style="cursor:default">AUTO</span></div>`;
    this.CK.forEach((c, i) => { h += `<div class="ck ${st[i] ? "on" : ""}" data-i="${i}"><span class="b">${st[i] ? "✓" : ""}</span><span class="t">${esc(c)}</span><span class="x" data-del="${i}" title="Remove">✕</span></div>`; });
    const all = !!nc && this.CK.every((_, i) => st[i]);
    h += `<div class="ckst ${all ? "go" : ""}">${all ? "CLEARED TO TRADE" : "NOT CLEARED"}</div><div style="display:flex;gap:6px"><span class="chip" id="ckAdd">+ ADD ITEM</span><span class="chip" id="ckReset">RESET TODAY</span><span class="chip" id="ckDef">DEFAULT LIST</span></div>`;
    const list = this.$("ckList");
    list.innerHTML = h;
    this.$("ckState").textContent = all ? "CLEARED" : "PENDING";
    list.querySelectorAll<HTMLElement>(".ck[data-i]").forEach((el) => (el.onclick = (e) => {
      const del = (e.target as HTMLElement).dataset.del;
      if (del != null) { this.CK.splice(+del, 1); this.host.store.set("cc_ck_items", this.CK); this.host.store.set(day, {}); this.renderCk(); return; }
      const s2 = this.host.store.get<Record<string, boolean>>(day, {});
      s2[el.dataset.i!] = !s2[el.dataset.i!];
      this.host.store.set(day, s2);
      this.renderCk();
    }));
    this.$("ckAdd").onclick = async () => { const t = await this.host.ask("New checklist item"); if (t && t.trim()) { this.CK.push(t.trim()); this.host.store.set("cc_ck_items", this.CK); this.renderCk(); } };
    this.$("ckReset").onclick = () => { this.host.store.set(day, {}); this.renderCk(); };
    this.$("ckDef").onclick = () => { this.CK = CK_DEF.slice(); this.host.store.set("cc_ck_items", this.CK); this.host.store.set(day, {}); this.renderCk(); };
  }

  private renderPos() {
    const out = this.$("pOut"), C = this.CUR;
    const r = sizeFor(C, { acc: +this.PS.acc, pct: +this.PS.pct, fee: +this.PS.fee, max: +this.PS.max }, parseFloat((this.$("pEn") as HTMLInputElement).value), parseFloat((this.$("pSt") as HTMLInputElement).value));
    if (!r) { out.innerHTML = '<div class="note" style="margin-top:12px">Enter an entry and a stop price.</div>'; return; }
    const pd = Math.max(1, dec(C.tick)), tgt = (x: number) => r.target(x).toFixed(pd);
    out.innerHTML = `<div class="pbig">${r.contracts}<small>CONTRACTS · ${r.dir}</small></div>${r.capped ? '<div class="sub" style="text-align:center">capped at your max contracts</div>' : ""}${r.contracts === 0 ? '<div class="sub" style="text-align:center">stop too wide for this risk — size 0</div>' : ""}
   <div class="pres"><span class="k">Stop distance</span><span class="v">${r.dist.toFixed(pd)} pts · ${r.ticks} ticks</span><span class="k">Risk per contract</span><span class="v">${money(r.perContract)}</span>
   <span class="k">Planned risk (${+this.PS.pct}%)</span><span class="v">${money(r.planned)}</span><span class="k">Actual risk</span><span class="v">${money(r.actual)}</span>
   <span class="k">1R target</span><span class="v">${tgt(1)} · +${money(r.reward(1))}</span><span class="k">2R target</span><span class="v">${tgt(2)} · +${money(r.reward(2))}</span><span class="k">3R target</span><span class="v">${tgt(3)} · +${money(r.reward(3))}</span></div>`;
  }

  private renderRisk() { this.renderCk(); this.renderGuard(); this.renderPos(); }

  private initRisk() {
    const bind = (id: string, obj: Record<string, unknown>, key: string, save: string, fn: () => void) => {
      const el = this.$(id) as HTMLInputElement;
      el.value = String(obj[key] ?? "");
      el.oninput = () => { obj[key] = el.value === "" ? "" : +el.value; this.host.store.set(save, obj); fn(); };
    };
    const RG = this.RG as unknown as Record<string, unknown>, PS = this.PS as unknown as Record<string, unknown>;
    bind("gLoss", RG, "loss", "cc_guard", () => this.renderGuard()); bind("gTrades", RG, "trades", "cc_guard", () => this.renderGuard());
    bind("gConsec", RG, "consec", "cc_guard", () => this.renderGuard()); bind("gCool", RG, "cool", "cc_guard", () => this.renderGuard());
    bind("pAcc", PS, "acc", "cc_pos", () => this.renderPos()); bind("pPct", PS, "pct", "cc_pos", () => this.renderPos()); bind("pFee", PS, "fee", "cc_pos", () => this.renderPos());
    bind("pMax", PS, "max", "cc_pos", () => this.renderPos()); bind("pEn", PS, "en", "cc_pos", () => this.renderPos()); bind("pSt", PS, "st", "cc_pos", () => this.renderPos());
    this.renderRisk();
    this.life.every(1000, () => {
      this.renderGuard();
      if (this.$("v-news").classList.contains("on")) this.renderHi();
      if (this.$("v-risk").classList.contains("on")) this.renderCk();
    });
  }

  // ================================================================== TradingView

  private liveOk() { return this.host.settings().tvWidgets && navigator.onLine; }
  private offlineNote(el: HTMLElement, pad = false) { el.empty(); const n = el.createDiv({ cls: "note", text: "Live market data needs an internet connection." }); if (pad) n.style.padding = "20px"; }

  private loadWidgets() {
    if (this.widgetsLoaded) return;
    this.widgetsLoaded = true;
    const C = this.CUR, $ = this.$;
    if (!this.liveOk()) { ["tape", "goldQuote", "liveChart"].forEach((id) => this.offlineNote($(id))); return; }
    mountWidget($("tape"), "ticker-tape", { symbols: [{ proName: C.px, title: C.short }].concat([{ proName: "OANDA:XAUUSD", title: "GOLD" }, { proName: "CAPITALCOM:DXY", title: "DXY" }, { proName: "OANDA:XAGUSD", title: "SILVER" }, { proName: "FOREXCOM:SPXUSD", title: "S&P 500" }, { proName: "FOREXCOM:NSXUSD", title: "NASDAQ" }, { proName: "FX:EURUSD", title: "EURUSD" }, { proName: "FX:USDJPY", title: "USDJPY" }, { proName: "BITSTAMP:BTCUSD", title: "BTC" }].filter((x) => x.proName !== C.px)), showSymbolLogo: false, isTransparent: false, displayMode: "adaptive", colorTheme: "dark", locale: "en" });
    mountWidget($("goldQuote"), "single-quote", { symbol: C.px, width: "100%", isTransparent: false, colorTheme: "dark", locale: "en" });
    mountWidget($("liveChart"), "advanced-chart", { autosize: true, symbol: C.px, interval: "5", timezone: this.TZN, theme: "dark", style: "1", locale: "en", hide_top_toolbar: true, hide_legend: false, allow_symbol_change: false, save_image: false, hide_volume: true, backgroundColor: "rgba(8,8,8,1)", gridColor: "rgba(255,255,255,0.05)", support_host: "https://www.tradingview.com" });
  }

  private loadNews() {
    this.renderHi();
    if (this.newsLoaded) return;
    this.newsLoaded = true;
    const C = this.CUR, $ = this.$;
    if (!this.liveOk()) { ["newsFeed", "sentiment"].forEach((id) => this.offlineNote($(id))); return; }
    mountWidget($("newsFeed"), "timeline", { feedMode: "symbol", symbol: C.px, isTransparent: true, displayMode: "regular", width: "100%", height: "100%", colorTheme: "dark", locale: "en" });
    mountWidget($("sentiment"), "technical-analysis", { interval: "15m", width: "100%", height: "100%", isTransparent: true, symbol: C.px, showIntervalTabs: true, displayMode: "single", locale: "en", colorTheme: "dark" });
  }

  private loadChart() {
    if (this.chartLoaded) return;
    this.chartLoaded = true;
    const box = this.$("tvbox");
    if (!this.liveOk()) { this.offlineNote(box, true); return; }
    const id = "tradingview_" + Math.random().toString(16).slice(2, 7);
    mountChart(box, chartUrl({
      symbol: this.CUR.tv, interval: "5", timezone: this.TZN, theme: "dark", style: "1", locale: "en", backgroundColor: "rgba(12,12,12,1)", gridColor: "rgba(122,122,122,0.25)",
      hide_side_toolbar: false, allow_symbol_change: true, withdateranges: true, frameId: id,
      overrides: { "mainSeriesProperties.candleStyle.upColor": "#e8e8e8", "mainSeriesProperties.candleStyle.downColor": "#ffffff", "mainSeriesProperties.candleStyle.borderUpColor": "#e8e8e8", "mainSeriesProperties.candleStyle.borderDownColor": "#ffffff", "mainSeriesProperties.candleStyle.wickUpColor": "#e8e8e8", "mainSeriesProperties.candleStyle.wickDownColor": "#ffffff" },
    }), id);
  }

  /** Rebuild the widgets for a new instrument, or after going on/offline or changing the setting. */
  private refreshMarket(force = false) {
    if (this.widgetsLoaded) { this.widgetsLoaded = false; this.loadWidgets(); }
    if (this.newsLoaded) { this.newsLoaded = false; if (this.$("v-news").classList.contains("on") || force) this.loadNews(); }
    if (this.chartLoaded) { this.chartLoaded = false; if (this.$("v-chart").classList.contains("on") || force) this.loadChart(); }
  }
}
