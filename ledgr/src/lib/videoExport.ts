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
 * Recording runs in real time, so a 15 s video takes about 15 s to export.
 */
import { toPng } from "html-to-image";

export const MAX_EXPORT_SECONDS = 60;

export interface VideoExportOptions {
  card: HTMLElement; // the PosterCard root (960 × 504)
  videoUrl: string;
  dim: number;
  blur: number;
  sound: boolean;
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

async function foreground(card: HTMLElement): Promise<HTMLImageElement> {
  // Hide the background media and the card colour so only the foreground is captured.
  const media = card.querySelector<HTMLElement>("[data-poster-media]");
  const prevBg = card.style.background;
  if (media) media.style.visibility = "hidden";
  card.style.background = "transparent";
  try {
    const url = await toPng(card, { pixelRatio: 2, cacheBust: false, filter: (n) => !(n instanceof HTMLVideoElement) });
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    if (media) media.style.visibility = "";
    card.style.background = prevBg;
  }
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
  const [fg, video] = await Promise.all([foreground(o.card), loadVideo(o.videoUrl)]);
  const total = Math.min(video.duration || 0, MAX_EXPORT_SECONDS);
  if (!total || !Number.isFinite(total)) throw new Error("Couldn't read the video's length.");

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
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
    ctx.drawImage(fg, 0, 0, W, H);
  };

  const stream = canvas.captureStream(30);
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
  const rec = new MediaRecorder(stream, { mimeType: fmt.mime, videoBitsPerSecond: 12_000_000 });
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise<void>((r) => { rec.onstop = () => r(); });

  video.currentTime = 0;
  draw();
  rec.start(250);
  let raf = 0, done = false;
  const finish = () => {
    if (done) return;
    done = true;
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
