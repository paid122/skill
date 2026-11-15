"use client";
/** Videos can't be captured by the PNG exporter: swap each one for an image of its current frame. Returns an undo function. */
export function freezeVideosForExport(node: HTMLElement): () => void {
  const swaps: (() => void)[] = [];
  node.querySelectorAll<HTMLVideoElement>("video[data-poster-video], video[data-poster-video-fill]").forEach((v) => {
    try {
      if (!v.videoWidth) return; // no decoded frame yet; export falls back to the dark overlay
      const cv = document.createElement("canvas");
      cv.width = v.videoWidth; cv.height = v.videoHeight;
      cv.getContext("2d")!.drawImage(v, 0, 0);
      const img = document.createElement("img");
      img.src = cv.toDataURL("image/jpeg", 0.92);
      img.className = v.className;
      img.setAttribute("style", v.getAttribute("style") ?? "");
      v.after(img);
      swaps.push(() => img.remove());
    } catch { /* leave it; videos are excluded from the export itself */ }
  });
  return () => swaps.forEach((f) => f());
}
