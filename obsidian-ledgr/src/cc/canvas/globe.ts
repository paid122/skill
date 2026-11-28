/** The dot-matrix globe: market cities open/closed, arcs with travelling pulses (prototype's drawGlobe). */
import { cityOf, TZXY } from "../instruments";
import { cmeOpen } from "../market";
import { fit, RED, rot } from "./fit";

const LAND = [[50, 10, 22, 40], [8, 20, 28, 22], [55, 90, 22, 60], [25, 78, 10, 12], [35, 105, 12, 18], [45, -100, 18, 38], [62, -110, 10, 40], [-15, -60, 25, 15], [-25, 135, 12, 18], [72, -40, 7, 15], [0, 115, 6, 15], [37, 138, 5, 4], [54, -2, 4, 3], [64, 15, 6, 8]];
const GL: [number, number][] = [];
for (let la = -80; la <= 80; la += 3.2)
  for (let lo = -180; lo < 180; lo += 3.2 / Math.max(0.25, Math.cos((la * Math.PI) / 180)))
    if (LAND.some(([a, b, ra, rb]) => ((la - a) / ra) ** 2 + ((((lo - b + 540) % 360) - 180) / rb) ** 2 < 1)) GL.push([la, lo]);

const ll = (la: number, lo: number, a: number) => { const p = (la * Math.PI) / 180, l = (lo * Math.PI) / 180 + a; return [Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l)]; };

type City = [string, number, number, [number, number]];

export function createGlobe(cv: HTMLCanvasElement, tz: () => string) {
  let globeA = 0, cachedTz = "", CITIES: City[] = [];
  const cities = () => {
    const z = tz();
    if (z !== cachedTz) {
      cachedTz = z;
      const base: City[] = [["TOKYO", 35.7, 139.7, [0, 6]], ["LONDON", 51.5, -0.1, [7, 15.5]], ["NEW YORK", 40.7, -74, [13.5, 20]], ["CHICAGO · CME", 41.9, -87.6, [-1, 24]]];
      const xy = TZXY[z];
      CITIES = xy ? base.concat([[cityOf(z), xy[0], xy[1], [5, 13]]]) : base;
    }
    return CITIES;
  };

  return function draw(t: number) {
    const { g, w, h } = fit(cv);
    const C = cities();
    g.clearRect(0, 0, w, h);
    globeA += 0.0025;
    const R = Math.min(w, h) * 0.38, cx = w / 2, cy = h * 0.47, tilt = -0.35;
    const gr = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R); gr.addColorStop(0, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(120,120,120,.25)"); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    g.strokeStyle = `rgba(${RED},.7)`; g.lineWidth = 1.2; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
    const rim = g.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.25); rim.addColorStop(0, "rgba(255,255,255,.18)"); rim.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = rim; g.beginPath(); g.arc(cx, cy, R * 1.25, 0, 7); g.arc(cx, cy, R, 0, 7, true); g.fill();
    g.fillStyle = "rgba(255,255,255,.22)";
    for (let la = -60; la <= 60; la += 30) for (let lo = -180; lo < 180; lo += 4) { const p = rot(ll(la, lo, globeA), 0, tilt); if (p[2] > 0) g.fillRect(cx + p[0] * R, cy - p[1] * R, 1, 1); }
    for (let lo = -180; lo < 180; lo += 30) for (let la = -80; la <= 80; la += 4) { const p = rot(ll(la, lo, globeA), 0, tilt); if (p[2] > 0) g.fillRect(cx + p[0] * R, cy - p[1] * R, 1, 1); }
    const ARC = [[0, 1], [1, 2], [2, 3], [4, 1], [0, 4]], ph = (t * 0.00025) % 1;
    ARC.forEach(([a, b], k) => {
      const A = C[a], B = C[b];
      if (!A || !B) return;
      const va = ll(A[1], A[2], 0), vb = ll(B[1], B[2], 0);
      const om = Math.acos(Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]))) || 1e-3;
      const pt = (f: number) => {
        const s1 = Math.sin((1 - f) * om) / Math.sin(om), s2 = Math.sin(f * om) / Math.sin(om);
        const v = [va[0] * s1 + vb[0] * s2, va[1] * s1 + vb[1] * s2, va[2] * s1 + vb[2] * s2];
        const lift = 1 + 0.22 * Math.sin(Math.PI * f);
        const lat = Math.asin(v[1] / Math.hypot(...v)), lon = Math.atan2(v[0], v[2]);
        const p = rot(ll((lat * 180) / Math.PI, (lon * 180) / Math.PI, globeA), 0, tilt);
        return [cx + p[0] * R * lift, cy - p[1] * R * lift, p[2]];
      };
      g.lineWidth = 1; g.strokeStyle = "rgba(255,255,255,.28)"; g.beginPath();
      let pen = false;
      for (let i = 0; i <= 40; i++) { const q = pt(i / 40); if (q[2] > -0.15) { if (pen) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); pen = true; } else pen = false; }
      g.stroke();
      const f = (ph + k * 0.2) % 1, q = pt(f);
      if (q[2] > -0.15) {
        g.fillStyle = "#fff"; g.beginPath(); g.arc(q[0], q[1], 2.4, 0, 7); g.fill();
        const gl = g.createRadialGradient(q[0], q[1], 0, q[0], q[1], 12); gl.addColorStop(0, "rgba(255,255,255,.5)"); gl.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gl; g.fillRect(q[0] - 12, q[1] - 12, 24, 24);
      }
    });
    for (const [la, lo] of GL) { const p = rot(ll(la, lo, globeA), 0, tilt); if (p[2] < 0) continue; g.fillStyle = `rgba(255,255,255,${0.35 + 0.6 * p[2]})`; g.fillRect(cx + p[0] * R - 1, cy - p[1] * R - 1, 2, 2); }
    const now = new Date(), utc = now.getUTCHours() + now.getUTCMinutes() / 60;
    g.font = "11px 'Share Tech Mono',monospace";
    C.forEach(([n, la, lo, [s, e]]) => {
      const p = rot(ll(la, lo, globeA), 0, tilt), open = n.startsWith("CHICAGO") ? cmeOpen() : utc >= s && utc < e, x = cx + p[0] * R, y = cy - p[1] * R, vis = p[2] > 0;
      const pr = (Math.sin(t * 0.005) + 1) / 2;
      g.globalAlpha = vis ? 1 : 0.25; g.fillStyle = open ? "#ffffff" : "#777777"; g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill();
      if (open && vis) { g.strokeStyle = `rgba(255,255,255,${1 - pr})`; g.beginPath(); g.arc(x, y, 4 + pr * 12, 0, 7); g.stroke(); }
      const dy = n.startsWith("CHICAGO") ? 40 : -16, lx = x + (p[0] > 0 ? 28 : -28) + (n.startsWith("CHICAGO") ? (p[0] > 0 ? 10 : -10) : 0);
      g.strokeStyle = "rgba(255,255,255,.7)"; g.beginPath(); g.moveTo(x, y); g.lineTo(lx, y + dy); g.stroke();
      g.textAlign = p[0] > 0 ? "left" : "right"; g.fillStyle = "#ffffff"; g.fillText(n, lx + (p[0] > 0 ? 3 : -3), y + dy - 3);
      g.fillStyle = open ? "#ffffff" : "#c2c2c2"; g.fillText(open ? "OPEN" : "CLOSED", lx + (p[0] > 0 ? 3 : -3), y + dy + 9); g.globalAlpha = 1;
    });
    g.strokeStyle = `rgba(${RED},.35)`; g.beginPath(); g.ellipse(cx, cy, R * 1.25, R * 0.32, -0.2, 0, 7); g.stroke();
    const oa = t * 0.0006;
    g.fillStyle = "#ffffff"; g.beginPath();
    g.arc(cx + Math.cos(oa) * R * 1.25 * Math.cos(-0.2) - Math.sin(oa) * R * 0.32 * Math.sin(-0.2), cy + Math.cos(oa) * R * 1.25 * Math.sin(-0.2) + Math.sin(oa) * R * 0.32 * Math.cos(-0.2), 2.5, 0, 7);
    g.fill();
    g.fillStyle = "#c2c2c2"; g.textAlign = "left"; g.fillText("DRAG-FREE ORBIT · LIVE SESSION STATUS", 12, h - 8);
  };
}
