"use client";
/**
 * Export a Poster card with a video background as a video file, exactly as long as the
 * uploaded video (a 15 s clip gives a 15 s card). Everything happens in the browser:
 *
 *  1. The card's foreground (text, badge, price line) is rendered once to a transparent PNG.
 *  2. The video is played from the start into a canvas, with the same cover-fit, blur and
 *     darkening as the card, and the foreground drawn on top of each frame.
 *  3. The canvas (plus the video's own sound) is recorded with MediaRecorder.
 *
 * With `countUp`, the big amount counts from zero to the result over the first seconds while the
 * chart draws in (the same timing as on the card), then lands with a small pop.
 *
 * Recording runs in real time, so a 15 s video takes about 15 s to export.
 */
import { toPng } from "html-to-image";
import { COUNT_POP_SECONDS, COUNT_UP_SECONDS, countUpPop, countUpProgress } from "@/components/PosterCard";

export const MAX_EXPORT_SECONDS = 60;

export interface VideoExportOptions {
  card: HTMLElement; // the PosterCard root (960 × 504)
  videoUrl: string;
  dim: number;
  blur: number;
  sound: boolean;
  /** The big amount at count-up progress 0 → 1. Leave out for a still foreground. */
  countUp?: (p: number) => string;
  onProgress?: (seconds: number, total: number) => void;
  signal?: AbortSignal;
}

/** Best container this browser can record: MP4 where supported (Chrome 126+, Safari), else WebM. */
export function recordingFormat(): { mime: string; ext: "mp4" | "webm" } | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates: [string, "mp4" | "webm"][] = [
    // MP4 only with H.264: an MP4 holding VP9 won't open in many players and apps.
    ["video/mp4;codecs=avc1.42E01F,mp4a.40.2", "mp4"],
    ["video/mp4;codecs=avc1.42E01F", "mp4"],
    ["video/webm;codecs=vp9,opus", "webm"],
    ["video/webm;codecs=vp8,opus", "webm"],
    ["video/webm", "webm"],
  ];
  const hit = candidates.find(([m]) => MediaRecorder.isTypeSupported(m));
  return hit ? { mime: hit[0], ext: hit[1] } : null;
}

async function foreground(card: HTMLElement, hide: string[] = []): Promise<HTMLImageElement> {
  // Hide the background media and the card colour so only the foreground is captured.
  const media = card.querySelector<HTMLElement>("[data-poster-media]");
  const hidden = hide.flatMap((sel) => Array.from(card.querySelectorAll<HTMLElement>(sel)));
  const prevBg = card.style.background;
  if (media) media.style.visibility = "hidden";
  hidden.forEach((el) => { el.style.visibility = "hidden"; });
  card.style.background = "transparent";
  try {
    const url = await toPng(card, { pixelRatio: 2, cacheBust: false, filter: (n) => !(n instanceof HTMLVideoElement) });
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    if (media) media.style.visibility = "";
    hidden.forEach((el) => { el.style.visibility = ""; });
    card.style.background = prevBg;
  }
}

/** Where an element sits on the card, in export pixels (the card may be shown scaled down on screen). */
function placeOf(card: HTMLElement, el: HTMLElement, exportWidth: number) {
  const c = card.getBoundingClientRect(), r = el.getBoundingClientRect();
  const k = exportWidth / c.width;
  return { x: (r.left - c.left) * k, y: (r.top - c.top) * k, w: r.width * k, h: r.height * k, k };
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.src = url;
    v.playsInline = true;
    v.preload = "auto";
    v.crossOrigin = "anonymous";
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error("This video can't be played in your browser."));
  });
}

export async function exportCardVideo(o: VideoExportOptions): Promise<{ blob: Blob; ext: string; seconds: number }> {
  const fmt = recordingFormat();
  if (!fmt) throw new Error("Your browser can't record video. Try Chrome, Edge or Safari.");
  const W = 1920, H = 1008;
  const amountEl = o.countUp ? o.card.querySelector<HTMLElement>("[data-poster-amount]") : null;
  const chartEl = o.card.querySelector<HTMLElement>("[data-poster-chart]");
  const counting = !!(o.countUp && amountEl);
  // Counting: capture the card without the amount (drawn per frame), plus a copy without the chart (revealed per frame).
  // The two captures toggle visibility on the same card, so they must run one after the other.
  const videoP = loadVideo(o.videoUrl);
  const fg = await foreground(o.card, counting ? ["[data-poster-amount]"] : []);
  const base = counting && chartEl ? await foreground(o.card, ["[data-poster-amount]", "[data-poster-chart]"]) : null;
  const video = await videoP;
  let amount: null | { x: number; y: number; size: number; font: string; color: string; spacing: number; shadow: boolean } = null;
  if (counting && amountEl) {
    const at = placeOf(o.card, amountEl, W);
    const cs = getComputedStyle(amountEl);
    // Font size is in card pixels (960 wide); positions above already account for on-screen scaling.
    const size = parseFloat(cs.fontSize) * (W / 960);
    amount = { x: at.x, y: at.y, size, font: `${cs.fontWeight} ${size}px ${cs.fontFamily}`, color: cs.color, spacing: -0.04 * size, shadow: cs.textShadow !== "none" };
  }
  const chartAt = counting && chartEl ? placeOf(o.card, chartEl, W) : null;
  const total0 = Math.min(video.duration || 0, MAX_EXPORT_SECONDS);
  const timeScale = Math.min(1, (total0 * 0.8) / (COUNT_UP_SECONDS + COUNT_POP_SECONDS)) || 1;
  let ended = false;
  const total = Math.min(video.duration || 0, MAX_EXPORT_SECONDS);
  if (!total || !Number.isFinite(total)) throw new Error("Couldn't read the video's length.");

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const K = W / 960;
  const softCanvas = document.createElement("canvas");
  softCanvas.width = W; softCanvas.height = H;
  const soft = softCanvas.getContext("2d")!;
  const draw = () => {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    const vw = video.videoWidth || W, vh = video.videoHeight || H;
    const zoom = o.blur ? 1.06 : 1;
    const scale = Math.max(W / vw, H / vh) * zoom;
    const dw = vw * scale, dh = vh * scale;
    ctx.filter = o.blur ? `blur(${o.blur * 2}px)` : "none";
    ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.filter = "none";
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, `rgba(0,0,0,${Math.min(0.95, o.dim + 0.2)})`);
    g.addColorStop(0.45, `rgba(0,0,0,${o.dim})`);
    g.addColorStop(1, `rgba(0,0,0,${Math.max(0, o.dim - 0.15)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // Short clips count faster, so the amount always lands before the clip ends.
    const sec = ended ? Infinity : video.currentTime / timeScale;
    if (!amount) { ctx.drawImage(fg, 0, 0, W, H); return; }
    const p = countUpProgress(sec);
    if (base && chartAt && p < 1) {
      // Everything but the chart, then the chart revealed from left to right.
      ctx.drawImage(base, 0, 0, W, H);
      // The chart (full foreground minus the base), faded out past the reveal edge.
      const edge = chartAt.x + chartAt.w * p;
      soft.clearRect(0, 0, W, H);
      soft.globalCompositeOperation = "source-over";
      soft.drawImage(fg, 0, 0, W, H);
      soft.globalCompositeOperation = "destination-in";
      const fade = soft.createLinearGradient(edge - 20 * K, 0, edge + 60 * K, 0);
      fade.addColorStop(0, "#000"); fade.addColorStop(1, "rgba(0,0,0,0)");
      soft.fillStyle = fade;
      soft.fillRect(chartAt.x - 40 * K, 0, W, H);
      ctx.drawImage(softCanvas, 0, 0);
    } else ctx.drawImage(fg, 0, 0, W, H);
    // The amount, laid out like the card's text (line-height 1, so the glyphs sit centred on the line box).
    const a = amount;
    ctx.save();
    ctx.font = a.font;
    ctx.fillStyle = a.color;
    ctx.textBaseline = "alphabetic";
    if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${a.spacing}px`;
    const text = p >= 1 ? o.countUp!(1) : o.countUp!(p);
    // Tabular digits (like the card), so the number doesn't wobble as it counts.
    const digitW = Math.max(...Array.from("0123456789", (d) => ctx.measureText(d).width));
    const mt = ctx.measureText("0");
    const asc = mt.fontBoundingBoxAscent ?? a.size * 0.97, desc = mt.fontBoundingBoxDescent ?? a.size * 0.24;
    const baseline = a.y + (a.size - (asc + desc)) / 2 + asc;
    const pop = countUpPop(sec);
    ctx.translate(a.x, baseline - a.size * 0.35);
    ctx.scale(pop, pop);
    if (a.shadow) { ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowOffsetY = 8 * (W / 960); ctx.shadowBlur = 40 * (W / 960); }
    if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
    let x = 0;
    for (const ch of text) {
      if (/[0-9]/.test(ch)) { const cw = ctx.measureText(ch).width; ctx.fillText(ch, x + (digitW - cw) / 2, a.size * 0.35); x += digitW + a.spacing; }
      else { ctx.fillText(ch, x, a.size * 0.35); x += ctx.measureText(ch).width + a.spacing; }
    }
    ctx.restore();
  };

  const stream = canvas.captureStream(60);
  let audio: AudioContext | null = null;
  if (o.sound) {
    try {
      // Route the video's sound into the recording without playing it out loud.
      audio = new AudioContext();
      const dest = audio.createMediaStreamDestination();
      audio.createMediaElementSource(video).connect(dest);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    } catch { audio = null; }
  } else video.muted = true;

  const chunks: Blob[] = [];
  const rec = new MediaRecorder(stream, { mimeType: fmt.mime, videoBitsPerSecond: 16_000_000 });
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise<void>((r) => { rec.onstop = () => r(); });

  video.currentTime = 0;
  draw();
  rec.start(250);
  let raf = 0, done = false;
  const finish = () => {
    if (done) return;
    done = true;
    ended = true;
    cancelAnimationFrame(raf);
    video.pause();
    draw();
    // Hold the last frame briefly so the file is the clip's full length (recording starts a few ms late).
    setTimeout(() => { if (rec.state !== "inactive") rec.stop(); }, o.signal?.aborted ? 0 : 50);
  };
  const loop = () => {
    draw();
    o.onProgress?.(Math.min(video.currentTime, total), total);
    if (video.currentTime >= total || video.ended) finish(); else raf = requestAnimationFrame(loop);
  };
  video.onended = finish;
  o.signal?.addEventListener("abort", finish);
  await video.play();
  raf = requestAnimationFrame(loop);
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  await audio?.close().catch(() => undefined);
  if (o.signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
  return { blob: new Blob(chunks, { type: fmt.mime.split(";")[0] }), ext: fmt.ext, seconds: total };
}
