/** Canvas sizing from the prototype: fit() for panel canvases, cvFit() for full-size layers. */

type Cv = HTMLCanvasElement & { _w?: number; _h?: number };

export function fit(cv: Cv) {
  const r = cv.parentElement!.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  const h = cv.getAttribute("height") && !cv.dataset.flex
    ? +cv.getAttribute("height")!
    : Math.max(120, r.height - (cv.offsetTop - cv.parentElement!.offsetTop) - (cv.nextElementSibling ? 60 : 12));
  const w = Math.max(100, r.width - 24);
  if (cv._w !== w || cv._h !== h) { cv._w = w; cv._h = h; cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + "px"; cv.style.height = h + "px"; }
  const g = cv.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w, h };
}

export function cvFit(cv: HTMLCanvasElement) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), r = cv.getBoundingClientRect();
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
