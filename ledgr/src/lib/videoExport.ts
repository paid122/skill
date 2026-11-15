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
  card: HTMLElement; // the card root at its real size (e.g. 960 × 504); exported at 2×
  videoUrl: string;
  dim: number;
  blur: number;
  /** "contain": whole video over a blurred fill (default "cover"). */
  fit?: "cover" | "contain";
  /** "even": flat darkening (default "left": darker on the left, behind the text). */
  shade?: "left" | "even";
  sound: boolean;
  /** The big amount at count-up progress 0 → 1. Leave out for a still foreground. */
  countUp?: (p: number) => string;
  /** Other numbers that count up, keyed by their element's `data-count` value. */
  counts?: Record<string, (p: number) => string>;
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
  const cardW = o.card.offsetWidth || 960, cardH = o.card.offsetHeight || 504;
  const W = cardW * 2, H = cardH * 2;
  const amountEl = o.countUp ? o.card.querySelector<HTMLElement>("[data-poster-amount]") : null;
  const chartEl = o.card.querySelector<HTMLElement>("[data-poster-chart]");
  const counting = !!(o.countUp && amountEl);
  // Counting: capture the card without the amount (drawn per frame), plus a copy without the chart (revealed per frame).
  // The two captures toggle visibility on the same card, so they must run one after the other.
  const videoP = loadVideo(o.videoUrl);
  const hideText = counting ? ["[data-poster-amount]", ...(o.counts ? ["[data-count]"] : [])] : [];
  const fg = await foreground(o.card, hideText);
  const base = counting && chartEl ? await foreground(o.card, [...hideText, "[data-poster-chart]"]) : null;
  const video = await videoP;
  // Every counting number, measured where it sits on the card.
  type Counter = { x: number; y: number; size: number; font: string; color: string; spacing: number; shadow: boolean; pop: boolean; at: (p: number) => string };
  const measure = (el: HTMLElement, at: (p: number) => string, pop: boolean): Counter => {
    const box = placeOf(o.card, el, W);
    const cs = getComputedStyle(el);
    // Font size is in card pixels; positions already account for on-screen scaling.
    const size = parseFloat(cs.fontSize) * (W / cardW);
    const em = parseFloat(cs.letterSpacing);
    return { x: box.x, y: box.y + (box.h - size) / 2, size, font: `${cs.fontWeight} ${size}px ${cs.fontFamily}`, color: cs.color, spacing: Number.isFinite(em) ? em * (W / cardW) : 0, shadow: cs.textShadow !== "none" && pop, pop, at };
  };
  const counters: Counter[] = [];
  if (counting && amountEl) counters.push(measure(amountEl, o.countUp!, true));
  if (counting && o.counts) {
    o.card.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
      const at = o.counts![el.dataset.count ?? ""];
      if (at) counters.push(measure(el, at, false));
    });
  }
  const amount = counters.length ? counters : null;
  const chartAt = counting && chartEl ? placeOf(o.card, chartEl, W) : null;
  const total0 = Math.min(video.duration || 0, MAX_EXPORT_SECONDS);
  const timeScale = Math.min(1, (total0 * 0.8) / (COUNT_UP_SECONDS + COUNT_POP_SECONDS)) || 1;
  let ended = false;
  const total = Math.min(video.duration || 0, MAX_EXPORT_SECONDS);
  if (!total || !Number.isFinite(total)) throw new Error("Couldn't read the video's length.");

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const K = W / cardW;
  const softCanvas = document.createElement("canvas");
  softCanvas.width = W; softCanvas.height = H;
  const soft = softCanvas.getContext("2d")!;
  // A counting number, laid out like the card's text (line-height 1, glyphs centred on the line box), with tabular digits.
  const drawCounter = (a: { x: number; y: number; size: number; font: string; color: string; spacing: number; shadow: boolean; pop: boolean; at: (p: number) => string }, p: number, sec: number) => {
    ctx.save();
    ctx.font = a.font;
    ctx.fillStyle = a.color;
    ctx.textBaseline = "alphabetic";
    if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
    const text = a.at(p >= 1 ? 1 : p);
    const digitW = Math.max(...Array.from("0123456789", (d) => ctx.measureText(d).width));
    const mt = ctx.measureText("0");
    const asc = mt.fontBoundingBoxAscent ?? a.size * 0.97, desc = mt.fontBoundingBoxDescent ?? a.size * 0.24;
    const baseline = a.y + (a.size - (asc + desc)) / 2 + asc;
    const pop = a.pop ? countUpPop(sec) : 1;
    ctx.translate(a.x, baseline - a.size * 0.35);
    ctx.scale(pop, pop);
    if (a.shadow) { ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowOffsetY = 8 * K; ctx.shadowBlur = 40 * K; }
    let x = 0;
    for (const ch of text) {
      if (/[0-9]/.test(ch)) { const cw = ctx.measureText(ch).width; ctx.fillText(ch, x + (digitW - cw) / 2, a.size * 0.35); x += digitW + a.spacing; }
      else { ctx.fillText(ch, x, a.size * 0.35); x += ctx.measureText(ch).width + a.spacing; }
    }
    ctx.restore();
  };
  const draw = () => {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    const vw = video.videoWidth || W, vh = video.videoHeight || H;
    const zoom = o.blur ? 1.06 : 1;
    const scale = Math.max(W / vw, H / vh) * zoom;
    const dw = vw * scale, dh = vh * scale;
    if (o.fit === "contain") {
      // Blurred fill behind, then the whole video, sharp, fitted inside the card.
      const fill = Math.max(W / vw, H / vh) * 1.15;
      ctx.filter = `blur(${28 * (W / cardW)}px) brightness(0.7)`;
      ctx.drawImage(video, (W - vw * fill) / 2, (H - vh * fill) / 2, vw * fill, vh * fill);
      const fitScale = Math.min(W / vw, H / vh) * zoom;
      ctx.filter = o.blur ? `blur(${o.blur * 2}px)` : "none";
      ctx.drawImage(video, (W - vw * fitScale) / 2, (H - vh * fitScale) / 2, vw * fitScale, vh * fitScale);
    } else {
      ctx.filter = o.blur ? `blur(${o.blur * 2}px)` : "none";
      ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }
    ctx.filter = "none";
    if (o.shade === "even") ctx.fillStyle = `rgba(0,0,0,${o.dim})`;
    else {
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, `rgba(0,0,0,${Math.min(0.95, o.dim + 0.2)})`);
      g.addColorStop(0.45, `rgba(0,0,0,${o.dim})`);
      g.addColorStop(1, `rgba(0,0,0,${Math.max(0, o.dim - 0.15)})`);
      ctx.fillStyle = g;
    }
    ctx.fillRect(0, 0, W, H);
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
    for (const a of amount) drawCounter(a, p, sec);
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
