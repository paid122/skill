/** The neural map: a point-cloud brain with firing synapses and labelled insight nodes (prototype's drawBrain/SYN). */
import type { Life } from "../life";
import { esc } from "../logic";
import { fit, RED, rot, seeded } from "./fit";

export const NODES: [string, [number, number, number]][] = [
  ["PSYCHE", [-0.55, 0.45, 0.55]], ["STRATEGY", [0.6, 0.4, 0.45]], ["RULES", [0.0, 0.7, 0.0]], ["PERFORMANCE", [0.75, 0.05, -0.55]],
  ["RISK", [-0.8, 0.0, -0.4]], ["LEARNING", [-0.3, 0.25, 1.2]], ["BODY", [0, -1.1, -0.45]],
];

interface Proj { k: string; x: number; y: number }

export function createBrain(cv: HTMLCanvasElement, chips: HTMLElement, life: Life, tip: { show(e: MouseEvent, html: string): void; hide(): void }) {
  const { rnd, gauss, unit } = seeded(11);
  const B = { pts: [] as number[][], ay: 0, ax: -0.15, drag: null as [number, number] | null, labels: {} as Record<string, string>, proj: [] as Proj[], focus: null as string | null };
  for (let i = 0; i < 5200; i++) {
    const d = unit(), side = d[0] < 0 ? -1 : 1, rr = Math.pow(rnd(), 0.25), fold = 1 + 0.07 * Math.sin(d[1] * 13 + d[2] * 9) * Math.cos(d[0] * 11);
    let x = d[0] * 1.05 * rr * fold, y = d[1] * 0.78 * rr * fold;
    const z = d[2] * 1.35 * rr * fold;
    x += side * 0.06;
    if (y < -0.35) y = -0.35 + (y + 0.35) * 0.35;
    B.pts.push([x, y, z]);
  }
  for (let i = 0; i < 900; i++) { const d = unit(), rr = Math.pow(rnd(), 0.35); B.pts.push([d[0] * 0.55 * rr, -0.5 + d[1] * 0.25 * rr, -0.85 + d[2] * 0.38 * rr]); }
  for (let i = 0; i < 500; i++) { const t = rnd(); B.pts.push([gauss() * 0.06, -0.4 - t * 0.9, -0.35 - t * 0.15 + gauss() * 0.05]); }

  const SYN = { n: [] as number[][], e: [] as [number, number][], p: [] as { e: [number, number]; t: number; rev: boolean }[] };
  const pick: number[][] = [];
  for (let i = 0; i < 180; i++) pick.push(B.pts[(Math.random() * 5200) | 0]);
  SYN.n = pick;
  pick.forEach((a, i) => {
    const d = pick.map((b, j) => [j, (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2]).filter((x) => x[0] !== i).sort((x, y) => x[1] - y[1]).slice(0, 2);
    d.forEach(([j]) => { if (i < j) SYN.e.push([i, j]); });
  });

  let hoverNode: Proj | null = null;
  life.on(cv, "pointerdown", (e) => { B.drag = [e.clientX, e.clientY]; });
  life.on(window, "pointerup", () => { B.drag = null; });
  life.on(window, "pointermove", (e) => {
    if (!B.drag) return;
    B.ay += (e.clientX - B.drag[0]) * 0.008;
    B.ax = Math.max(-1, Math.min(1, B.ax + (e.clientY - B.drag[1]) * 0.006));
    B.drag = [e.clientX, e.clientY];
  });
  life.on(cv, "mousemove", (e) => {
    const b = cv.getBoundingClientRect();
    const hit = B.proj.filter((n) => Math.hypot(e.clientX - b.left - n.x, e.clientY - b.top - n.y) < 16).pop() ?? null;
    hoverNode = hit;
    if (hit) tip.show(e, `<b>${esc(hit.k)}</b><br>${esc(B.labels[hit.k] || "")}`); else tip.hide();
  });
  life.on(cv, "mouseleave", () => tip.hide());

  chips.empty();
  for (const [k] of NODES) {
    const c = chips.createSpan({ cls: "chip", text: k });
    c.dataset.n = k;
    c.onmouseenter = () => { B.focus = k; };
    c.onmouseleave = () => { B.focus = null; };
  }

  function draw(t: number) {
    const { g, w, h } = fit(cv);
    g.clearRect(0, 0, w, h);
    const sc = Math.min(w, h) * 0.33, cx = w * 0.5, cy = h * 0.46;
    if (!B.drag) B.ay += 0.003;
    g.globalCompositeOperation = "lighter";
    const P = SYN.n.map((p) => { const q = rot(p, B.ay, B.ax); return [cx + q[0] * sc, cy - q[1] * sc, (q[2] + 1.5) / 3]; });
    g.lineWidth = 0.6; g.strokeStyle = "rgba(255,255,255,.07)"; g.beginPath();
    for (const [a, b] of SYN.e) { g.moveTo(P[a][0], P[a][1]); g.lineTo(P[b][0], P[b][1]); }
    g.stroke();
    if (Math.random() < 0.35 && SYN.p.length < 40) SYN.p.push({ e: SYN.e[(Math.random() * SYN.e.length) | 0], t: 0, rev: Math.random() < 0.5 });
    SYN.p = SYN.p.filter((q) => (q.t += 0.035) < 1);
    for (const q of SYN.p) {
      let [a, b] = q.e;
      if (q.rev) [a, b] = [b, a];
      const A = P[a], Bp = P[b], x = A[0] + (Bp[0] - A[0]) * q.t, y = A[1] + (Bp[1] - A[1]) * q.t;
      g.strokeStyle = `rgba(255,255,255,${(0.35 * (1 - q.t)).toFixed(2)})`; g.lineWidth = 1; g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(x, y); g.stroke();
      g.fillStyle = "rgba(255,255,255,.95)"; g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill();
      const gl = g.createRadialGradient(x, y, 0, x, y, 10); gl.addColorStop(0, "rgba(255,255,255,.35)"); gl.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gl; g.fillRect(x - 10, y - 10, 20, 20);
    }
    for (const p of B.pts) {
      const q = rot(p, B.ay, B.ax), z = (q[2] + 1.5) / 3, x = cx + q[0] * sc, y = cy - q[1] * sc, fl = 0.35 + 0.65 * z;
      g.fillStyle = `rgba(${RED},${(0.25 + 0.55 * fl).toFixed(2)})`; g.fillRect(x, y, 1.4 + fl * 0.9, 1.4 + fl * 0.9);
    }
    const pulse = (Math.sin(t * 0.004) + 1) / 2;
    g.globalCompositeOperation = "source-over";
    B.proj = [];
    NODES.forEach(([k, p]) => {
      const q = rot(p, B.ay, B.ax), x = cx + q[0] * sc, y = cy - q[1] * sc, front = q[2] > -0.3, lx = x + (x > cx ? 60 : -60), ly = y - 18;
      B.proj.push({ k, x, y });
      const hi = B.focus === k || (hoverNode && hoverNode.k === k);
      g.strokeStyle = `rgba(${RED},${front ? 0.8 : 0.3})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(lx, ly); g.lineTo(lx + (x > cx ? 50 : -50), ly); g.stroke();
      g.fillStyle = hi ? "#ffffff" : `rgba(255,255,255,${front ? 1 : 0.4})`; g.beginPath(); g.arc(x, y, hi ? 5 : 3 + pulse * 1.5, 0, 7); g.fill();
      g.font = "11px 'Share Tech Mono',monospace"; g.textAlign = x > cx ? "left" : "right"; g.fillStyle = hi ? "#ffffff" : `rgba(255,255,255,${front ? 0.95 : 0.45})`; g.fillText(k, lx + (x > cx ? 4 : -4), ly - 4);
      if (hi || front) { g.fillStyle = `rgba(194,194,194,${front ? 0.9 : 0.4})`; g.font = "10px 'Share Tech Mono',monospace"; g.fillText((B.labels[k] || "").slice(0, 34), lx + (x > cx ? 4 : -4), ly + 9); }
    });
    const sy = (t * 0.08) % h;
    g.fillStyle = `rgba(${RED},.08)`; g.fillRect(0, sy, w, 2);
  }

  return { draw, setLabels: (l: Record<string, string>) => { B.labels = l; } };
}
