"use client";
/* eslint-disable @next/next/no-img-element */
import { useLedgr } from "@/lib/store";
import { cx } from "@/lib/util";

/** The user's profile photo, or the first letter of their name. */
export function Avatar({ size = 32, className, active = false }: { size?: number; className?: string; active?: boolean }) {
  const name = useLedgr((s) => s.settings.displayName);
  const photo = useLedgr((s) => s.settings.avatar ?? null);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (photo) {
    return <img src={photo} alt={name ? `${name}'s profile photo` : "Profile photo"} style={style} className={cx("shrink-0 rounded-full object-cover", active ? "ring-2 ring-accent" : "ring-1 ring-line", className)} />;
  }
  return <span style={style} className={cx("grid shrink-0 place-items-center rounded-full border font-semibold", active ? "border-accent bg-accent text-on-accent" : "border-line bg-card-2 text-text", className)}>{(name || "L").slice(0, 1).toUpperCase()}</span>;
}

/** Turns a picked image into a small square profile photo (centre-cropped, 192×192 JPEG data URL). */
export async function makeAvatar(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file (JPG, PNG, WebP…).");
  if (file.size > 15 * 1024 * 1024) throw new Error("That image is over 15 MB. Choose a smaller one.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => fail(new Error("That image couldn't be opened."));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 192;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 192, 192);
    return canvas.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}
