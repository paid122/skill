/** Session radar: Asia / London / New York arcs in the user's time zone, sweep and clock hand (prototype's drawRadar). */
import { cityOf } from "../instruments";
import type { Zone } from "../logic";
import { fit } from "./fit";

export function createRadar(cv: HTMLCanvasElement, zone: () => Zone) {
  return function draw(t: number) {
    const Z = zone();
    const { g, w, h } = fit(cv);
    g.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2 - 8, R = Math.min(w, h) * 0.38;
    const now = Z.local(new Date()), hr = now.getUTCHours() + now.getUTCMinutes() / 60, A = (x: number) => (x / 24) * 2 * Math.PI - Math.PI / 2;
    const oH = Z.tzOff(new Date()) / 36e5, inA = (x: number, a: number, b: number) => ((((x - a) % 24) + 24) % 24) < b - a;
    ([[-1 + oH, 7 + oH, "ASIA"], [7 + oH, 13.5 + oH, "LONDON"], [13.5 + oH, 21 + oH, "NEW YORK"]] as [number, number, string][]).forEach(([a, b], i) => {
      g.strokeStyle = inA(hr, a, b) ? "rgba(255,255,255,.95)" : "rgba(122,122,122,.9)"; g.lineWidth = 9; g.beginPath(); g.arc(cx, cy, R - i * 14, A(a), A(b)); g.stroke();
    });
    g.lineWidth = 1; g.strokeStyle = "rgba(122,122,122,.8)";
    for (let k = 0; k < 24; k++) { const a = A(k); g.beginPath(); g.moveTo(cx + Math.cos(a) * (R + 4), cy + Math.sin(a) * (R + 4)); g.lineTo(cx + Math.cos(a) * (R + (k % 6 ? 8 : 13)), cy + Math.sin(a) * (R + (k % 6 ? 8 : 13))); g.stroke(); }
    const sw = (t * 0.0012) % (2 * Math.PI), gr = g.createConicGradient ? g.createConicGradient(sw - 0.8, cx, cy) : null;
    if (gr) { gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.12, "rgba(255,255,255,.25)"); gr.addColorStop(0.13, "rgba(255,255,255,0)"); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R - 36, 0, 7); g.fill(); }
    const a = A(hr);
    g.strokeStyle = "#ffffff"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (R + 10), cy + Math.sin(a) * (R + 10)); g.stroke();
    g.fillStyle = "#ffffff"; g.font = "16px 'Share Tech Mono',monospace"; g.textAlign = "center"; g.fillText(now.toISOString().slice(11, 16), cx, cy + 5);
    g.font = "9px 'Share Tech Mono',monospace"; g.fillStyle = "#c2c2c2"; g.fillText(cityOf(Z.tz), cx, cy + 18);
    g.font = "9.5px 'Share Tech Mono',monospace"; g.fillStyle = "#c2c2c2"; g.fillText("ASIA · LONDON · NEW YORK (OUT→IN)", cx, h - 4);
  };
}
