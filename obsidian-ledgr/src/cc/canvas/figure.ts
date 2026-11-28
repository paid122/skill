/** The OPERATOR panel overlay: scan beam, scanlines, glitch jolts and corner brackets over the statue video (prototype's drawFig). */
import type { Life } from "../life";

export function createFigure(cv: HTMLCanvasElement, video: HTMLVideoElement, life: Life) {
  return function draw(t: number) {
    const r = cv.parentElement!.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), w = r.width, h = r.height;
    if (w < 10) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = w * dpr; cv.height = h * dpr; }
    const g = cv.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    if (video.paused && video.readyState >= 2) video.play().catch(() => undefined);
    const by = (((t * 0.00022) % 1.2) - 0.1) * h;
    const gr = g.createLinearGradient(0, by - 18, 0, by + 18); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,.20)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, by - 18, w, 36);
    for (let y = 0; y < h; y += 3) { g.fillStyle = "rgba(0,0,0,.16)"; g.fillRect(0, y, w, 1); }
    if (Math.random() < 0.015) {
      video.style.transform = `translateX(${(Math.random() - 0.5) * 10}px)`;
      video.style.filter = "grayscale(1) contrast(1.25) brightness(1.35)";
      life.after(70, () => { video.style.transform = ""; video.style.filter = ""; });
    }
    g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 1;
    const m = 6, L = 14;
    [[m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1]].forEach(([x, y, sx, sy]) => { g.beginPath(); g.moveTo(x, y + sy * L); g.lineTo(x, y); g.lineTo(x + sx * L, y); g.stroke(); });
  };
}
