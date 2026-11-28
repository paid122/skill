/** Canvas sizing from the prototype: fit() for panel canvases, cvFit() for full-size layers. */

type Cv = HTMLCanvasElement & { _w?: number; _h?: number };

/** The window an element is in (Obsidian popout windows have their own). */
export const winOf = (el: Element): Window => el.ownerDocument.defaultView ?? window;

/** Canvas sized to its panel's inner area (inside the border and padding), so it never spills over the frame. */
export function fit(cv: Cv, heightOverride?: number) {
  // Layout sizes (offset/client), not getBoundingClientRect: the stage may be scaled to fit the window.
  const p = cv.parentElement!, win = winOf(cv), cs = win.getComputedStyle(p), dpr = Math.min(2, win.devicePixelRatio || 1);
  const px = (v: string) => parseFloat(v) || 0;
  const r = { height: p.offsetHeight };
  const inner = p.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight);
  // The fixed height from the markup (70 for the P&L curve, 210 for the radar), read once: after the first
  // draw the canvas's height attribute holds the pixel size (× devicePixelRatio), and reading that back made
  // these canvases grow on every redraw on Retina screens.
  if (cv.dataset.h === undefined) cv.dataset.h = cv.dataset.flex ? "" : cv.getAttribute("height") ?? "";
  const h = cv.dataset.h
    ? +cv.dataset.h
    : Math.max(120, r.height - (cv.offsetTop - p.offsetTop) - (cv.nextElementSibling ? 60 : 12));
  const w = Math.max(100, Math.floor(inner));
  if (heightOverride !== undefined) return size(cv, w, heightOverride, dpr);
  return size(cv, w, h, dpr);
}

function size(cv: Cv, w: number, h: number, dpr: number) {
  if (cv._w !== w || cv._h !== h) { cv._w = w; cv._h = h; cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + "px"; cv.style.height = h + "px"; }
  const g = cv.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w, h };
}

export function cvFit(cv: HTMLCanvasElement) {
  const dpr = Math.min(2, winOf(cv).devicePixelRatio || 1), r = { width: cv.clientWidth, height: cv.clientHeight };
  if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = r.width * dpr; cv.height = r.height * dpr; }
  const g = cv.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w: r.width, h: r.height };
}

/** The prototype's seeded random (seed 11), so the brain looks the same every time. */
export function seeded(seed = 11) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const gauss = () => { const u = rnd() || 1e-9, v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const unit = (): [number, number, number] => { const z = rnd() * 2 - 1, a = rnd() * 6.283, r = Math.sqrt(1 - z * z); return [r * Math.cos(a), z, r * Math.sin(a)]; };
  return { rnd, gauss, unit };
}

export function rot(p: number[], ay: number, ax: number): [number, number, number] {
  const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
  const x = p[0] * cy + p[2] * sy;
  let z = -p[0] * sy + p[2] * cy;
  const y = p[1] * cx - z * sx;
  z = p[1] * sx + z * cx;
  return [x, y, z];
}

export const RED = "255,255,255";

/** How much the stage is scaled on screen (1 = not scaled), from any element inside it. */
export const scaleOf = (el: HTMLElement) => (el.offsetWidth ? el.getBoundingClientRect().width / el.offsetWidth : 1);
