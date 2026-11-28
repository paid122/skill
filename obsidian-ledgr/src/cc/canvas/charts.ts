/** P&L / equity line chart and the session / setup bar charts (prototype's lineChart and barChart). */
import { smoney } from "../logic";
import { fit } from "./fit";

export function lineChart(cv: HTMLCanvasElement, vals: number[], labels?: [string, string] | null) {
  const { g, w, h } = fit(cv);
  g.clearRect(0, 0, w, h);
  if (vals.length < 2) { g.fillStyle = "#c2c2c2"; g.font = "12px 'Share Tech Mono',monospace"; g.fillText("AWAITING DATA", 12, 24); return; }
  const mn = Math.min(0, ...vals), mx = Math.max(0, ...vals), rg = mx - mn || 1, X = (i: number) => 8 + ((w - 16) * i) / (vals.length - 1), Y = (v: number) => 6 + (h - 24) * (1 - (v - mn) / rg);
  g.strokeStyle = "rgba(122,122,122,.6)";
  for (let k = 0; k <= 4; k++) { const y = 6 + ((h - 24) * k) / 4; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.setLineDash([3, 3]); g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(w, Y(0)); g.stroke(); g.setLineDash([]);
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr;
  g.beginPath(); vals.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v)))); g.lineTo(X(vals.length - 1), Y(mn)); g.lineTo(X(0), Y(mn)); g.fill();
  g.strokeStyle = "#ffffff"; g.shadowColor = "#ffffff"; g.shadowBlur = 8; g.lineWidth = 1.6;
  g.beginPath(); vals.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v)))); g.stroke(); g.shadowBlur = 0;
  if (labels) {
    g.fillStyle = "#c2c2c2"; g.font = "10px 'Share Tech Mono',monospace"; g.textAlign = "left"; g.fillText(labels[0], 4, h - 4);
    g.textAlign = "right"; g.fillText(labels[1], w - 4, h - 4); g.fillText(smoney(vals[vals.length - 1]), w - 4, 14);
  }
}

export function barChart(cv: HTMLCanvasElement, rows: { k: string; v: number }[]) {
  const { g, w, h } = fit(cv);
  g.clearRect(0, 0, w, h);
  if (!rows.length) { g.fillStyle = "#c2c2c2"; g.font = "12px 'Share Tech Mono',monospace"; g.fillText("AWAITING DATA", 12, 24); return; }
  const bh = Math.min(26, (h - 10) / rows.length - 6), m = Math.max(1, ...rows.map((r) => Math.abs(r.v))), L = 110, mid = L + (w - L - 80) / 2, sc = (w - L - 80) / 2 / m;
  g.font = "11px 'Share Tech Mono',monospace";
  rows.forEach((r, i) => {
    const y = 6 + i * (bh + 6);
    g.fillStyle = "#ffffff"; g.textAlign = "left"; g.fillText(r.k.slice(0, 14), 0, y + bh * 0.7);
    const bw = Math.abs(r.v) * sc;
    g.fillStyle = r.v >= 0 ? "rgba(60,255,143,.75)" : "rgba(255,255,255,.85)"; g.shadowColor = g.fillStyle; g.shadowBlur = 6;
    g.fillRect(r.v >= 0 ? mid : mid - bw, y, Math.max(1, bw), bh); g.shadowBlur = 0;
    g.fillStyle = r.v >= 0 ? "#3cff8f" : "#ff5a4f"; g.textAlign = "right"; g.fillText(smoney(r.v).replace(".00", ""), w, y + bh * 0.7);
  });
  g.strokeStyle = "rgba(255,255,255,.3)"; g.beginPath(); g.moveTo(mid, 0); g.lineTo(mid, h); g.stroke();
}
