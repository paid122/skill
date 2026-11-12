"use client";
import { toPng } from "html-to-image";

/** Fails instead of hanging if rendering stalls. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Export timed out")), ms))]);
}

/**
 * Render a DOM node to a PNG data URL at 2× for crisp sharing.
 * cacheBust must stay off: it appends a query string to every image URL, which breaks
 * the in-memory blob: URLs used for uploaded images and videos.
 */
export async function nodeToPng(node: HTMLElement): Promise<string> {
  const bg = getComputedStyle(node).backgroundColor;
  return withTimeout(toPng(node, { pixelRatio: 2, cacheBust: false, filter: (n) => !(n instanceof HTMLVideoElement), backgroundColor: bg && bg !== "rgba(0, 0, 0, 0)" ? bg : undefined }), 30000);
}

export async function exportPng(node: HTMLElement, filename: string) {
  const url = await nodeToPng(node);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  a.click();
}

export async function exportPdf(node: HTMLElement, filename: string) {
  const { jsPDF } = await import("jspdf");
  const url = await nodeToPng(node);
  const { width, height } = node.getBoundingClientRect();
  const orientation = width >= height ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "pt", format: [width, height] });
  pdf.addImage(url, "PNG", 0, 0, width, height);
  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
