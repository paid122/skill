/**
 * The cinematic intro, ported from the prototype: ENGAGE gate → boot log → hyperspace → flash → statue reveal →
 * LEDGR decode + stats → welcome → fly into the OPERATOR panel. Timeline in seconds (TL).
 */
import type { Instrument } from "../instruments";
import type { Life } from "../life";
import { esc, money } from "../logic";
import type { Sound } from "../sound";
import { cvFit } from "./fit";

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const eout = (v: number) => 1 - Math.pow(1 - clamp(v), 3);
const CH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@";
const TL = { log: 0, warp: 1.6, flash: 3.9, reveal: 4.25, title: 5.1, stats: 5.6, msg: 7.4, fly: 8.6, end: 9.6 };

export interface IntroStats { net: string; win: string; pf: string; n: string; dd: string; r: string }
export interface IntroDeps {
  $: (id: string) => HTMLElement;
  root: HTMLElement;
  life: Life;
  sound: Sound;
  log: () => string[];
  name: () => string;
  cur: () => Instrument;
  stats: () => IntroStats | null;
  session: () => string;
  powerOn: () => void;
  /** Runs when the intro starts (load data early) and when it ends (show the dashboard). */
  onStart: () => void;
  onEnd: () => void;
  onFly: () => void;
}

export function createIntro(d: IntroDeps) {
  const { $, life, sound } = d;
  const S_ = sound.fx;
  let booting = false, bootT0: number | null = null, fired: Record<string, number> = {};
  let WARP: { x: number; y: number; z: number; sp: number; hot: boolean }[] | null = null;
  const once = (key: string, fn: () => void) => { if (!fired[key]) { fired[key] = 1; fn(); } };
  const boot = () => $("boot"), gate = () => $("gate");

  function decode(el: HTMLElement & { _l?: number }, txt: string, p: number, lockSnd?: boolean) {
    const n = txt.length, locked = Math.floor(clamp(p) * n);
    let o = "";
    for (let i = 0; i < n; i++) o += i < locked || txt[i] === " " ? txt[i] : CH[(Math.random() * CH.length) | 0];
    el.textContent = o;
    if (lockSnd && locked > (el._l || 0)) { el._l = locked; S_.lock(); }
  }

  function bootFrame(t: number) {
    if (!booting) return;
    if (bootT0 === null) bootT0 = t;
    const s = (t - bootT0) / 1000;
    const cv = $("bootCv") as HTMLCanvasElement;
    const { g, w, h } = cvFit(cv);
    const cx = w / 2, cy = h * 0.47;
    const hb = Math.pow(Math.max(0, Math.sin(s * Math.PI * 1.25)), 12);
    g.fillStyle = s < TL.warp ? "rgba(3,3,3,.5)" : "rgba(3,3,3,.42)"; g.fillRect(0, 0, w, h);
    if (s < TL.flash) {
      const v = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
      v.addColorStop(0, `rgba(255,255,255,${(0.06 + 0.22 * hb).toFixed(3)})`); v.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = v; g.fillRect(0, 0, w, h);
      if (s < TL.warp && hb > 0.9) once("hb" + Math.floor(s * 1.25), S_.beat);
    }
    // boot log (types fast)
    if (s < TL.flash) {
      g.font = "12px 'Share Tech Mono',monospace"; g.textAlign = "left";
      const per = 0.2, shown = s / per;
      d.log().forEach((L, i) => {
        if (shown < i) return;
        const part = L.slice(0, Math.floor(clamp(shown - i) * L.length));
        g.fillStyle = "rgba(255,255,255,.85)"; g.fillText("> " + part, 24, 30 + i * 18);
        if (part.length < L.length) once("t" + i + "_" + (part.length >> 2), S_.tick);
      });
    }
    // warp
    if (s >= TL.warp && s < TL.flash + 0.3) {
      once("riser", S_.riser);
      if (!WARP) { WARP = []; for (let i = 0; i < 2400; i++) WARP.push({ x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2, z: Math.random(), sp: 0.6 + Math.random() * 0.8, hot: Math.random() < 0.12 }); }
      const k = clamp((s - TL.warp) / (TL.flash - TL.warp)), speed = 0.004 + 0.06 * Math.pow(k, 2.2), shake = k > 0.6 ? (k - 0.6) * 14 : 0, sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
      g.globalCompositeOperation = "lighter"; g.lineCap = "round";
      for (const off of [[-2.5, "200,200,200"], [2.5, "110,110,110"], [0, "255,255,255"]] as [number, string][]) {
        g.strokeStyle = `rgba(${off[1]},${off[0] ? 0.35 : 0.75})`; g.lineWidth = off[0] ? 1 : 1.3; g.beginPath();
        for (const p of WARP) {
          if (!off[0]) { p.z -= speed * p.sp; if (p.z <= 0.01) { p.z = 1; p.x = (Math.random() - 0.5) * 2; p.y = (Math.random() - 0.5) * 2; } }
          const f = 0.35 / p.z, f2 = 0.35 / (p.z + speed * p.sp * (4 + k * 10)), x = cx + p.x * f * w * 0.5 + sx, y = cy + p.y * f * h * 0.5 + sy, x0 = cx + p.x * f2 * w * 0.5 + sx, y0 = cy + p.y * f2 * h * 0.5 + sy;
          if (x < -50 || x > w + 50 || y < -50 || y > h + 50) continue;
          g.moveTo(x0 + ((off[0] * k * (x - cx)) / w) * 10, y0); g.lineTo(x + ((off[0] * k * (x - cx)) / w) * 10, y);
        }
        g.stroke();
      }
      g.globalCompositeOperation = "source-over";
      for (let r = 0; r < 6; r++) { const z = (r / 6 - s * 1.4 * k) % 1, zz = z < 0 ? z + 1 : z, R = 40 / (zz + 0.05); g.strokeStyle = `rgba(255,255,255,${(0.25 * (1 - zz)).toFixed(3)})`; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke(); }
    }
    // flash + boom
    if (s >= TL.flash && s < TL.flash + 0.7) {
      once("boom", () => { S_.boom(); S_.chord(); });
      const f = 1 - (s - TL.flash) / 0.7;
      g.fillStyle = `rgba(255,255,255,${(f * f).toFixed(3)})`; g.fillRect(0, 0, w, h);
      for (let r = 0; r < 3; r++) { const b = clamp(((s - TL.flash) / 0.7) * 1.3 - r * 0.12); g.strokeStyle = `rgba(255,255,255,${(1 - b) * 0.8})`; g.lineWidth = 5 * (1 - b) + 1; g.beginPath(); g.arc(cx, cy, b * Math.hypot(w, h) * 0.55, 0, 7); g.stroke(); }
    }
    // reveal stage
    const st = $("introStage"), fx = $("introFx") as HTMLCanvasElement;
    if (s >= TL.reveal && s < TL.fly) {
      const k = eout((s - TL.reveal) / 1.2);
      st.style.opacity = "1";
      const iv = $("introVid") as HTMLVideoElement;
      if (iv.paused) iv.play().catch(() => undefined);
      st.style.clipPath = `inset(${((1 - k) * 100).toFixed(1)}% 0 0 0)`;
      st.style.transform = `translate(-50%,-50%) scale(${(1.15 - 0.15 * k).toFixed(3)})`;
      const F = cvFit(fx), G = F.g;
      G.clearRect(0, 0, F.w, F.h);
      const ly = (1 - k) * F.h;
      if (k < 1) { const gr = G.createLinearGradient(0, ly - 20, 0, ly + 6); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(255,255,255,.95)"); G.fillStyle = gr; G.fillRect(0, ly - 20, F.w, 26); }
      // HUD rings around the statue
      const rk = eout((s - TL.reveal - 0.3) / 1), R = Math.min(w, h) * 0.3;
      g.save(); g.translate(cx, cy); g.globalAlpha = rk; g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = 1.2; g.rotate(s * 0.5);
      for (let q = 0; q < 4; q++) { g.beginPath(); g.arc(0, 0, R, (q * Math.PI) / 2 + 0.2, (q * Math.PI) / 2 + 1.15); g.stroke(); }
      g.rotate(-s * 1.2); g.setLineDash([3, 9]); g.beginPath(); g.arc(0, 0, R * 0.9, 0, 7); g.stroke(); g.setLineDash([]);
      g.rotate(s * 0.9);
      for (let q = 0; q < 60; q++) { const a = (q / 60) * 6.283, L = q % 5 ? 4 : 10; g.beginPath(); g.moveTo(Math.cos(a) * R * 1.08, Math.sin(a) * R * 1.08); g.lineTo(Math.cos(a) * (R * 1.08 + L), Math.sin(a) * (R * 1.08 + L)); g.stroke(); }
      g.restore();
      // floor ring ignite (stage rect relative to the boot layer)
      const fk = eout((s - TL.reveal - 0.6) / 0.8), rb = st.getBoundingClientRect(), bb = boot().getBoundingClientRect();
      g.save(); g.strokeStyle = `rgba(255,255,255,${fk})`; g.shadowColor = "#ffffff"; g.shadowBlur = 20; g.lineWidth = 2;
      g.beginPath(); g.ellipse(cx, rb.bottom - bb.top - rb.height * 0.03, rb.width * 0.42 * fk, 10 * fk, 0, 0, 7); g.stroke(); g.restore();
      once("reveal", S_.whoosh);
    }
    // title + stats
    const cur = d.cur();
    if (s >= TL.title && s < TL.fly + 0.4) { decode($("iT1"), "LEDGR", (s - TL.title) / 0.9, true); decode($("iT2"), cur.code + " · " + cur.name + " · COMMAND CENTER", (s - TL.title - 0.4) / 1.2); }
    if (s >= TL.stats && s < TL.fly + 0.4) {
      const sd = d.stats(), L = $("introL"), Rr = $("introR"), p = (s - TL.stats) / 1.4;
      const rows = sd ? [["NET P&L", sd.net], ["WIN RATE", sd.win], ["PROFIT FACTOR", sd.pf]] : [["LINK", "LEDGR"], ["FEED", "CME GLOBEX"], ["CONTRACT", cur.code + " · " + cur.name]];
      const rows2 = sd ? [["TRADES", sd.n], ["AVG R", sd.r], ["MAX DRAWDOWN", sd.dd]] : [["TICK", cur.tick + " = " + money(cur.tick * cur.pv)], ["POINT", money(cur.pv).replace(".00", "")], ["SESSION", d.session()]];
      const f = (rs: string[][], el: HTMLElement) => {
        el.innerHTML = rs.map(([k, v], i) => {
          const q = clamp(p * 1.5 - i * 0.25);
          if (q <= 0) return "";
          let o = "";
          for (let j = 0; j < v.length; j++) o += j < Math.floor(q * v.length) ? v[j] : CH[(Math.random() * CH.length) | 0];
          return `${esc(k)}<b>${esc(o)}</b>`;
        }).join("");
      };
      f(rows, L); f(rows2, Rr); L.style.opacity = Rr.style.opacity = "1";
      once("st", S_.lock);
    }
    // message
    const m = $("introMsg");
    if (s >= TL.msg && s < TL.fly + 0.4) {
      const k = s - TL.msg;
      m.style.opacity = String(k < 0.15 ? Math.random() : 1);
      m.textContent = k < 0.6 ? "OPERATOR RECOGNISED" : "WELCOME BACK, " + d.name();
      if (k < 0.15) once("g1", S_.glitch);
      if (k > 0.6 && k < 0.75) once("g2", S_.glitch);
    }
    // random glitch slices
    if (s > TL.reveal && Math.random() < 0.04) {
      const dpr = cv.width / w;
      for (let q = 0; q < 5; q++) { const y = Math.random() * h, hh = 3 + Math.random() * 16; g.drawImage(cv, 0, y * dpr, w * dpr, hh * dpr, (Math.random() - 0.5) * 40, y, w, hh); }
    }
    g.fillStyle = "rgba(255,255,255,.1)"; g.fillRect(0, (t * 0.4) % h, w, 2);
    if (s >= TL.fly) once("fly", () => { S_.whoosh(); flyOut(); });
    if (s >= TL.end) { endBoot(); return; }
    life.frame(bootFrame);
  }

  function flyOut() {
    d.onFly();
    const st = $("introStage"), fig = d.root.querySelector<HTMLElement>(".figwrap"), b = boot();
    d.powerOn();
    ["introTitle", "introL", "introR", "introMsg"].forEach((id) => { $(id).style.transition = "opacity .35s"; $(id).style.opacity = "0"; });
    b.style.transition = "background-color .8s"; b.style.backgroundColor = "rgba(3,3,3,0)";
    $("bootCv").style.transition = "opacity .5s"; $("bootCv").style.opacity = "0";
    if (fig) {
      const a = st.getBoundingClientRect(), z = fig.getBoundingClientRect(), bb = b.getBoundingClientRect(), sc = Math.min(z.width / a.width, z.height / a.height);
      st.style.transition = "transform .9s cubic-bezier(.7,0,.2,1), left .9s cubic-bezier(.7,0,.2,1), top .9s cubic-bezier(.7,0,.2,1)";
      st.style.clipPath = "none";
      st.style.left = z.left - bb.left + z.width / 2 + "px";
      st.style.top = z.top - bb.top + z.height / 2 + "px";
      st.style.transform = `translate(-50%,-50%) scale(${sc.toFixed(3)})`;
    }
  }

  function resetIntro() {
    fired = {}; WARP = null; bootT0 = null;
    ["introTitle", "introL", "introR", "introMsg"].forEach((id) => { $(id).style.transition = ""; $(id).style.opacity = ""; });
    $("introMsg").style.opacity = "0";
    $("introL").empty(); $("introR").empty();
    $("iT1").textContent = ""; $("iT2").textContent = "";
    const st = $("introStage");
    st.style.transition = ""; st.style.left = ""; st.style.top = ""; st.style.opacity = "0"; st.style.transform = "translate(-50%,-50%)";
    $("bootCv").style.transition = ""; $("bootCv").style.opacity = "1";
    boot().style.transition = ""; boot().style.backgroundColor = "";
  }

  function start(withSound: boolean) {
    gate().style.display = "none";
    $("skipBtn").style.display = "block";
    sound.on = withSound && sound.pref;
    if (sound.on) { sound.audio(); if (sound.AC?.state === "suspended") void sound.AC.resume(); S_.drone(); }
    d.onStart();
    booting = true;
    resetIntro();
    life.frame(bootFrame);
  }

  function endBoot() {
    const b = boot();
    if (!booting && b.style.display === "none") return;
    const flew = !!fired.fly;
    booting = false;
    b.style.transition = "opacity .45s"; b.style.opacity = "0";
    life.after(460, () => { b.style.display = "none"; b.style.opacity = "1"; resetIntro(); });
    if (!flew) d.powerOn();
    d.onEnd();
  }

  /** Show the ENGAGE gate (BOOT button, or on open when the intro is on). Starts by itself after 8 s. */
  function showGate() {
    boot().style.display = "block"; gate().style.display = "flex"; $("skipBtn").style.display = "none";
    resetIntro();
    const { g, w, h } = cvFit($("bootCv") as HTMLCanvasElement);
    g.fillStyle = "#030303"; g.fillRect(0, 0, w, h);
    life.after(8000, () => { if (gate().style.display !== "none" && boot().style.display !== "none") start(false); });
    life.frame(gateBg);
  }

  /** Skip straight to the dashboard (intro turned off in settings). */
  function skip() { booting = true; gate().style.display = "none"; endBoot(); }

  function gateBg(t: number) {
    if (gate().style.display === "none" || boot().style.display === "none") return;
    const { g, w, h } = cvFit($("bootCv") as HTMLCanvasElement);
    g.fillStyle = "rgba(3,3,3,.25)"; g.fillRect(0, 0, w, h);
    const hb = Math.pow(Math.max(0, Math.sin((t / 1000) * Math.PI * 0.8)), 10), v = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
    v.addColorStop(0, `rgba(255,255,255,${(0.04 + 0.14 * hb).toFixed(3)})`); v.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = v; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,.08)"; g.fillRect(0, (t * 0.15) % h, w, 1);
    life.frame(gateBg);
  }

  // gate controls (keys only while the command center has focus)
  (d.root.querySelector(".gring") as HTMLElement).onclick = () => start(true);
  $("gskip").onclick = () => { gate().style.display = "none"; booting = true; endBoot(); };
  $("skipBtn").onclick = () => endBoot();
  life.on(d.root, "keydown", (e) => {
    if (boot().style.display === "none") return;
    if (gate().style.display !== "none" && e.key === "Enter") start(true);
    else if (e.key === "Escape") endBoot();
  });

  return { showGate, skip, isRunning: () => boot().style.display !== "none" };
}
